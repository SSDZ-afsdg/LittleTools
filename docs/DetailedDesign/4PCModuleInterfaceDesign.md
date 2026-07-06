# 📐 智能记账系统 - 详细设计文档

> **版本**：v1.0  
> **最后更新**：2026-07-06  
> **状态**：🔄 讨论中（第 4/7 部分）


## 4. 电脑端模块接口设计


### 4.1 模块概述

电脑端包含 5 个核心模块，各模块之间通过函数调用交互，模块职责单一，不跨层调用。

```
┌─────────────────────────────────────────────────────────────────┐
│                      API 层 (api.py)                          │
│              接收 HTTP 请求，调用各模块处理                     │
└──────────┬──────────────┬──────────────┬────────────────────┘
           │              │              │
           ▼              ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  解析模块    │  │  数据库模块  │  │  统计模块    │
│ ollama_parser│  │  database.py │  │  stats.py    │
└──────────────┘  └──────────────┘  └──────────────┘
                                                    │
                                                    ▼
                                          ┌──────────────┐
                                          │  报告生成    │
                                          │  notebook   │
                                          └──────────────┘
```


### 4.2 模块接口定义


#### 4.2.1 解析模块（`src/ollama_parser.py`）

**职责**：调用 Ollama，将原始文本转为结构化数据。

```python
def parse_with_ollama(raw_text: str) -> dict:
    """
    调用 Ollama 解析原始文本，提取消费信息。

    Args:
        raw_text: 用户原始输入，如 "今天吃火锅花了186"

    Returns:
        {
            "amount": 186.00,        # float, 金额
            "category": "餐饮",       # str, 分类
            "description": "吃火锅"   # str, 描述
        }

    Raises:
        Exception: Ollama 服务不可用、解析失败、返回格式错误时抛出异常
        （调用方需捕获并处理）
    """
    pass
```

**调用关系**：仅被 `api.py` 调用。


#### 4.2.2 数据库模块（`src/database.py`）—— 已完成

**职责**：MySQL 的增删改查。

```python
# 已实现，列出供参考
def init_db() -> None
def save_expense(record: dict) -> bool
def get_all_expenses(year: int = None, month: int = None) -> list[dict]
def get_expense_by_id(record_id: str) -> dict | None
def delete_expense(record_id: str) -> bool
def get_monthly_stats(year: int, month: int) -> dict
def get_comparison(current_year: int, current_month: int) -> dict
```

**调用关系**：被 `api.py` 和 `stats.py` 调用。


#### 4.2.3 统计模块（`src/stats.py`）

**职责**：从数据库读取数据，输出结构化统计结果（只输出数据，不负责展示）。

```python
def get_monthly_summary(year: int, month: int) -> dict:
    """
    获取月度汇总数据。

    Args:
        year: 年份，如 2026
        month: 月份，如 7

    Returns:
        {
            "total": 4236.00,        # float, 总支出
            "count": 47,             # int, 笔数
            "daily_avg": 141.20      # float, 日均
        }
    """
    pass


def get_category_distribution(year: int, month: int) -> dict:
    """
    获取月度类别分布。

    Args:
        year: 年份
        month: 月份

    Returns:
        {
            "餐饮": 1580.00,
            "购物": 890.00,
            "交通": 520.00
        }
    """
    pass


def get_daily_trend(year: int, month: int) -> list[dict]:
    """
    获取月度每日消费趋势。

    Args:
        year: 年份
        month: 月份

    Returns:
        [
            {"date": "2026-07-01", "total": 120.00},
            {"date": "2026-07-02", "total": 230.00}
        ]
    """
    pass


def get_monthly_comparison(current_year: int, current_month: int) -> dict:
    """
    获取本月与上月对比数据。

    Args:
        current_year: 当前年份
        current_month: 当前月份

    Returns:
        {
            "vs_last_month": {
                "diff": 386.00,     # float, 差额
                "percent": 10.0     # float, 变化百分比
            }
        }
    """
    pass


def get_top_expense(year: int, month: int) -> dict | None:
    """
    获取月度最大单笔消费。

    Args:
        year: 年份
        month: 月份

    Returns:
        {
            "id": "xxx",
            "amount": 680.00,
            "category": "购物",
            "description": "买衣服",
            "date": "2026-07-05 14:00:00"
        }
        # 本月无记录时返回 None
    """
    pass


def build_analytics_payload(year: int, month: int) -> dict:
    """
    组装完整的分析数据载荷，供同步接口返回给手机端。
    内部调用上述函数，聚合所有数据。

    Args:
        year: 年份
        month: 月份

    Returns:
        {
            "monthly_summary": {...},
            "category_distribution": {...},
            "daily_trend": [...],
            "comparison": {...}
        }
    """
    pass
```

