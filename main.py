#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
智能记账系统 - 主入口文件
只负责统筹调度，不包含具体业务逻辑
"""
# main.py（在 init_db() 之前）
from database import config

print("DEBUG: MYSQL_CONFIG =", config.MYSQL_CONFIG)
import sys
import os
from pathlib import Path

# ============================================================
# 第 1 步：加载环境变量（最先执行）
# ============================================================
from dotenv import load_dotenv

# 加载项目根目录的 .env
load_dotenv()

# 如果 .env 在 database/ 目录下，用下面这行替代上面那行
# load_dotenv(os.path.join(os.path.dirname(__file__), "database", ".env"))

# ============================================================
# 第 2 步：设置项目路径
# ============================================================
PROJECT_ROOT = Path(__file__).parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ============================================================
# 第 3 步：导入各模块
# ============================================================
from database.database import init_db, get_all_expenses
from src.stats import (
    get_monthly_summary,
    get_category_distribution,
    get_daily_trend,
    get_monthly_comparison,
    get_top_expense,
    build_analytics_payload
)


# ============================================================
# 第 4 步：主入口（只做调度）
# ============================================================
if __name__ == "__main__":
    # 1. 初始化数据库
    print("🔧 正在初始化数据库...")
    init_db()
    print("✅ 数据库初始化完成\n")

    # 2. 调用 stats.py 中的统计函数（所有业务逻辑都在 stats.py 中）
    from datetime import datetime
    now = datetime.now()
    year, month = now.year, now.month

    # 获取月度汇总
    summary = get_monthly_summary(year, month)
    print(f"💰 总支出: ¥{summary['total']:.2f}")
    print(f"📝 消费笔数: {summary['count']} 笔")
    print(f"📈 日均支出: ¥{summary['daily_avg']:.2f}")

    # 获取类别分布
    cat_dist = get_category_distribution(year, month)
    if cat_dist:
        print("\n📂 类别分布:")
        for cat, amount in sorted(cat_dist.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cat}: ¥{amount:.2f}")

    # 后续扩展：启动 API 服务、运行报告生成等
    # from src.api import run_api_server
    # run_api_server()

