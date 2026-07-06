# 📐 智能记账系统 - 详细设计文档

> **版本**：v1.0  
> **最后更新**：2026-07-06  
> **状态**：🔄 讨论中（第 2/7 部分）

## 2. API 接口设计

### 2.1 接口概述

| 项目 | 内容 |
|---|---|
| **协议** | HTTP |
| **数据格式** | JSON |
| **字符编码** | UTF-8 |
| **Base URL** | `http://{电脑IP}:8000` |
| **仅有的接口** | `/sync`（POST）—— 手机端单向同步，电脑不主动推送 |

---

### 2.2 接口列表

| 方法 | 路径 | 说明 | 请求体 |
|---|---|---|---|
| POST | `/sync` | 手机端向电脑端同步数据 | 记录列表 JSON |
| GET | `/health` | 健康检查（可选） | 无 |

---

### 2.3 接口详情：POST /sync

#### 2.3.1 请求格式

**Headers**

| Header | 值 | 必填 | 说明 |
|---|---|---|---|
| Content-Type | `application/json` | ✅ | 固定值 |

**Body**

```json
{
  "records": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "raw_text": "今天中午和同事吃火锅花了186",
      "amount": 186.00,
      "category": "餐饮",
      "description": "和同事吃火锅",
      "date": "2026-07-06 12:30:00",
      "created_at": "2026-07-06 12:35:00",
      "version": 1
    }
  ]
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| records | Array | ✅ | 记录列表，至少 1 条 |
| records[].id | String | ✅ | UUID，手机端生成 |
| records[].raw_text | String | ✅ | 用户原始输入 |
| records[].amount | Number | ✅ | 金额 |
| records[].category | String | ✅ | 分类 |
| records[].description | String | ❌ | 简短描述 |
| records[].date | String | ✅ | 消费时间，格式 YYYY-MM-DD HH:mm:ss |
| records[].created_at | String | ✅ | 录入时间，格式 YYYY-MM-DD HH:mm:ss |
| records[].version | Integer | ✅ | 版本号，手机端当前版本 |



### 2.3.2 响应格式

**成功响应（HTTP 200）**

```json
{
  "success": true,
  "synced_count": 3,
  "conflicts": [],
  "message": "成功同步 3 条记录",
  "analytics": {
    "monthly_summary": {
      "total": 4236.00,
      "count": 47,
      "daily_avg": 141.20
    },
    "category_distribution": {
      "餐饮": 1580.00,
      "购物": 890.00,
      "交通": 520.00
    },
    "daily_trend": [
      {"date": "2026-07-01", "total": 120.00},
      {"date": "2026-07-02", "total": 230.00}
    ],
    "comparison": {
      "vs_last_month": {
        "diff": 386.00,
        "percent": 10.0
      }
    },
    "ai_summary": "本月总支出4236元，较上月增长10%..."
  }
}
```
**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | Boolean | 同步是否成功 |
| synced_count | Integer | 成功同步的条数 |
| conflicts | Array | 冲突列表（无冲突时为空数组） |
| message | String | 友好提示信息 |
| analytics | Object | 分析数据，供手机端展示 |
| analytics.monthly_summary | Object | 月度汇总 |
| analytics.monthly_summary.total | Number | 本月总支出 |
| analytics.monthly_summary.count | Integer | 本月消费笔数 |
| analytics.monthly_summary.daily_avg | Number | 日均支出 |
| analytics.category_distribution | Object | 各类别金额 |
| analytics.daily_trend | Array | 每日消费趋势 |
| analytics.daily_trend[].date | String | 日期 YYYY-MM-DD |
| analytics.daily_trend[].total | Number | 当日支出 |
| analytics.comparison | Object | 对比数据 |
| analytics.comparison.vs_last_month | Object | 与上月对比 |
| analytics.comparison.vs_last_month.diff | Number | 差额 |
| analytics.comparison.vs_last_month.percent | Number | 变化百分比 |
| analytics.ai_summary | String | AI 生成的月度总结文字 |

**冲突响应**
```json
{
  "success": false,
  "synced_count": 0,
  "conflicts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "phone": {
        "amount": 168.00,
        "category": "餐饮",
        "description": "火锅",
        "version": 1
      },
      "computer": {
        "amount": 186.00,
        "category": "餐饮",
        "description": "火锅(AA)",
        "version": 2
      }
    }
  ],
  "message": "同步失败，发现 1 条冲突，请在电脑端处理",
  "analytics": null
}
```
**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| conflicts[].id | String | 冲突记录 ID |
| conflicts[].phone | Object | 手机端的值 |
| conflicts[].computer | Object | 电脑端的值 |

**错误响应**
```json
{
  "success": false,
  "synced_count": 0,
  "conflicts": [],
  "message": "同步失败：Ollama 服务未响应，请检查 Ollama 是否运行",
  "analytics": null
}
```

---

### 2.4 接口详情：GET /health（可选）
健康检查，用于手机端检测电脑端服务是否可用。

**请求**

```txt
GET /health
```
**响应（HTTP 200）**
```json
{
  "status": "ok",
  "ollama": "connected",
  "mysql": "connected",
  "timestamp": "2026-07-06 20:00:00"
}
```

---

### 2.5 错误码说明
| HTTP 状态码 | 说明 |
|------------|------|
| 200 | 请求处理成功（含业务失败，如冲突） |
| 400 | 请求格式错误（JSON 格式不对） |
| 500 | 服务器内部错误（Ollama 未启动、数据库连接失败等） |

---

### 2.6 接口流程

```txt
手机端 → POST /sync → 电脑端
                         │
                         ▼
                   请求体格式校验
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
           格式正确              格式错误
              │                     │
              ▼                     ▼
         逐条处理记录          返回 400
              │
              ▼
       调用 Ollama 解析
              │
     ┌────────┴────────┐
     ▼                 ▼
  解析成功          解析失败
     │                 │
     ▼                 ▼
  版本冲突检测     返回 500
     │
  ┌──┴──┐
  ▼     ▼
有冲突  无冲突
  │     │
  ▼     ▼
返回    存入 MySQL
冲突     │
        ▼
     统计模块
        │
        ▼
   返回同步结果
   + 分析数据
        │
        ▼
     手机端
  标记 synced
  缓存分析数据
  显示成功/失败
```







