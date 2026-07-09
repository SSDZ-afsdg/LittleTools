// ============================================================
// sync2.js - 同步逻辑
// ============================================================

// ===== 获取服务器地址 =====
function getServerURL() {
    const ip = document.getElementById('serverIP').value || '192.168.2.1';
    const port = document.getElementById('serverPort').value || '8000';
    return `http://${ip}:${port}`;
}

// ===== 同步 =====
async function syncExpenses() {
    const resultEl = document.getElementById('syncResult');
    const syncBtn = document.getElementById('syncBtn');

    // 获取待同步记录
    let pending = await getPendingExpenses();

    // ⭐ 确保 pending 是数组（防御性编程）
    if (!Array.isArray(pending)) {
        console.warn('getPendingExpenses 返回的不是数组:', pending);
        pending = [];
    }

    if (pending.length === 0) {
        resultEl.className = 'sync-result';
        resultEl.textContent = '✅ 没有待同步的记录';
        return;
    }

    // 禁用按钮
    syncBtn.disabled = true;
    syncBtn.textContent = '⏳ 同步中...';
    resultEl.className = 'sync-result';
    resultEl.textContent = '⏳ 正在同步...';

    try {
        const serverURL = getServerURL();

        // 过滤掉 status 字段，只保留 API 需要的字段
        const recordsToSend = pending.map(({ status, synced_at, ...record }) => record);

        console.log('📤 发送数据:', recordsToSend);

        const response = await fetch(`${serverURL}/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ records: recordsToSend })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 错误响应:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            const ids = pending.map(r => r.id);
            await markAsSynced(ids);

            if (result.analytics) {
                await cacheAnalytics(result.analytics);
            }

            resultEl.className = 'sync-result success';
            resultEl.textContent = `✅ 同步成功！${result.synced_count} 条记录`;
            updateUI();

        } else if (result.conflicts && result.conflicts.length > 0) {
            resultEl.className = 'sync-result error';
            resultEl.textContent = `⚠️ 发现 ${result.conflicts.length} 条冲突，请在电脑端处理`;
            console.log('冲突详情:', result.conflicts);

        } else {
            resultEl.className = 'sync-result error';
            resultEl.textContent = `❌ 同步失败：${result.message}`;
        }

    } catch (error) {
        resultEl.className = 'sync-result error';
        resultEl.textContent = `❌ 连接失败：${error.message}`;
        console.error('同步错误:', error);
    }

    syncBtn.disabled = false;
    syncBtn.textContent = '🔄 立即同步';
}