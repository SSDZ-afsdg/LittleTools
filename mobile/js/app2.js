// ============================================================
// app2.js - 主逻辑
// ============================================================

// ===== 语音识别 =====
let mediaRecorder = null;
let audioChunks = [];

document.addEventListener('DOMContentLoaded', function() {
    // ---------- Tab 切换 ----------
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = {
        record: document.getElementById('tab-record'),
        list: document.getElementById('tab-list'),
        analytics: document.getElementById('tab-analytics'),
        settings: document.getElementById('tab-settings')
    };

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;

            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // 更新面板
            Object.keys(tabPanels).forEach(key => {
                tabPanels[key].classList.toggle('active', key === tab);
            });

            // 切换到分析 Tab 时刷新显示
            if (tab === 'analytics') {
                renderAnalytics();
            }
        });
    });

    // ---------- 文字录入 ----------
    const textInput = document.getElementById('textInput');
    const submitBtn = document.getElementById('textSubmitBtn');

    async function handleTextSubmit() {
        const text = textInput.value.trim();
        if (!text) {
            showToast('请输入消费内容');
            return;
        }

        const result = localParse(text);
        await addExpense(text, result.amount, result.category, result.description);
        textInput.value = '';
        updateUI();
        showToast(`✅ 已记录：${result.category} ¥${result.amount.toFixed(2)}`);

        // 自动切换到流水Tab查看
        switchTab('list');
    }

    submitBtn.addEventListener('click', handleTextSubmit);
    textInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleTextSubmit();
        }
    });

    // ---------- 语音录入（修复版：点击开始/点击停止 + 超时自动停止） ----------
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceWave = document.getElementById('voiceWave');
    const voiceText = voiceBtn.querySelector('.voice-text');
    const stopVoiceBtn = document.getElementById('stopVoiceBtn');
    const voiceStatus = document.getElementById('voiceStatus');

    // 检测浏览器是否支持语音识别
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        let recognition = null;
        let timeoutId = null;
        let isRecording = false;

        // 点击语音按钮：开始录音 / 停止录音（切换）
        voiceBtn.addEventListener('click', function() {
            if (isRecording) {
                // 正在录音 → 停止
                stopRecording();
                return;
            }
            // 未录音 → 开始
            startRecording();
        });

        // 停止按钮
        if (stopVoiceBtn) {
            stopVoiceBtn.addEventListener('click', function() {
                stopRecording();
            });
        }

        function startRecording() {
            // 清理旧的 recognition 实例
            if (recognition) {
                try { recognition.abort(); } catch(e) {}
                recognition = null;
            }

            recognition = new SpeechRecognition();
            recognition.lang = 'zh-CN';
            recognition.continuous = false;
            recognition.interimResults = false;

            // ---- 录音开始 ----
            recognition.onstart = function() {
                isRecording = true;
                voiceBtn.classList.add('recording');
                voiceText.textContent = '🎤 录音中...';
                voiceWave.style.display = 'flex';
                if (stopVoiceBtn) stopVoiceBtn.classList.add('show');
                if (voiceStatus) {
                    voiceStatus.textContent = '🎤 请说话...';
                    voiceStatus.className = 'voice-status active';
                }

                // 设置超时自动停止（10秒无声音自动停止）
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(function() {
                    if (isRecording) {
                        if (voiceStatus) {
                            voiceStatus.textContent = '⏱️ 超时自动停止';
                        }
                        stopRecording();
                    }
                }, 10000);
            };

            // ---- 识别结果 ----
            recognition.onresult = function(event) {
                const text = event.results[0][0].transcript;
                if (voiceStatus) {
                    voiceStatus.textContent = '✅ 识别：' + text;
                    voiceStatus.className = 'voice-status success';
                }

                // 自动填入输入框并提交
                if (text) {
                    document.getElementById('textInput').value = text;
                    stopRecording();
                    // 延迟一点点提交，让 UI 先更新
                    setTimeout(function() {
                        handleTextSubmit();
                    }, 300);
                }
            };

            // ---- 识别结束 ----
            recognition.onend = function() {
                // 如果还没停止，重置 UI
                if (isRecording) {
                    resetVoiceUI();
                    if (voiceStatus) {
                        voiceStatus.textContent = '⏹️ 录音已结束';
                        voiceStatus.className = 'voice-status';
                    }
                }
            };

            // ---- 识别错误 ----
            recognition.onerror = function(event) {
                if (event.error === 'not-allowed') {
                    showToast('❌ 请允许麦克风权限');
                    if (voiceStatus) {
                        voiceStatus.textContent = '❌ 请允许麦克风权限';
                        voiceStatus.className = 'voice-status';
                    }
                } else if (event.error === 'no-speech') {
                    showToast('⚠️ 未检测到语音，请重试');
                    if (voiceStatus) {
                        voiceStatus.textContent = '⚠️ 未检测到语音';
                        voiceStatus.className = 'voice-status';
                    }
                } else {
                    showToast(`❌ 语音识别错误：${event.error}`);
                    if (voiceStatus) {
                        voiceStatus.textContent = '❌ 错误：' + event.error;
                        voiceStatus.className = 'voice-status';
                    }
                }
                resetVoiceUI();
            };

            // ---- 启动录音 ----
            try {
                recognition.start();
            } catch (e) {
                console.log('识别已启动或启动失败:', e);
                // 如果已经启动，忽略
            }
        }

        function stopRecording() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (recognition) {
                try {
                    recognition.stop();
                } catch(e) {}
            }
            isRecording = false;
            resetVoiceUI();
            if (voiceStatus) {
                voiceStatus.textContent = '⏹️ 已停止';
                voiceStatus.className = 'voice-status';
            }
        }

        function resetVoiceUI() {
            isRecording = false;
            voiceBtn.classList.remove('recording');
            voiceText.textContent = '🎤 点击说话';
            voiceWave.style.display = 'none';
            if (stopVoiceBtn) stopVoiceBtn.classList.remove('show');
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        }

        // 如果页面关闭时还在录音，停止
        window.addEventListener('beforeunload', function() {
            if (recognition) {
                try { recognition.abort(); } catch(e) {}
            }
        });

    } else {
        // 不支持语音识别
        if (voiceBtn) {
            voiceBtn.textContent = '❌ 不支持语音';
            voiceBtn.style.opacity = '0.5';
            voiceBtn.disabled = true;
        }
        if (voiceStatus) {
            voiceStatus.textContent = '⚠️ 当前浏览器不支持语音识别，请使用Chrome或Edge';
            voiceStatus.className = 'voice-status';
        }
        showToast('⚠️ 当前浏览器不支持语音识别，请使用Chrome或Edge');
    }

    // ---------- 同步按钮 ----------
    document.getElementById('syncBtn').addEventListener('click', function() {
        syncExpenses();
    });

    // ---------- 清空待同步 ----------
    document.getElementById('clearPendingBtn').addEventListener('click', async function() {
        if (!confirm('确定要清空所有待同步的记录吗？')) return;
        const count = await clearPending();
        updateUI();
        showToast(`🗑️ 已清空 ${count} 条待同步记录`);
    });

    // ---------- 清空所有数据 ----------
    document.getElementById('clearAllBtn').addEventListener('click', async function() {
        if (!confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！')) return;
        await clearAll();
        updateUI();
        showToast('🗑️ 已清空所有数据');
    });

    // ---------- 流水筛选 ----------
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderExpenseList(this.dataset.filter);
        });
    });

    // ---------- 初始化 ----------
    updateUI();
    renderExpenseList('all');
    renderAnalytics();

    // 定期更新（每30秒刷新一次）
    setInterval(updateUI, 30000);
});

