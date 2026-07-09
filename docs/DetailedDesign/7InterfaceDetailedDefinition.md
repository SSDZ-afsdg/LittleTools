# 📐 智能记账系统 - 详细设计文档

> **版本**：v1.0  
> **最后更新**：2026-07-06  
> **状态**：✅ 全部完成（第 7/7 部分）


## 7. 接口详细定义（手机端 ↔ API）


### 7.1 接口协议总览

| 项目 | 内容 |
|---|---|
| **传输协议** | HTTP |
| **数据格式** | JSON |
| **字符编码** | UTF-8 |
| **Base URL** | `http://{电脑IP}:8000` |
| **认证方式** | 无（局域网内信任） |


### 7.2 接口列表

| 方法 | 路径 | 说明 | 调用方 |
|---|---|---|---|
| POST | `/sync` | 同步数据 + 获取分析报告 | 手机端 |
| GET | `/health` | 健康检查（可选） | 手机端（检测服务是否可用） |


### 7.3 接口详细定义


#### 7.3.1 POST /sync（核心接口）


**请求**：

```http
POST http://192.168.1.100:8000/sync
Content-Type: application/json

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
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "raw_text": "打车上班25元",
      "amount": 25.00,
      "category": "交通",
      "description": "打车上班",
      "date": "2026-07-06 08:20:00",
      "created_at": "2026-07-06 08:25:00",
      "version": 1
    }
  ]
}
```


**请求字段说明**：

| 字段 | 类型 | 必填 | 说明 | 示例 |
|---|---|---|---|---|
| `records` | Array | ✅ | 记录列表 | — |
| `records[].id` | String | ✅ | UUID v4，手机端生成 | `"550e8400-..."` |
| `records[].raw_text` | String | ✅ | 用户原始输入 | `"今天吃火锅花了186"` |
| `records[].amount` | Number | ✅ | 金额 | `186.00` |
| `records[].category` | String | ✅ | 分类 | `"餐饮"` |
| `records[].description` | String | ❌ | 简短描述 | `"和同事吃火锅"` |
| `records[].date` | String | ✅ | 消费时间 | `"2026-07-06 12:30:00"` |
| `records[].created_at` | String | ✅ | 录入时间 | `"2026-07-06 12:35:00"` |
| `records[].version` | Integer | ✅ | 版本号 | `1` |


**成功响应（HTTP 200）**：

```json
{
  "success": true,
  "synced_count": 2,
  "conflicts": [],
  "message": "成功同步 2 条记录",
  "analytics": {
    "month_key": "2026-07",
    "summary": {
      "total": 4236.00,
      "count": 47,
      "daily_avg": 141.20
    },
    "category_distribution": {
      "餐饮": 1580.00,
      "购物": 890.00,
      "交通": 520.00,
      "娱乐": 356.00,
      "居住": 240.00,
      "医疗": 180.00,
      "教育": 120.00,
      "其他": 350.00
    },
    "daily_trend": [
      {"date": "2026-07-01", "total": 120.00},
      {"date": "2026-07-02", "total": 230.00},
      {"date": "2026-07-03", "total": 180.00},
      {"date": "2026-07-04", "total": 45.00},
      {"date": "2026-07-05", "total": 680.00}
    ],
    "comparison": {
      "vs_last_month": {
        "diff": 386.00,
        "percent": 10.0
      }
    },
    "ai_summary": "本月总支出4236元，日均消费141元。餐饮占比最高，达37%，建议关注餐饮支出。与上月相比增长10%，主要是购物类消费增加。"
  }
}
```


**成功响应字段说明**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `success` | Boolean | `true` |
| `synced_count` | Integer | 成功同步的条数 |
| `conflicts` | Array | 空数组 |
| `message` | String | 提示信息 |
| `analytics` | Object | 分析数据，缓存到手机 IndexedDB |
| `analytics.month_key` | String | 月份标识 `YYYY-MM` |
| `analytics.summary` | Object | 月度汇总 |
| `analytics.summary.total` | Number | 总支出 |
| `analytics.summary.count` | Integer | 总笔数 |
| `analytics.summary.daily_avg` | Number | 日均支出 |
| `analytics.category_distribution` | Object | 类别 → 金额 |
| `analytics.daily_trend` | Array | 每日趋势 |
| `analytics.daily_trend[].date` | String | 日期 `YYYY-MM-DD` |
| `analytics.daily_trend[].total` | Number | 当日金额 |
| `analytics.comparison` | Object | 环比数据 |
| `analytics.comparison.vs_last_month.diff` | Number | 差额 |
| `analytics.comparison.vs_last_month.percent` | Number | 变化百分比 |
| `analytics.ai_summary` | String | AI 月度总结文字 |


