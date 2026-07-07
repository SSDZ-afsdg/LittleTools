
# src/stats.py
# 统计模块：提供月度汇总、类别分布、每日趋势、环比对比等功能

import json
from datetime import datetime
from typing import Dict, List, Optional, Any

# 从 database 模块导入数据库连接和已有统计函数
from database.database import get_connection
from database.database import get_monthly_stats as db_get_monthly_stats
from database.database import get_comparison as db_get_comparison


def get_monthly_summary(year: int, month: int) -> Dict[str, Any]:
    """
    获取月度汇总数据。

    Args:
        year: 年份，如 2026
        month: 月份，如 7

    Returns:
        {
            "total": 4236.00,      # 总支出
            "count": 47,           # 消费笔数
            "daily_avg": 141.20    # 日均支出
        }
    """
    stats = db_get_monthly_stats(year, month)
    return {
        "total": stats["total"],
        "count": stats["count"],
        "daily_avg": stats["avg"]
    }


def get_category_distribution(year: int, month: int) -> Dict[str, float]:
    """
    获取月度类别分布。

    Args:
        year: 年份
        month: 月份

    Returns:
        {"餐饮": 1580.00, "交通": 520.00, ...}
    """
    stats = db_get_monthly_stats(year, month)
    return stats["by_category"]


def get_daily_trend(year: int, month: int) -> List[Dict[str, Any]]:
    """
    获取月度每日消费趋势。

    Args:
        year: 年份
        month: 月份

    Returns:
        [
            {"date": "2026-07-01", "total": 120.00},
            {"date": "2026-07-02", "total": 230.00},
            ...
        ]
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DATE(date) as date, SUM(amount) as total
        FROM expenses
        WHERE YEAR(date) = %s AND MONTH(date) = %s
          AND is_deleted = 0
        GROUP BY DATE(date)
        ORDER BY date
    """, (year, month))

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        {"date": str(row[0]), "total": float(row[1])}
        for row in rows
    ]


def get_monthly_comparison(current_year: int, current_month: int) -> Dict[str, Any]:
    """
    获取本月与上月对比数据。

    Args:
        current_year: 当前年份
        current_month: 当前月份

    Returns:
        {
            "diff": 386.00,      # 差额
            "percent": 10.0      # 变化百分比
        }
    """
    comp = db_get_comparison(current_year, current_month)
    return comp["vs_last_month"]


def get_top_expense(year: int, month: int) -> Optional[Dict[str, Any]]:
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
        本月无记录时返回 None
    """
    stats = db_get_monthly_stats(year, month)
    return stats["top_expense"]


def build_analytics_payload(year: int, month: int) -> Dict[str, Any]:
    """
    组装完整的分析数据载荷，供 API 返回给手机端。

    Args:
        year: 年份
        month: 月份

    Returns:
        {
            "month_key": "2026-07",
            "summary": {"total": ..., "count": ..., "daily_avg": ...},
            "category_distribution": {"餐饮": ..., ...},
            "daily_trend": [{"date": ..., "total": ...}, ...],
            "comparison": {"diff": ..., "percent": ...}
        }
    """
    return {
        "month_key": f"{year:04d}-{month:02d}",
        "summary": get_monthly_summary(year, month),
        "category_distribution": get_category_distribution(year, month),
        "daily_trend": get_daily_trend(year, month),
        "comparison": get_monthly_comparison(year, month)
    }


# ============================================================
# 测试代码
# ============================================================
if __name__ == "__main__":
    now = datetime.now()
    year, month = now.year, now.month

    print("=" * 50)
    print(f"📊 {year}年{month}月 消费统计报告")
    print("=" * 50)

    # 1. 月度汇总
    summary = get_monthly_summary(year, month)
    print(f"\n💰 总支出: ¥{summary['total']:.2f}")
    print(f"📝 消费笔数: {summary['count']} 笔")
    print(f"📈 日均支出: ¥{summary['daily_avg']:.2f}")

    # 2. 类别分布
    cat_dist = get_category_distribution(year, month)
    if cat_dist:
        print("\n📂 类别分布:")
        for cat, amount in sorted(cat_dist.items(), key=lambda x: x[1], reverse=True):
            print(f"   {cat}: ¥{amount:.2f}")

    # 3. 每日趋势
    trend = get_daily_trend(year, month)
    if trend:
        print(f"\n📈 每日趋势（共 {len(trend)} 天有记录）:")
        for day in trend[:5]:
            print(f"   {day['date']}: ¥{day['total']:.2f}")
        if len(trend) > 5:
            print(f"   ... 还有 {len(trend) - 5} 天")

    # 4. 与上月对比
    comp = get_monthly_comparison(year, month)
    diff = comp["diff"]
    percent = comp["percent"]
    if diff > 0:
        print(f"\n📊 较上月: 增加 ¥{diff:.2f} ({percent:+.1f}%)")
    elif diff < 0:
        print(f"\n📊 较上月: 减少 ¥{abs(diff):.2f} ({percent:+.1f}%)")
    else:
        print(f"\n📊 较上月: 持平")

    # 5. 最大单笔
    top = get_top_expense(year, month)
    if top:
        print(f"\n🏆 最大单笔消费: ¥{top['amount']:.2f} ({top['category']}) - {top['description']}")

    print("\n" + "=" * 50)
    print("✅ 统计模块测试完成")