// ===== 本地关键词解析 =====
function localParse(text) {
    const categories = {
        '餐饮': ['吃','饭','餐','火锅','烧烤','面','粉','饺','包','菜','喝','奶茶','咖啡','早餐','午餐','晚餐','夜宵','外卖','饭馆','餐厅','汉堡','炸鸡','披萨'],
        '交通': ['打车','滴滴','出租','公交','地铁','高铁','火车','飞机','加油','停车','过路费','共享单车','骑车','公交卡'],
        '购物': ['买','衣服','鞋','包','日用品','超市','淘宝','京东','拼多多','商场','购物','电商','零食','水果'],
        '娱乐': ['电影','游戏','KTV','旅游','景点','游乐场','音乐会','酒吧','网吧','剧本杀','密室','台球'],
        '居住': ['房租','水电','物业','燃气','宽带','维修','家电','家具','装修','煤气','有线电视'],
        '医疗': ['看病','医院','买药','体检','牙科','挂号','检查','中医'],
        '教育': ['书','课程','培训','学费','考试','文具','打印','教材']
    };

    const amountMatch = text.match(/(\d+\.?\d*)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

    let category = '其他';
    for (const [cat, keywords] of Object.entries(categories)) {
        if (keywords.some(kw => text.includes(kw))) {
            category = cat;
            break;
        }
    }

    const description = text.replace(/\d+\.?\d*/g, '').trim() || '日常消费';

    return { amount, category, description };
}

// ===== Tab 切换 =====
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `tab-${tab}`);
    });
}

// ===== Toast 提示 =====
function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '90px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '10px 24px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: '999',
        maxWidth: '90%',
        textAlign: 'center',
        animation: 'fadeIn 0.3s ease'
    });

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ===== 更新界面 =====
async function updateUI() {
    const all = await getAllExpenses();
    const pending = all.filter(r => r.status === 'pending');
    const today = all.filter(r => r.date.startsWith(new Date().toISOString().slice(0, 10)));
    const todayTotal = today.reduce((sum, r) => sum + r.amount, 0);

    // 更新今日汇总
    document.getElementById('todaySummary').innerHTML = `
        <span>📅 今日：¥${todayTotal.toFixed(2)}</span>
        <span>📝 ${today.length} 笔</span>
    `;

    // 更新待同步状态
    const pendingBanner = document.getElementById('pendingBanner');
    if (pending.length > 0) {
        pendingBanner.style.display = 'block';
        document.getElementById('pendingCount').textContent = pending.length;
    } else {
        pendingBanner.style.display = 'none';
    }

    // 更新顶部状态
    document.getElementById('syncStatus').textContent = `⏳ 待同步: ${pending.length}`;

    // 更新流水列表
    const activeFilter = document.querySelector('.filter-btn.active');
    const filter = activeFilter ? activeFilter.dataset.filter : 'all';
    renderExpenseList(filter);
}

