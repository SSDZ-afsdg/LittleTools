# 📐 智能记账系统 - 详细设计文档

> **版本**：v1.0  
> **最后更新**：2026-07-06  
> **状态**：🔄 讨论中（第 3/7 部分）


## 3. 手机端数据模型（IndexedDB）


### 3.1 数据库概述

| 项目 | 内容 |
|---|---|
| **数据库名称** | `SmartAccountingDB` |
| **版本号** | `1` |
| **存储方式** | IndexedDB（浏览器内置） |
| **数据用途** | 手机端离线暂存 + 分析缓存 |


### 3.2 对象存储（Object Store）

| 存储名称 | 用途 | 主键 |
|---|---|---|
| `expenses` | 消费记录 | `id` |
| `analytics_cache` | 分析数据缓存 | `month_key`（格式 `2026-07`） |
| `sync_metadata` | 同步元数据 | `key` |


### 3.3 存储结构：expenses

每条记录结构与电脑端 MySQL 基本一致，增加 `status` 字段。

```javascript
{
  // ===== 主键 =====
  id: "550e8400-e29b-41d4-a716-446655440000",   // String, UUID v4

  // ===== 用户输入 =====
  raw_text: "今天中午和同事吃火锅花了186",      // String, 必填

  // ===== 核心字段 =====
  amount: 186.00,                               // Number, 必填
  category: "餐饮",                             // String, 必填
  description: "和同事吃火锅",                  // String, 可选
  date: "2026-07-06 12:30:00",                 // String, 必填

  // ===== 系统字段 =====
  created_at: "2026-07-06 12:35:00",           // String, 自动生成

  // ===== 状态字段 =====
  status: "synced",                            // String, 可选
  // 可选值: 'draft' | 'pending' | 'synced'

  // ===== 同步字段 =====
  version: 1,                                  // Number, 默认 1
  synced_at: "2026-07-06 20:00:00"             // String, 可选
}
```

**status 状态流转**

```
用户录入 → status: 'draft'
    │
    │ 用户修改或确认
    ▼
status: 'pending'
    │
    │ 同步成功
    ▼
status: 'synced'
    │
    │ 用户修改已同步记录
    ▼
status: 'pending'（重新进入待同步队列）
```

**字段对照表：手机端 vs 电脑端**

| 手机端字段 | 电脑端字段 | 类型 | 说明 |
|---|---|---|---|
| `id` | `id` | String | UUID，两端一致 |
| `raw_text` | `raw_text` | String | 用户原始输入 |
| `amount` | `amount` | Number | 金额 |
| `category` | `category` | String | 分类 |
| `description` | `description` | String | 描述 |
| `date` | `date` | String | 消费时间 |
| `created_at` | `created_at` | String | 录入时间 |
| `status` | — | String | **手机端独有**，电脑端不需要 |
| `version` | `version` | Number | 版本号，冲突检测 |
| `synced_at` | `synced_at` | String | 同步时间 |


### 3.4 存储结构：analytics_cache（分析数据缓存）

存储同步时电脑端返回的分析数据，供"分析"Tab 离线查看。

```javascript
{
  // ===== 主键 =====
  month_key: "2026-07",                         // String, 格式 YYYY-MM

  // ===== 数据 =====
  summary: {
    total: 4236.00,                            // Number, 本月总支出
    count: 47,                                 // Integer, 消费笔数
    daily_avg: 141.20                          // Number, 日均支出
  },
  category_distribution: {
    "餐饮": 1580.00,                           // 类别: 金额
    "购物": 890.00,
    "交通": 520.00
  },
  daily_trend: [
    { date: "2026-07-01", total: 120.00 },     // 每日汇总
    { date: "2026-07-02", total: 230.00 }
  ],
  comparison: {
    vs_last_month: {
      diff: 386.00,
      percent: 10.0
    }
  },
  ai_summary: "本月总支出4236元，较上月增长10%...", // String, AI 月度总结

  // ===== 元数据 =====
  generated_at: "2026-07-06 20:00:00",         // String, 生成时间
  is_current_month: true                       // Boolean, 是否当前月
}
```


### 3.5 存储结构：sync_metadata（同步元数据）

```javascript
{
  // ===== 主键 =====
  key: "sync_metadata",                        // String, 固定值

  // ===== 数据 =====
  last_sync_at: "2026-07-06 20:00:00",        // String, 上次同步时间
  last_sync_status: "success",                 // String, 'success' | 'failed' | 'conflict'
  pending_count: 0,                            // Integer, 当前待同步数量
  last_error_message: null,                    // String, 上次错误信息
  total_synced: 47,                            // Integer, 累计同步条数
  total_records: 47                            // Integer, 总记录数
}
```


### 3.6 操作接口（JavaScript 函数签名）

```javascript
// ===== expenses 操作 =====

// 新增记录
function addExpense(record: ExpenseRecord): Promise<void>

// 获取所有记录（按日期倒序）
function getAllExpenses(): Promise<ExpenseRecord[]>

// 获取某条记录
function getExpenseById(id: string): Promise<ExpenseRecord | null>

// 更新记录（自动将状态改为 pending）
function updateExpense(id: string, updates: Partial<ExpenseRecord>): Promise<void>

// 删除记录（软删除，实际从 IndexedDB 移除）
function deleteExpense(id: string): Promise<void>

// 获取待同步记录（status === 'pending'）
function getPendingExpenses(): Promise<ExpenseRecord[]>

// 同步成功后批量更新状态
function markAsSynced(ids: string[]): Promise<void>

// ===== analytics_cache 操作 =====

// 缓存分析数据
function cacheAnalytics(monthKey: string, data: AnalyticsData): Promise<void>

// 获取缓存的分析数据
function getCachedAnalytics(monthKey: string): Promise<AnalyticsData | null>

// 获取当前月缓存
function getCurrentMonthAnalytics(): Promise<AnalyticsData | null>

// ===== sync_metadata 操作 =====

// 更新同步元数据
function updateSyncMetadata(metadata: Partial<SyncMetadata>): Promise<void>

// 获取同步元数据
function getSyncMetadata(): Promise<SyncMetadata>
```


### 3.7 初始化代码骨架

```javascript
// db.js - IndexedDB 初始化

const DB_NAME = 'SmartAccountingDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 创建 expenses 存储
      if (!db.objectStoreNames.contains('expenses')) {
        const store = db.createObjectStore('expenses', { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }

      // 创建 analytics_cache 存储
      if (!db.objectStoreNames.contains('analytics_cache')) {
        db.createObjectStore('analytics_cache', { keyPath: 'month_key' });
      }

      // 创建 sync_metadata 存储
      if (!db.objectStoreNames.contains('sync_metadata')) {
        db.createObjectStore('sync_metadata', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

---

