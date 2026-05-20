// ============================================================
//  assets/js/cs-chat.js
//  CS Chat Widget + Bug Report/Saran Modal — Grid Survival
// ============================================================
(function () {
'use strict';

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
var CS_ENDPOINT     = '/.netlify/functions/cs-chat';
var REPORT_ENDPOINT = '/.netlify/functions/report';
var REPORT_STORE    = 'gs_reports';
var MAX_HISTORY     = 20;

var GAMES = [
    'Minecraft Parkun 2D','THE ONE FOR ZOMBIE','Desa Investasi Zombie',
    'Gerbang Parkun 2D','Desa Cipta Karya Ch 2','The Undeads (Roblox)',
    'Frequency Fury Obby (Roblox)'
];

var QUICK_REPLIES = [
    { label: '🎮 Info Game',     text: 'Ceritain dong game-game dari Grid Survival!' },
    { label: '📥 Cara Download', text: 'Gimana cara download game kalian?' },
    { label: '🐛 Lapor Bug',     text: '__open_report_bug__' },
    { label: '💡 Kirim Saran',   text: '__open_report_saran__' },
    { label: '📞 Kontak',        text: 'Gimana cara menghubungi tim Grid Survival?' },
];

var csHistory = [];
var isTyping  = false;
var csOpen    = false;
var sessionId = 'user_' + Math.random().toString(36).slice(2, 10);
var currentReportType = 'bug';

/* safe getElementById — tidak crash kalau null */
var $ = function (id) { return document.getElementById(id); };
function safeVal(id)  { var el = $(id); return el ? el.value : ''; }
function safeText(id, txt) { var el = $(id); if (el) el.textContent = txt; }
function safeStyle(id, prop, val) { var el = $(id); if (el) el.style[prop] = val; }
function safePH(id, txt)  { var el = $(id); if (el) el.placeholder = txt; }
function safeClass(id, method, cls) { var el = $(id); if (el) el.classList[method](cls); }
function safeOn(id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); }

/* ══════════════════════════════════════════
   BUILD HTML
══════════════════════════════════════════ */
function buildHTML() {
    // CS Toggle Button
    var toggle = document.createElement('button');
    toggle.id = 'cs-toggle';
    toggle.setAttribute('aria-label', 'Buka CS Chat');
    toggle.innerHTML = '💬<span class="cs-badge" id="cs-badge">1</span>';
    document.body.appendChild(toggle);

    // CS Window
    var win = document.createElement('div');
    win.id = 'cs-window';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Grid Survival Customer Service');
    win.innerHTML =
        '<div class="cs-header">' +
            '<div class="cs-header-avatar"><img src="assets/img/studio_logo.png" alt="CS"></div>' +
            '<div class="cs-header-info">' +
                '<span class="cs-header-name">GRID CS BOT</span>' +
                '<span class="cs-header-status">Online 24/7</span>' +
            '</div>' +
            '<button class="cs-close-btn" id="cs-close" aria-label="Tutup">✕</button>' +
        '</div>' +
        '<div class="cs-messages" id="cs-messages"></div>' +
        '<div class="cs-quick-btns" id="cs-quick-btns"></div>' +
        '<div class="cs-input-row">' +
            '<textarea id="cs-input" placeholder="Ketik pesan..." rows="1" maxlength="500"></textarea>' +
            '<button id="cs-send" aria-label="Kirim">➤</button>' +
        '</div>' +
        '<button class="cs-report-link" id="cs-report-link">🐛 Laporkan Bug / 💡 Kirim Saran</button>';
    document.body.appendChild(win);

    // Report Modal
    var modal = document.createElement('div');
    modal.id = 'report-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
        '<div class="report-box">' +
            '<button class="report-close" id="report-close" aria-label="Tutup">✕</button>' +
            '<span class="report-title" id="report-title">🐛 LAPORAN BUG / ERROR</span>' +
            '<div class="report-type-tabs">' +
                '<button class="report-type-tab active" data-type="bug">🐛 BUG / ERROR</button>' +
                '<button class="report-type-tab" data-type="saran">💡 SARAN</button>' +
            '</div>' +
            '<div id="report-form">' +
                '<div class="rfield">' +
                    '<label>GAME YANG BERMASALAH</label>' +
                    '<select id="r-game">' +
                        '<option value="">-- Pilih Game --</option>' +
                        GAMES.map(function(g){ return '<option value="'+g+'">'+g+'</option>'; }).join('') +
                        '<option value="Lainnya">Lainnya / Umum</option>' +
                    '</select>' +
                '</div>' +
                '<div class="rfield">' +
                    '<label id="r-desc-label">DESKRIPSI BUG / ERROR *</label>' +
                    '<textarea id="r-desc" rows="4" placeholder="Ceritakan bug yang kamu temukan..." maxlength="1000"></textarea>' +
                '</div>' +
                '<div class="rfield">' +
                    '<label>EMAIL KAMU <span style="font-weight:400;opacity:0.6;">(untuk konfirmasi tiket)</span></label>' +
                    '<input type="email" id="r-email" placeholder="contoh@gmail.com" maxlength="100">' +
                '</div>' +
                '<div class="rfield">' +
                    '<label>KONTAK LAIN <span style="font-weight:400;opacity:0.6;">(opsional — WA / Discord)</span></label>' +
                    '<input type="text" id="r-contact" placeholder="WA / Discord..." maxlength="100">' +
                '</div>' +
                '<button class="btn-report-submit" id="r-submit">▶ KIRIM LAPORAN</button>' +
            '</div>' +
            '<div class="report-result" id="report-result">' +
                '<span class="report-result-icon" id="r-result-icon">✅</span>' +
                '<span class="report-result-title" id="r-result-title">LAPORAN TERKIRIM!</span>' +
                '<span class="report-result-msg" id="r-result-msg">Terima kasih! Notifikasi sudah dikirim ke admin.</span>' +
                '<div class="report-ticket-box" id="report-ticket-box" style="display:none;">' +
                    '<span style="font-size:0.7rem;opacity:0.6;text-transform:uppercase;letter-spacing:1px;">Nomor Tiket</span>' +
                    '<span class="report-ticket-num" id="report-ticket-num">#GS-000000</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(modal);
}

/* ══════════════════════════════════════════
   CS TOGGLE
══════════════════════════════════════════ */
function bindToggle() {
    var toggle   = $('cs-toggle');
    var win      = $('cs-window');
    var closeBtn = $('cs-close');
    if (!toggle || !win) return;

    toggle.addEventListener('click', function () {
        csOpen = !csOpen;
        win.classList.toggle('open', csOpen);
        toggle.innerHTML = csOpen
            ? '✕<span class="cs-badge" id="cs-badge"></span>'
            : '💬<span class="cs-badge" id="cs-badge">1</span>';
        if (csOpen) {
            var badge = $('cs-badge');
            if (badge) badge.classList.remove('show');
            if (!csHistory.length) sendWelcome();
            setTimeout(function(){ var inp=$('cs-input'); if(inp) inp.focus(); }, 300);
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            csOpen = false;
            win.classList.remove('open');
            toggle.innerHTML = '💬<span class="cs-badge" id="cs-badge"></span>';
        });
    }

    safeOn('cs-report-link', 'click', function () { openReportModal('bug'); });
}

/* ══════════════════════════════════════════
   QUICK REPLIES
══════════════════════════════════════════ */
function buildQuickReplies() {
    var container = $('cs-quick-btns');
    if (!container) return;
    container.innerHTML = '';
    QUICK_REPLIES.forEach(function (qr) {
        var btn = document.createElement('button');
        btn.className = 'cs-quick-btn';
        btn.textContent = qr.label;
        btn.addEventListener('click', function () {
            if (qr.text === '__open_report_bug__')   { openReportModal('bug');   return; }
            if (qr.text === '__open_report_saran__')  { openReportModal('saran'); return; }
            sendUserMessage(qr.text);
        });
        container.appendChild(btn);
    });
}

/* ══════════════════════════════════════════
   MESSAGES
══════════════════════════════════════════ */
function timeStr() {
    return new Date().toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}

function appendMsg(role, text, time) {
    var container = $('cs-messages');
    if (!container) return;
    var div = document.createElement('div');
    div.className = 'cs-msg ' + role;
    var formatted = text
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\*([^*]+)\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
    div.innerHTML =
        '<div class="cs-msg-bubble">' + formatted + '</div>' +
        '<div class="cs-msg-time">' + (time || timeStr()) + '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    var container = $('cs-messages');
    if (!container || isTyping) return;
    isTyping = true;
    var div = document.createElement('div');
    div.id = 'cs-typing-indicator';
    div.className = 'cs-msg bot';
    div.innerHTML = '<div class="cs-typing"><span></span><span></span><span></span></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideTyping() {
    var el = $('cs-typing-indicator');
    if (el) el.remove();
    isTyping = false;
}

function sendWelcome() {
    var welcome = 'Halo! 👋 Aku *Grid CS Bot*, asisten resmi Grid Survival.\n\nAda yang bisa aku bantu? Kamu bisa tanya soal game, cara download, atau lapor bug! 🎮';
    appendMsg('bot', welcome, timeStr());
    csHistory.push({ role: 'bot', text: welcome });
}

/* ══════════════════════════════════════════
   SEND MESSAGE
══════════════════════════════════════════ */
function sendUserMessage(text) {
    if (!text || !text.trim() || isTyping) return;
    text = text.trim();
    appendMsg('user', text, timeStr());
    csHistory.push({ role: 'user', text: text });

    var inp = $('cs-input');
    if (inp) inp.value = '';

    showTyping();

    var payload = {
        text:    text,
        from:    'Pengunjung',
        userId:  sessionId,
        history: csHistory.slice(-10).map(function(h){ return { role: h.role === 'bot' ? 'model' : 'user', text: h.text }; })
    };

    fetch(CS_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(data) {
        hideTyping();
        if (data.rateLimited) {
            appendMsg('bot', 'Sabar ya, tunggu beberapa detik sebelum kirim lagi 😄', timeStr());
            return;
        }
        var reply = (data.reply || 'Maaf, coba lagi ya!').trim();
        appendMsg('bot', reply, timeStr());
        csHistory.push({ role: 'bot', text: reply });
        if (csHistory.length > MAX_HISTORY) csHistory = csHistory.slice(-MAX_HISTORY);

        // Kalau ada tiket yang dibuat via chat bot
        if (data.reportSubmitted && data.ticketUrl) {
            var tUrl = data.ticketUrl.startsWith('http')
                ? data.ticketUrl
                : window.location.protocol + '//' + window.location.host + data.ticketUrl;
            setTimeout(function() {
                var num = data.reportPayload && data.reportPayload.ticketNum ? '#' + data.reportPayload.ticketNum : '';
                appendMsg('bot',
                    '🔒 *Link tiket kamu* ' + num + ' sudah dibuat!\n\n' +
                    '<a href="' + tUrl + '" target="_blank" style="color:#00e5ff;font-weight:700;">📋 Pantau Status Tiket →</a>\n\nBookmark link ini ya!',
                    timeStr()
                );
            }, 500);
        }
    })
    .catch(function(err) {
        hideTyping();
        console.error('CS chat error:', err);
        appendMsg('bot', 'Koneksi bermasalah. Coba lagi sebentar ya! 🙏', timeStr());
    });
}

/* ══════════════════════════════════════════
   INPUT BINDING
══════════════════════════════════════════ */
function bindInput() {
    var inp  = $('cs-input');
    var send = $('cs-send');
    if (!inp || !send) return;

    send.addEventListener('click', function(){ sendUserMessage(inp.value); });
    inp.addEventListener('keydown', function(e){
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendUserMessage(inp.value);
        }
    });
    inp.addEventListener('input', function(){
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });
}

