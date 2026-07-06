# config.py
# MySQL 数据库配置（不要提交到 GitHub！）

MYSQL_CONFIG = {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "password": "你的MySQL密码",  # 改成你自己的密码
    "database": "smart_accounting",
    "charset": "utf8mb4"
}

# Ollama 配置
OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:7b"