**冲突响应（HTTP 200）**：

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


**冲突响应字段说明**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `success` | Boolean | `false` |
| `synced_count` | Integer | `0` |
| `conflicts` | Array | 冲突列表 |
| `conflicts[].id` | String | 冲突记录 ID |
| `conflicts[].phone` | Object | 手机端版本 |
| `conflicts[].computer` | Object | 电脑端版本 |
| `message` | String | 错误提示 |
| `analytics` | null | 无分析数据 |


**错误响应（HTTP 500）**：

```json
{
  "success": false,
  "synced_count": 0,
  "conflicts": [],
  "message": "同步失败：Ollama 服务未响应，请检查 Ollama 是否运行",
  "analytics": null
}
```


**HTTP 状态码说明**：

| 状态码 | 说明 | 场景 |
|---|---|---|
| 200 | 成功 | 请求格式正确，业务处理完成（含冲突） |
| 400 | 请求错误 | JSON 格式错误、缺少必填字段 |
| 500 | 服务器错误 | Ollama 未启动、数据库连接失败等 |


#### 7.3.2 GET /health（可选）

**请求**：

```http
GET http://192.168.1.100:8000/health
```

**响应**：

```json
{
  "status": "ok",
  "ollama": "connected",
  "mysql": "connected",
  "timestamp": "2026-07-06 20:00:00"
}
```


### 7.4 手机端调用示例

```javascript
// mobile/js/sync2.js

async function syncToComputer() {
    // 1. 从 IndexedDB 获取所有 pending 记录
    const pendingRecords = await getPendingExpenses();

    if (pendingRecords.length === 0) {
        showToast("没有待同步的记录");
        return;
    }

    // 2. 获取电脑 IP（用户配置，或自动扫描）
    const computerIP = await getComputerIP();

    // 3. 发送同步请求
    try {
        const response = await fetch(`http://${computerIP}:8000/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ records: pendingRecords })
        });

        const result = await response.json();

        if (result.success) {
            // 4. 同步成功 → 更新本地状态
            const syncedIds = pendingRecords.map(r => r.id);
            await markAsSynced(syncedIds);

            // 5. 缓存分析数据
            if (result.analytics) {
                await cacheAnalytics(result.analytics);
            }

            showToast(`✅ 同步成功！${result.synced_count} 条记录`);
            updateSyncStatus();

        } else if (result.conflicts.length > 0) {
            // 6. 有冲突 → 提示用户
            showToast(`⚠️ 发现 ${result.conflicts.length} 条冲突，请到电脑处理`);
            // 可以把冲突详情存到 IndexedDB，供用户查看

        } else {
            // 7. 其他错误
            showToast(`❌ 同步失败：${result.message}`);
        }

    } catch (error) {
        // 8. 网络错误
        showToast("❌ 无法连接电脑，请检查网络");
        console.error(error);
    }
}
```


### 7.5 电脑 IP 获取方式（手机端）

手机端需要知道电脑的 IP 地址才能访问 API。提供两种方式：

| 方式 | 说明 |
|---|---|
| **手动输入** | 用户在设置页面输入电脑 IP，如 `192.168.1.100` |
| **自动扫描** | 手机端在局域网内扫描端口 8000，找到可用服务 |

建议先用手动输入方式（简单可靠），后续再增加自动扫描功能。


### 7.6 接口调用时序图（完整版）

```
手机端                                电脑端 API
  │                                       │
  │  1. 用户点击"同步"                    │
  │───────────────┐                       │
  │               │                       │
  │  2. 查询 IndexedDB.pending            │
  │◀──────────────┘                       │
  │                                       │
  │  3. POST /sync                        │
  │   { records: [...] }                 │
  │──────────────────────────────────────▶│
  │                                       │
  │                                       │  4. 解析请求
  │                                       │  5. 逐条 Ollama 解析
  │                                       │  6. 版本冲突检测
  │                                       │  7. 存入 MySQL
  │                                       │  8. 统计 + AI 总结
  │                                       │
  │  9. 返回 200                         │
  │   { success: true, analytics: ... }  │
  │◀──────────────────────────────────────│
  │                                       │
  │  10. 更新状态 synced                  │
  │  11. 缓存 analytics 到 IndexedDB     │
  │  12. 显示"同步完成"                  │
  │                                       │
```

---