**调用关系**：
- `get_monthly_summary`、`get_category_distribution`、`get_daily_trend`、`get_monthly_comparison` 被 `build_analytics_payload` 调用
- `build_analytics_payload` 被 `api.py` 调用


#### 4.2.4 冲突检测（内置于 `api.py`）

**职责**：同步时检测手机端与电脑端的版本冲突。

```python
def check_conflict(record: dict, computer_record: dict) -> bool:
    """
    检测单条记录是否存在冲突。

    冲突条件：version 不一致，或 金额/类别/描述 任一不同。

    Args:
        record: 手机端发来的记录
        computer_record: 电脑端已有的记录

    Returns:
        True: 有冲突
        False: 无冲突
    """
    pass
```

**调用关系**：仅被 `api.py` 内部使用。


#### 4.2.5 报告生成模块（`notebooks/accounting.ipynb`）

**职责**：读取数据，生成 HTML 报告。

```python
# 以下为 Jupyter Notebook 中各个 Cell 的伪代码

# Cell 1: 导入模块
# import matplotlib.pyplot as plt
# from src.database import get_all_expenses, get_monthly_stats, get_comparison
# from src.ollama_parser import parse_with_ollama

# Cell 2: 加载数据
# year, month = 2026, 7
# stats = get_monthly_stats(year, month)
# category_dist = get_category_distribution(year, month)
# daily_trend = get_daily_trend(year, month)
# comparison = get_monthly_comparison(year, month)
# top_expense = get_top_expense(year, month)

# Cell 3: 生成图表
# - 类别分布饼图
# - 每日趋势折线图

# Cell 4: 调用 Ollama 生成总结
# summary_text = generate_summary_with_ollama(stats, category_dist, comparison)

# Cell 5: 生成 HTML
# - 总览卡片
# - 图表
# - 对比
# - AI总结
# - 建议
```

**调用关系**：独立运行，不依赖其他模块（仅导入 `src/` 下的函数）。


#### 4.2.6 导出模块（内置在 `notebooks/accounting.ipynb`）

**职责**：导出数据为 CSV 和 JSON。

```python
# 导出 CSV
def export_to_csv(year: int, filepath: str) -> None:
    """
    导出指定年份数据为 CSV 文件。
    使用 pandas 实现，Excel 可直接打开。
    """
    pass

# 导出 JSON
def export_to_json(year: int, filepath: str) -> None:
    """
    导出指定年份数据为 JSON 文件。
    """
    pass

# 导出 + 归档清理
def archive_and_clean(year: int) -> None:
    """
    ① 调用 export_to_csv 和 export_to_json
    ② 提示用户确认导出成功
    ③ 删除数据库中该年份的数据
    """
    pass
```

**调用关系**：独立运行，在 Jupyter Notebook 中手动执行 Cell。


### 4.3 模块依赖关系图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         api.py（同步接口）                         │
│                                                                     │
│  接收 /sync 请求 → 解析 → 调用各模块 → 返回响应                    │
└───────────┬─────────────┬─────────────┬───────────────────────────┘
            │             │             │
            ▼             ▼             ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ ollama_parser.py │ │  database.py    │ │   stats.py       │
│                  │ │                  │ │                  │
│ parse_with_      │ │ get_expense_by_  │ │ build_analytics_ │
│ ollama()         │ │ id()            │ │ payload()        │
│                  │ │ save_expense()  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
                                      │
                                      ▼
                          ┌──────────────────┐
                          │   MySQL         │
                          │   expenses      │
                          └──────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                  notebooks/accounting.ipynb                        │
│                                                                     │
│  导入: ollama_parser.py, database.py, stats.py                    │
│  独立运行: 生成 HTML 报告 + 导出数据                               │
└─────────────────────────────────────────────────────────────────────┘
```


### 4.4 API 层伪代码

```python
# api.py - 同步接口核心逻辑

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

from src.database import get_expense_by_id, save_expense
from src.ollama_parser import parse_with_ollama
from src.stats import build_analytics_payload

app = FastAPI()

class SyncRecord(BaseModel):
    id: str
    raw_text: str
    amount: float
    category: str
    description: str | None
    date: str
    created_at: str
    version: int

class SyncRequest(BaseModel):
    records: List[SyncRecord]

@app.post("/sync")
def sync(request: SyncRequest):
    """
    同步手机端数据。

    流程：
    1. 遍历 records，调用 get_expense_by_id() 检查是否存在
    2. 如果存在，检查版本是否一致
       - 不一致 → 记录到冲突列表
       - 一致 → 继续处理
    3. 调用 parse_with_ollama() 重新解析
    4. 调用 save_expense() 存入 MySQL
    5. 如果有冲突 → 返回冲突（一条也不更新）
    6. 无冲突 → 调用 build_analytics_payload() 生成分析数据
    7. 返回同步结果 + 分析数据
    """
    pass
```

---