/* ══════════════════════════════════════════
   REPORT MODAL
══════════════════════════════════════════ */
function openReportModal(type) {
    currentReportType = type || 'bug';
    var modal = $('report-modal');
    if (!modal) return;

    // Reset form dengan null-safe
    safeStyle('report-form', 'display', 'block');
    safeClass('report-result', 'remove', 'show');
    var rDesc    = $('r-desc');    if (rDesc)    rDesc.value    = '';
    var rContact = $('r-contact'); if (rContact) rContact.value = '';
    var rEmail   = $('r-email');   if (rEmail)   rEmail.value   = '';
    var rGame    = $('r-game');    if (rGame)    rGame.value    = '';
    var rSubmit  = $('r-submit');
    if (rSubmit) { rSubmit.disabled = false; rSubmit.textContent = '▶ KIRIM LAPORAN'; }
    safeStyle('report-ticket-box', 'display', 'none');

    setReportType(currentReportType);
    modal.classList.add('open');

    // Tutup CS window
    csOpen = false;
    var win = $('cs-window');
    if (win) win.classList.remove('open');
}

function setReportType(type) {
    currentReportType = type;
    document.querySelectorAll('.report-type-tab').forEach(function(t){
        t.classList.toggle('active', t.getAttribute('data-type') === type);
    });
    if (type === 'bug') {
        safeText('report-title',  '🐛 LAPORAN BUG / ERROR');
        safeText('r-desc-label',  'DESKRIPSI BUG / ERROR *');
        safePH  ('r-desc',        'Ceritakan bug yang kamu temukan, langkah-langkahnya, dan apa yang terjadi...');
        safeText('r-submit',      '▶ KIRIM LAPORAN BUG');
    } else {
        safeText('report-title',  '💡 KIRIM SARAN');
        safeText('r-desc-label',  'ISI SARAN / MASUKAN *');
        safePH  ('r-desc',        'Tulis saran atau masukan kamu untuk game Grid Survival...');
        safeText('r-submit',      '▶ KIRIM SARAN');
    }
}

