// ============================================================
// db.js - IndexedDB 数据库操作
// ============================================================

const DB_NAME = 'SmartAccountingDB';
const DB_VERSION = 1;

// ===== 打开数据库 =====
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
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ===== 生成 UUID =====
function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() :
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
}

// ===== 获取当前时间 =====
function getNow() {
    const now = new Date();
    return now.getFullYear() + '-' +
           String(now.getMonth() + 1).padStart(2, '0') + '-' +
           String(now.getDate()).padStart(2, '0') + ' ' +
           String(now.getHours()).padStart(2, '0') + ':' +
           String(now.getMinutes()).padStart(2, '0') + ':' +
           String(now.getSeconds()).padStart(2, '0');
}

// ===== 添加记录 =====
async function addExpense(raw_text, amount, category, description, date = null) {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');

    const record = {
        id: generateId(),
        raw_text: raw_text,
        amount: amount,
        category: category,
        description: description || raw_text.slice(0, 20),
        date: date || getNow(),
        created_at: getNow(),
        status: 'draft',
        version: 1
    };

    await store.add(record);
    await tx.done;
    return record;
}

// ===== 获取所有记录 =====
async function getAllExpenses() {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readonly');
    const store = tx.objectStore('expenses');
    const items = await store.getAll();
    await tx.done;
    return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ===== 获取待同步记录 =====
async function getPendingExpenses() {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readonly');
    const store = tx.objectStore('expenses');
    const index = store.index('status');
    const items = await index.getAll('pending');
    await tx.done;
    return items;
}

// ===== 更新记录 =====
async function updateExpense(id, updates) {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const record = await store.get(id);
    if (!record) {
        throw new Error('记录不存在');
    }

    Object.assign(record, updates);
    // 如果修改了已同步的记录，状态改为 pending
    if (record.status === 'synced') {
        record.status = 'pending';
        record.version = (record.version || 1) + 1;
    }

    await store.put(record);
    await tx.done;
    return record;
}

// ===== 删除记录 =====
async function deleteExpense(id) {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    await store.delete(id);
    await tx.done;
}

// ===== 标记为已同步 =====
async function markAsSynced(ids) {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');

    for (const id of ids) {
        const record = await store.get(id);
        if (record && record.status === 'pending') {
            record.status = 'synced';
            record.synced_at = getNow();
            await store.put(record);
        }
    }
    await tx.done;
}

// ===== 清空待同步 =====
async function clearPending() {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const index = store.index('status');
    const items = await index.getAll('pending');
    for (const item of items) {
        await store.delete(item.id);
    }
    await tx.done;
    return items.length;
}

// ===== 清空所有数据 =====
async function clearAll() {
    const db = await openDB();
    const tx = db.transaction(['expenses', 'analytics_cache'], 'readwrite');
    await tx.objectStore('expenses').clear();
    await tx.objectStore('analytics_cache').clear();
    await tx.done;
}

// ===== 缓存分析数据 =====
async function cacheAnalytics(data) {
    const db = await openDB();
    const tx = db.transaction('analytics_cache', 'readwrite');
    const store = tx.objectStore('analytics_cache');
    await store.put({
        month_key: data.month_key || new Date().toISOString().slice(0, 7),
        ...data,
        cached_at: getNow()
    });
    await tx.done;
}

// ===== 获取缓存的分析数据 =====
async function getCachedAnalytics() {
    const db = await openDB();
    const tx = db.transaction('analytics_cache', 'readonly');
    const store = tx.objectStore('analytics_cache');
    const all = await store.getAll();
    await tx.done;
    // 按时间排序，取最新的
    if (all.length === 0) return null;
    all.sort((a, b) => (b.cached_at || '').localeCompare(a.cached_at || ''));
    return all[0];
}