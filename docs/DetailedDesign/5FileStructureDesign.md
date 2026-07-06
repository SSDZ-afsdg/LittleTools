# 📐 智能记账系统 - 详细设计文档

> **版本**：v1.0  
> **最后更新**：2026-07-06  
> **状态**：🔄 讨论中（第 5/7 部分）


## 5. 文件结构设计


### 5.1 完整目录结构

```
smart-accounting/
│
├── .gitignore                          # Git 忽略文件
├── README.md                           # 项目介绍
├── requirements.txt                    # Python 依赖
├── config.py                           # 配置文件（MySQL密码等，不提交）
│
├── docs/                               # 📁 文档
│   ├── REQUIREMENTS.md                 # 需求文档
│   ├── DESIGN.md                       # 概要设计
│   └── experience/                     # 开发经验记录
│       └── 001-解决idea被上传问题.md
│
├── src/                                # 📁 电脑端 Python 源码
│   ├── __init__.py
│   ├── database.py                     # ✅ 已完成
│   ├── ollama_parser.py                # ⏳ 待开发
│   ├── stats.py                        # ⏳ 待开发
│   └── api.py                          # ⏳ 待开发
│
├── notebooks/                          # 📁 Jupyter Notebook
│   └── accounting.ipynb                # ⏳ 待开发（报告生成 + 导出）
│
├── mobile/                             # 📁 手机端 PWA
│   ├── index.html                      # ⏳ 待开发（主页面）
│   ├── css/
│   │   └── style.css                   # ⏳ 待开发（样式）
│   ├── js/
│   │   ├── app.js                      # ⏳ 待开发（主逻辑）
│   │   ├── db.js                       # ⏳ 待开发（IndexedDB 操作）
│   │   ├── sync.js                     # ⏳ 待开发（同步逻辑）
│   │   └── analytics.js                # ⏳ 待开发（分析展示）
│   └── manifest.json                   # ⏳ 待开发（PWA 配置）
│
├── data/                               # 📁 数据目录（gitignore）
│   └── exports/                        # 导出的 CSV/JSON 文件
│       └── expenses_2026.csv
│
├── reports/                            # 📁 报告目录（gitignore）
│   └── 2026-07.html                    # 月度报告
│
└── tests/                              # 📁 测试
    └── test_ollama.py                  # ⏳ 待开发
```


### 5.2 各文件职责说明

#### 根目录文件

| 文件 | 职责 | 说明 |
|---|---|---|
| `.gitignore` | 排除不需要提交的文件 | 已配置，排除 `venv/`、`.idea/`、`config.py`、`data/`、`reports/` |
| `README.md` | 项目说明 | 包含项目介绍、快速开始、使用说明 |
| `requirements.txt` | Python 依赖列表 | `pip install -r requirements.txt` 一键安装 |
| `config.py` | 配置文件 | 存放 MySQL 密码、Ollama URL 等，**不提交 Git** |


#### `src/` 目录（电脑端核心代码）

| 文件 | 职责 | 状态 |
|---|---|---|
| `database.py` | MySQL 增删改查 | ✅ 已完成 |
| `ollama_parser.py` | 调用 Ollama 解析文本 | ⏳ 待开发 |
| `stats.py` | 统计计算 | ⏳ 待开发 |
| `api.py` | FastAPI 同步服务 | ⏳ 待开发 |


#### `mobile/` 目录（手机端 PWA）

| 文件 | 职责 |
|---|---|
| `index.html` | 主页面，4 个 Tab 布局 |
| `css/style.css` | 全部样式 |
| `js/app.js` | 路由切换、事件绑定、UI 更新 |
| `js/db.js` | IndexedDB 操作（增删改查 + 缓存） |
| `js/sync.js` | 同步逻辑（调用电脑 API） |
| `js/analytics.js` | 分析数据展示（图表 + 总结） |
| `manifest.json` | PWA 配置（图标、启动样式） |


#### `notebooks/` 目录（Jupyter）

| 文件 | 职责 |
|---|---|
| `accounting.ipynb` | 报告生成 + 数据导出 |

Notebook 内部 Cell 分工：

| Cell | 内容 |
|---|---|
| Cell 1 | 导入模块（database, stats, ollama_parser） |
| Cell 2 | 配置参数（年份、月份） |
| Cell 3 | 加载数据 + 统计计算 |
| Cell 4 | 生成图表（饼图、折线图） |
| Cell 5 | 调用 Ollama 生成月度总结 |
| Cell 6 | 组装 HTML 报告 |
| Cell 7 | 导出 CSV / JSON |
| Cell 8 | 年度归档清理（可选） |


### 5.3 文件依赖关系

```
requirements.txt
       │
       ▼ (pip install)
┌──────────────────────────────────────────────────────────────┐
│  fastapi / uvicorn / pymysql / pandas / matplotlib / ollama │
└──────────────────────────────────────────────────────────────┘

config.py ◄─────── 被所有 src/*.py 导入（读取 MySQL 配置）

src/database.py
       │
       ├─── 被 src/stats.py 导入
       ├─── 被 src/api.py 导入
       └─── 被 notebooks/accounting.ipynb 导入

src/ollama_parser.py
       │
       └─── 被 src/api.py 导入

src/stats.py
       │
       ├─── 被 src/api.py 导入
       └─── 被 notebooks/accounting.ipynb 导入

src/api.py (启动 FastAPI 服务)
       │
       ├─── 依赖: database.py, ollama_parser.py, stats.py
       └─── 被 手机端 PWA 调用 (/sync)

notebooks/accounting.ipynb
       │
       ├─── 依赖: database.py, stats.py, ollama_parser.py
       ├─── 输出: reports/YYYY-MM.html
       └─── 输出: data/exports/expenses_YYYY.csv + .json

mobile/*.html / *.js (独立运行，不依赖 Python 环境)
       │
       ├─── 存储: IndexedDB（浏览器内置）
       ├─── 调用: http://{电脑IP}:8000/sync
       └─── 展示: 分析数据缓存
```


### 5.4 需要新增的目录（手动创建）

在 PyCharm 中执行以下操作：

```
1. 右键项目根目录 → New → Directory → mobile
2. 右键 mobile → New → Directory → css
3. 右键 mobile → New → Directory → js
4. 右键项目根目录 → New → Directory → data
5. 右键 data → New → Directory → exports
6. 右键项目根目录 → New → Directory → reports
7. 右键项目根目录 → New → Directory → notebooks
```

完成后目录结构应与 5.1 一致。


### 5.5 更新 .gitignore

确保以下内容已添加：

```gitignore
# 配置文件（含密码）
config.py

# 数据目录
data/
reports/
*.db
*.sqlite

# Python 缓存
__pycache__/
*.pyc

# IDE
.idea/
.vscode/

# 虚拟环境
venv/
env/
```

---

