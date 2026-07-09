// ============================================================
// db2.js - IndexedDB 数据库操作（最简安全版）
// ============================================================

const DB_NAME = 'SmartAccountingDB';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('expenses')) {
                const store = db.createObjectStore('expenses', { keyPath: 'id' });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('date', 'date', { unique: false });
            }
            if (!db.objectStoreNames.contains('analytics_cache')) {
                db.createObjectStore('analytics_cache', { keyPath: 'month_key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function genId() {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random();
}

function now() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' +
           String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
}

// 添加记录
async function addExpense(raw_text, amount, category, description, date) {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const record = {
        id: genId(),
        raw_text,
        amount,
        category,
        description: description || raw_text.slice(0,20),
        date: date || now(),
        created_at: now(),
        status: 'pending',
        version: 1
    };
    store.add(record);
    await tx.done;
    return record;
}

// 获取所有记录（返回数组）
async function getAllExpenses() {
    try {
        const db = await openDB();
        const tx = db.transaction('expenses', 'readonly');
        const store = tx.objectStore('expenses');
        const result = await new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve([]);
        });
        await tx.done;
        return result || [];
    } catch (e) {
        return [];
    }
}

// 获取待同步记录（返回数组）⚠️ 关键函数
async function getPendingExpenses() {
    try {
        const db = await openDB();
        const tx = db.transaction('expenses', 'readonly');
        const store = tx.objectStore('expenses');
        const index = store.index('status');
        const result = await new Promise((resolve) => {
            const req = index.getAll('pending');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve([]);
        });
        await tx.done;
        return result || [];
    } catch (e) {
        return [];
    }
}

// 更新记录
async function updateExpense(id, updates) {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const record = await new Promise((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
    if (!record) throw new Error('记录不存在');
    Object.assign(record, updates);
    if (record.status === 'synced') {
        record.status = 'pending';
        record.version = (record.version || 1) + 1;
    }
    store.put(record);
    await tx.done;
    return record;
}

async function deleteExpense(id) {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    store.delete(id);
    await tx.done;
}

async function markAsSynced(ids) {
    if (!ids || ids.length === 0) return;
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    for (const id of ids) {
        const record = await new Promise((resolve) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
        if (record && record.status === 'pending') {
            record.status = 'synced';
            record.synced_at = now();
            store.put(record);
        }
    }
    await tx.done;
}

async function clearPending() {
    const db = await openDB();
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    const index = store.index('status');
    const items = await new Promise((resolve) => {
        const req = index.getAll('pending');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
    for (const item of items) {
        store.delete(item.id);
    }
    await tx.done;
    return items.length;
}

async function clearAll() {
    const db = await openDB();
    const tx = db.transaction(['expenses', 'analytics_cache'], 'readwrite');
    tx.objectStore('expenses').clear();
    tx.objectStore('analytics_cache').clear();
    await tx.done;
}

async function cacheAnalytics(data) {
    const db = await openDB();
    const tx = db.transaction('analytics_cache', 'readwrite');
    const store = tx.objectStore('analytics_cache');
    store.put({
        month_key: data.month_key || new Date().toISOString().slice(0,7),
        ...data,
        cached_at: now()
    });
    await tx.done;
}

async function getCachedAnalytics() {
    try {
        const db = await openDB();
        const tx = db.transaction('analytics_cache', 'readonly');
        const store = tx.objectStore('analytics_cache');
        const all = await new Promise((resolve) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve([]);
        });
        await tx.done;
        if (!all || all.length === 0) return null;
        all.sort((a, b) => (b.cached_at || '').localeCompare(a.cached_at || ''));
        return all[0];
    } catch (e) {
        return null;
    }
}