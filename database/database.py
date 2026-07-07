import pymysql
import pymysql.err
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
import importlib  # 新增


def get_connection():
    """获取 MySQL 数据库连接（强制重新加载 config，确保密码最新）"""
    import database.config as config_module
    importlib.reload(config_module)  # 重新加载，使 .env 生效
    return pymysql.connect(**config_module.MYSQL_CONFIG)


def init_db():
    """初始化数据库（自动创建库和表）"""
    conn = None
    try:
        conn = get_connection()
    except pymysql.err.OperationalError as e:
        if e.args[0] == 1049:
            print("⚠️  数据库不存在，正在自动创建...")
            # 重新加载 config 获取配置（不带 database）
            import database.config as config_module
            importlib.reload(config_module)
            temp_config = config_module.MYSQL_CONFIG.copy()
            temp_config.pop("database")
            conn = pymysql.connect(**temp_config)
            cursor = conn.cursor()
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{config_module.MYSQL_CONFIG['database']}` "
                f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            cursor.close()
            conn.close()
            print("✅ 数据库创建成功")
            conn = get_connection()
        else:
            raise

    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id VARCHAR(36) PRIMARY KEY COMMENT 'UUID，与手机端一致',
            raw_text VARCHAR(500) NOT NULL COMMENT '用户原始输入',
            amount DECIMAL(10, 2) NOT NULL COMMENT '金额',
            category VARCHAR(50) NOT NULL COMMENT '分类',
            description VARCHAR(200) COMMENT '简短描述',
            date DATETIME NOT NULL COMMENT '消费时间',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '同步时间',
            ai_parsed JSON COMMENT 'Ollama解析结果',
            is_deleted TINYINT DEFAULT 0 COMMENT '软删除标记',
            version INT DEFAULT 1 COMMENT '版本号',
            INDEX idx_date (date),
            INDEX idx_category (category),
            INDEX idx_deleted (is_deleted)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        COMMENT='消费记录表'
    """)

    conn.commit()
    cursor.close()
    conn.close()
    print("✅ 数据库初始化完成（MySQL）")


def save_expense(record: Dict[str, Any]) -> bool:
    """保存或更新单条记录"""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id FROM expenses WHERE id = %s", (record.get("id"),))
        exists = cursor.fetchone()

        if exists:
            cursor.execute("""
                UPDATE expenses SET
                    raw_text = %s,
                    amount = %s,
                    category = %s,
                    description = %s,
                    date = %s,
                    ai_parsed = %s,
                    version = version + 1
                WHERE id = %s
            """, (
                record.get("raw_text"),
                record.get("amount"),
                record.get("category"),
                record.get("description"),
                record.get("date"),
                json.dumps(record.get("ai_parsed", {})),
                record.get("id")
            ))
        else:
            cursor.execute("""
                INSERT INTO expenses
                (id, raw_text, amount, category, description, date, created_at, ai_parsed, version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                record.get("id"),
                record.get("raw_text"),
                record.get("amount"),
                record.get("category"),
                record.get("description"),
                record.get("date"),
                record.get("created_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                json.dumps(record.get("ai_parsed", {})),
                record.get("version", 1)
            ))

        conn.commit()
        return True

    except Exception as e:
        print(f"保存失败: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def get_all_expenses(year: Optional[int] = None, month: Optional[int] = None) -> List[Dict]:
    """查询记录"""
    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    sql = "SELECT * FROM expenses WHERE is_deleted = 0"
    params = []

    if year and month:
        sql += " AND YEAR(date) = %s AND MONTH(date) = %s"
        params.extend([year, month])

    sql += " ORDER BY date DESC"

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    for row in rows:
        if row.get('ai_parsed'):
            row['ai_parsed'] = json.loads(row['ai_parsed'])

    return rows


def get_expense_by_id(record_id: str) -> Optional[Dict]:
    """根据ID查询单条记录"""
    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    cursor.execute("SELECT * FROM expenses WHERE id = %s AND is_deleted = 0", (record_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if row and row.get('ai_parsed'):
        row['ai_parsed'] = json.loads(row['ai_parsed'])

    return row


def delete_expense(record_id: str) -> bool:
    """软删除记录"""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("UPDATE expenses SET is_deleted = 1 WHERE id = %s", (record_id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"删除失败: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def get_monthly_stats(year: int, month: int) -> Dict:
    """获取月度统计数据"""
    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    cursor.execute("""
        SELECT 
            COALESCE(SUM(amount), 0) as total,
            COUNT(*) as count,
            COALESCE(AVG(amount), 0) as avg
        FROM expenses 
        WHERE YEAR(date) = %s AND MONTH(date) = %s AND is_deleted = 0
    """, (year, month))
    result = cursor.fetchone()

    cursor.execute("""
        SELECT category, COALESCE(SUM(amount), 0) as total
        FROM expenses 
        WHERE YEAR(date) = %s AND MONTH(date) = %s AND is_deleted = 0
        GROUP BY category
        ORDER BY total DESC
    """, (year, month))
    by_category = cursor.fetchall()

    cursor.execute("""
        SELECT id, amount, category, description, date
        FROM expenses 
        WHERE YEAR(date) = %s AND MONTH(date) = %s AND is_deleted = 0
        ORDER BY amount DESC
        LIMIT 1
    """, (year, month))
    top_expense = cursor.fetchone()

    cursor.close()
    conn.close()

    return {
        "total": float(result['total']),
        "count": result['count'],
        "avg": float(result['avg']),
        "by_category": {row['category']: float(row['total']) for row in by_category},
        "top_expense": top_expense
    }


def get_comparison(current_year: int, current_month: int) -> Dict:
    """获取对比数据（上月、去年同月）"""
    if current_month == 1:
        prev_year, prev_month = current_year - 1, 12
    else:
        prev_year, prev_month = current_year, current_month - 1

    current = get_monthly_stats(current_year, current_month)
    previous = get_monthly_stats(prev_year, prev_month)
    year_ago = get_monthly_stats(current_year - 1, current_month)

    return {
        "current": current,
        "previous": previous,
        "year_ago": year_ago,
        "vs_last_month": {
            "diff": current['total'] - previous['total'],
            "percent": (current['total'] - previous['total']) / previous['total'] * 100 if previous['total'] > 0 else 0
        },
        "vs_last_year": {
            "diff": current['total'] - year_ago['total'],
            "percent": (current['total'] - year_ago['total']) / year_ago['total'] * 100 if year_ago['total'] > 0 else 0
        }
    }


if __name__ == "__main__":
    init_db()

    test_record = {
        "id": "test-001",
        "raw_text": "今天吃火锅花了186",
        "amount": 186,
        "category": "餐饮",
        "description": "吃火锅",
        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ai_parsed": {"amount": 186, "category": "餐饮", "description": "吃火锅"}
    }

    save_expense(test_record)
    print("✅ 测试记录插入成功")

    rows = get_all_expenses()
    print(f"📊 当前共有 {len(rows)} 条记录")
    for row in rows[:3]:
        print(f"  - {row['date']} | {row['category']} | ¥{row['amount']} | {row['description']}")

    now = datetime.now()
    stats = get_monthly_stats(now.year, now.month)
    print(f"\n📊 本月统计：总支出 ¥{stats['total']}，共 {stats['count']} 笔")