function bindReportModal() {
    // Semua addEventListener dengan null-safe
    safeOn('report-close', 'click', function(){
        safeClass('report-modal', 'remove', 'open');
    });

    var modal = $('report-modal');
    if (modal) {
        modal.addEventListener('click', function(e){
            if (e.target === this) this.classList.remove('open');
        });
    }

    document.querySelectorAll('.report-type-tab').forEach(function(tab){
        tab.addEventListener('click', function(){
            setReportType(this.getAttribute('data-type'));
        });
    });

    safeOn('r-submit', 'click', submitReport);
}

function submitReport() {
    var rDesc = $('r-desc');
    if (!rDesc) return;
    var desc    = rDesc.value.trim();
    var game    = safeVal('r-game');
    var contact = safeVal('r-contact').trim();
    var email   = safeVal('r-email').trim();
    var btn     = $('r-submit');

    if (!desc || desc.length < 10) {
        rDesc.focus();
        rDesc.style.borderColor = '#ff3c3c';
        setTimeout(function(){ rDesc.style.borderColor = ''; }, 2000);
        return;
    }

    var ticketId = 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
    if (btn) { btn.disabled = true; btn.textContent = '▶ MENGIRIM...'; }

    var payload = {
        type:     currentReportType,
        game:     game,
        desc:     desc,
        contact:  contact,
        email:    email,
        ticketId: ticketId
    };

    fetch(REPORT_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
    })
    .then(function(r){ return r.json(); })
    .then(function(data) {
        saveReportLocal({
            id:      ticketId,
            type:    currentReportType,
            game:    game || 'Tidak disebutkan',
            desc:    desc,
            contact: contact,
            email:   email,
            summary: data.summary || desc,
            time:    new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
            done:    false
        });

        safeStyle('report-form', 'display', 'none');
        safeClass('report-result', 'add', 'show');

        if (data.ok) {
            safeText('r-result-icon',  currentReportType === 'bug' ? '🐛✅' : '💡✅');
            safeText('r-result-title', currentReportType === 'bug' ? 'BUG DILAPORKAN!' : 'SARAN TERKIRIM!');
            var titleEl = $('r-result-title');
            if (titleEl) titleEl.style.color = currentReportType === 'bug' ? '#00ff41' : '#ffe600';
            safeText('r-result-msg', 'Laporan kamu sudah masuk! Admin sudah dapat notifikasi.');

            var rtb = $('report-ticket-box');
            if (rtb) {
                rtb.style.display = 'flex';
                var numLabel = data.ticketNum ? '#' + data.ticketNum + ' — ' + ticketId : '#' + ticketId;
                safeText('report-ticket-num', numLabel);
            }

            // Tambahkan link tiket kalau ada
            if (data.ticketUrl) {
                var tUrl = data.ticketUrl.startsWith('http')
                    ? data.ticketUrl
                    : window.location.protocol + '//' + window.location.host + data.ticketUrl;
                var trackEl = document.createElement('a');
                trackEl.href = tUrl;
                trackEl.target = '_blank';
                trackEl.style.cssText = 'display:block;margin-top:12px;text-align:center;color:#7c4dff;font-size:0.85rem;font-weight:700;text-decoration:none;';
                trackEl.textContent = '📋 Pantau Status Tiket →';
                var resultEl = $('report-result');
                if (resultEl) resultEl.appendChild(trackEl);
            }
        } else {
            safeText('r-result-icon',  '⚠️');
            safeText('r-result-title', 'GAGAL MENGIRIM');
            var titleEl2 = $('r-result-title');
            if (titleEl2) titleEl2.style.color = '#ff3c3c';
            safeText('r-result-msg', 'Coba lagi nanti, atau hubungi kami via Discord/Email.');
        }

        setTimeout(function(){ safeClass('report-modal', 'remove', 'open'); }, 3500);
    })
    .catch(function(err) {
        console.error('Report error:', err);
        saveReportLocal({
            id:      Date.now(),
            type:    currentReportType,
            game:    game || 'Tidak disebutkan',
            desc:    desc,
            contact: contact,
            summary: desc,
            time:    new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
            done:    false,
            offline: true
        });

        safeStyle('report-form', 'display', 'none');
        safeClass('report-result', 'add', 'show');
        safeText('r-result-icon',  '📦');
        safeText('r-result-title', 'LAPORAN TERSIMPAN');
        var titleEl3 = $('r-result-title');
        if (titleEl3) titleEl3.style.color = '#ffe600';
        safeText('r-result-msg', 'Laporan tersimpan lokal. Koneksi server bermasalah.');
        setTimeout(function(){ safeClass('report-modal', 'remove', 'open'); }, 3000);
    });
}