// ===== 渲染流水列表 =====
async function renderExpenseList(filter = 'all') {
    const list = document.getElementById('expenseList');
    const all = await getAllExpenses();

    let filtered = all;
    if (filter === 'pending') {
        filtered = all.filter(r => r.status === 'pending');
    } else if (filter === 'synced') {
        filtered = all.filter(r => r.status === 'synced');
    }

    if (filtered.length === 0) {
        list.innerHTML = '<li class="empty-tip">暂无记录 📝</li>';
        return;
    }

    list.innerHTML = filtered.map(item => {
        const statusMap = {
            'draft': '📝 草稿',
            'pending': '⏳ 待同步',
            'synced': '✅ 已同步'
        };
        const statusClass = {
            'draft': '',
            'pending': 'pending',
            'synced': 'synced'
        };

        return `
            <li class="expense-item" onclick="openEdit('${item.id}')">
                <div class="left">
                    <div class="desc">${item.description}</div>
                    <div class="meta">${item.date} · ${item.raw_text.slice(0, 15)}</div>
                </div>
                <div class="right">
                    <div class="amount">¥${item.amount.toFixed(2)}</div>
                    <div class="category">${item.category} · <span class="status-badge ${statusClass[item.status] || ''}">${statusMap[item.status] || item.status}</span></div>
                </div>
            </li>
        `;
    }).join('');
}

// ===== 编辑记录（点击条目） =====
async function openEdit(id) {
    const all = await getAllExpenses();
    const record = all.find(r => r.id === id);
    if (!record) return;

    const newAmount = prompt('修改金额：', record.amount);
    if (newAmount === null) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount)) { showToast('❌ 请输入有效数字'); return; }

    const newCategory = prompt('修改类别（餐饮/交通/购物/娱乐/居住/医疗/教育/其他）：', record.category);
    if (newCategory === null) return;

    const newDesc = prompt('修改描述：', record.description);
    if (newDesc === null) return;

    try {
        await updateExpense(id, {
            amount: amount,
            category: newCategory || record.category,
            description: newDesc || record.description,
            // 状态自动变为 pending
        });
        updateUI();
        showToast('✅ 已更新');
    } catch (e) {
        showToast('❌ 更新失败');
    }
}

// ===== 渲染分析数据 =====
async function renderAnalytics() {
    const placeholder = document.getElementById('analyticsPlaceholder');
    const content = document.getElementById('analyticsContent');

    const data = await getCachedAnalytics();

    if (!data) {
        placeholder.style.display = 'block';
        content.style.display = 'none';
        return;
    }

    placeholder.style.display = 'none';
    content.style.display = 'block';

    // 汇总卡片
    const summary = data.summary || { total: 0, count: 0, daily_avg: 0 };
    document.getElementById('summaryCards').innerHTML = `
        <div class="summary-card">
            <div class="value">¥${summary.total.toFixed(0)}</div>
            <div class="label">总支出</div>
        </div>
        <div class="summary-card">
            <div class="value">${summary.count}</div>
            <div class="label">笔数</div>
        </div>
        <div class="summary-card">
            <div class="value">¥${summary.daily_avg.toFixed(0)}</div>
            <div class="label">日均</div>
        </div>
    `;

    // AI总结
    const aiSummary = document.getElementById('aiSummary');
    if (data.ai_summary) {
        aiSummary.innerHTML = `<div class="title">📝 AI 月度总结</div><p>${data.ai_summary}</p>`;
    } else {
        aiSummary.innerHTML = '<div class="title">📝 暂无AI总结</div>';
    }

    // 绘制饼图（使用Canvas简单绘制）
    const catData = data.category_distribution || {};
    const labels = Object.keys(catData);
    const values = Object.values(catData);

    if (labels.length > 0) {
        drawPieChart(labels, values);
    }
}

// ===== 绘制饼图 =====
function drawPieChart(labels, values) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width || 300;
    canvas.height = 200;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 20;

    const colors = ['#4CAF50', '#FF9800', '#2196F3', '#FF5722', '#9C27B0', '#00BCD4', '#8BC34A', '#F44336'];

    const total = values.reduce((s, v) => s + v, 0);
    if (total === 0) {
        ctx.fillStyle = '#ccc';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', cx, cy);
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let startAngle = -Math.PI / 2;

    values.forEach((value, i) => {
        const sliceAngle = (value / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        startAngle = endAngle;
    });

    // 图例
    let legendX = 10;
    let legendY = 10;
    ctx.font = '11px sans-serif';
    labels.forEach((label, i) => {
        const x = legendX;
        const y = legendY + i * 18;
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(x, y, 12, 12);
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.fillText(`${label} (${((values[i]/total)*100).toFixed(1)}%)`, x + 16, y + 10);

        if (i > 0 && i % 5 === 0) {
            legendX += 110;
            legendY = 10;
        }
    });
}