# database/config.py

import os
from dotenv import load_dotenv

# 使用绝对路径定位 .env
dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path)


class Config:
    MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "smart_accounting")
    MYSQL_CHARSET = os.getenv("MYSQL_CHARSET", "utf8mb4")


MYSQL_CONFIG = {
    "host": Config.MYSQL_HOST,
    "port": Config.MYSQL_PORT,
    "user": Config.MYSQL_USER,
    "password": Config.MYSQL_PASSWORD,
    "database": Config.MYSQL_DATABASE,
    "charset": Config.MYSQL_CHARSET
}