/* ══════════════════════════════════════════
   LOCAL REPORT STORAGE
══════════════════════════════════════════ */
function saveReportLocal(report) {
    try {
        var all = getReportsLocal();
        all.unshift(report);
        if (all.length > 100) all = all.slice(0, 100);
        localStorage.setItem(REPORT_STORE, JSON.stringify(all));
    } catch(e) { console.error('Save report local:', e); }
}

function getReportsLocal() {
    try { return JSON.parse(localStorage.getItem(REPORT_STORE)) || []; }
    catch(_) { return []; }
}

window.GS_Reports = {
    getAll:   getReportsLocal,
    markDone: function(id) {
        var all = getReportsLocal().map(function(r){ return r.id === id ? Object.assign({}, r, {done:true}) : r; });
        try { localStorage.setItem(REPORT_STORE, JSON.stringify(all)); } catch(e) {}
    },
    remove: function(id) {
        var all = getReportsLocal().filter(function(r){ return r.id !== id; });
        try { localStorage.setItem(REPORT_STORE, JSON.stringify(all)); } catch(e) {}
    }
};

/* expose global */
window.openReportModal = openReportModal;

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
function init() {
    try {
        buildHTML();
        bindToggle();
        buildQuickReplies();
        bindInput();
        bindReportModal();
    } catch(e) {
        console.error('CS Widget init error:', e);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

}());
