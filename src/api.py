# src/api.py
# FastAPI 服务：接收手机端同步请求，调用各模块处理

import sys
import os
from pathlib import Path
from datetime import datetime
from typing import List, Optional
import json

# 添加项目根目录到 sys.path，确保能导入 database 和 src 模块
PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # <-- 新增
from pydantic import BaseModel, Field
import uvicorn

# 导入项目模块
from database.database import (
    get_expense_by_id,
    save_expense,
    get_all_expenses,
    get_monthly_stats,
    get_comparison
)
from src.ollama_parser import parse_with_ollama
from src.stats import build_analytics_payload


# ============================================================
# 1. 定义数据模型（Pydantic）
# ============================================================

class SyncRecord(BaseModel):
    """单条同步记录"""
    id: str = Field(..., description="UUID")
    raw_text: str = Field(..., description="用户原始输入")
    amount: float = Field(..., description="金额")
    category: str = Field(..., description="分类")
    description: Optional[str] = Field(None, description="简短描述")
    date: str = Field(..., description="消费时间")
    created_at: str = Field(..., description="录入时间")
    version: int = Field(1, description="版本号")


class SyncRequest(BaseModel):
    """同步请求"""
    records: List[SyncRecord] = Field(..., description="待同步的记录列表")


class ConflictDetail(BaseModel):
    """冲突详情"""
    id: str
    phone: dict
    computer: dict


class SyncResponse(BaseModel):
    """同步响应"""
    success: bool
    synced_count: int
    conflicts: List[ConflictDetail] = []
    message: str
    analytics: Optional[dict] = None


# ============================================================
# 2. 创建 FastAPI 应用
# ============================================================

app = FastAPI(
    title="智能记账系统 API",
    description="手机端数据同步服务",
    version="1.0.0"
)

# ===== 添加 CORS 中间件（解决跨域问题） =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],            # 允许所有来源（开发环境），生产环境可限制具体域名
    allow_credentials=True,
    allow_methods=["*"],            # 允许所有 HTTP 方法
    allow_headers=["*"],            # 允许所有请求头
)


# ============================================================
# 3. 辅助函数：冲突检测
# ============================================================

def check_conflict(phone_record: SyncRecord, computer_record: dict) -> bool:
    """
    检测手机端和电脑端记录是否存在冲突。
    条件：version 不一致，或金额/类别/描述任一不同。
    """
    if phone_record.version != computer_record.get("version", 1):
        return True
    if phone_record.amount != computer_record.get("amount"):
        return True
    if phone_record.category != computer_record.get("category"):
        return True
    if phone_record.description != computer_record.get("description"):
        return True
    return False


# ============================================================
# 4. API 接口：健康检查
# ============================================================

@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "ok",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


# ============================================================
# 5. API 接口：同步
# ============================================================

@app.post("/sync", response_model=SyncResponse)
async def sync_expenses(request: SyncRequest):
    """
    手机端同步接口。

    流程：
    1. 遍历 records，检查每条的冲突
    2. 有冲突 → 整个同步失败，返回冲突列表
    3. 无冲突 → 调用 Ollama 重新解析，存入数据库
    4. 调用统计模块生成分析数据
    5. 返回同步结果 + 分析数据
    """
    # ---------- 5.1 冲突检测 ----------
    conflicts = []
    for record in request.records:
        computer_record = get_expense_by_id(record.id)
        if computer_record and check_conflict(record, computer_record):
            conflicts.append({
                "id": record.id,
                "phone": {
                    "amount": record.amount,
                    "category": record.category,
                    "description": record.description,
                    "version": record.version
                },
                "computer": {
                    "amount": computer_record.get("amount"),
                    "category": computer_record.get("category"),
                    "description": computer_record.get("description"),
                    "version": computer_record.get("version", 1)
                }
            })

    # 如果有冲突，整个同步失败
    if conflicts:
        return SyncResponse(
            success=False,
            synced_count=0,
            conflicts=conflicts,
            message=f"同步失败，发现 {len(conflicts)} 条冲突，请在电脑端处理",
            analytics=None
        )

    # ---------- 5.2 解析 + 存储 ----------
    synced_count = 0
    for record in request.records:
        try:
            # 调用 Ollama 重新解析
            ai_result = parse_with_ollama(record.raw_text)

            # 构造入库记录
            expense_record = {
                "id": record.id,
                "raw_text": record.raw_text,
                "amount": record.amount,
                "category": record.category,
                "description": record.description,
                "date": record.date,
                "created_at": record.created_at,
                "ai_parsed": ai_result,
                "version": record.version
            }

            # 保存到数据库
            save_expense(expense_record)
            synced_count += 1

        except Exception as e:
            return SyncResponse(
                success=False,
                synced_count=synced_count,
                conflicts=[],
                message=f"同步失败：{str(e)}",
                analytics=None
            )

    # ---------- 5.3 生成分析数据 ----------
    try:
        from datetime import datetime
        now = datetime.now()
        analytics = build_analytics_payload(now.year, now.month)
    except Exception as e:
        # 分析数据生成失败不影响同步结果
        analytics = None
        print(f"警告：生成分析数据失败 {e}")

    return SyncResponse(
        success=True,
        synced_count=synced_count,
        conflicts=[],
        message=f"成功同步 {synced_count} 条记录",
        analytics=analytics
    )


# ============================================================
# 6. 启动服务
# ============================================================

def start_server(host="0.0.0.0", port=8000):
    """启动 FastAPI 服务"""
    print(f"🚀 启动智能记账系统 API 服务...")
    print(f"📍 地址: http://{host}:{port}")
    print(f"📖 文档: http://{host}:{port}/docs")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    start_server()