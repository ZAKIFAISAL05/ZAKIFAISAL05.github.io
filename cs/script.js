// ============================================================
//  cs/script.js — Grid Survival Customer Service Chat
// ============================================================
'use strict';

var CS_ENDPOINT     = '/.netlify/functions/cs-chat';
var REPORT_ENDPOINT = '/.netlify/functions/report';
var currentType     = 'bug';
var chatHistory     = [];
var isWaiting       = false;
var sessionId       = 'cs_' + Math.random().toString(36).slice(2, 9);

var QUICK = [
    { label: '🎮 Info game apa saja?',  text: 'Ceritain dong game-game dari Grid Survival!' },
    { label: '📥 Cara download game',   text: 'Gimana cara download game kalian?' },
    { label: '📞 Kontak tim',           text: 'Gimana cara menghubungi tim Grid Survival?' },
    { label: '🤔 Siapa Grid Survival?', text: 'Ceritain dong tentang studio Grid Survival!' },
];

/* ── TIME ── */
function now() {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/* ── RENDER MSG ── */
function addMsg(role, text, time) {
    var msgs = document.getElementById('messages');
    var row  = document.createElement('div');
    row.className = 'msg-row ' + role;

    var formatted = text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g,     '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    var avatarHtml = role === 'bot'
        ? '<div class="msg-avatar"><img src="../assets/img/studio_logo.png" alt="CS"></div>'
        : '';

    var nameHtml = role === 'bot'
        ? '<div class="msg-name">Grid CS Bot</div>'
        : '<div class="msg-name">Kamu</div>';

    row.innerHTML =
        avatarHtml +
        '<div class="msg-content">' +
            nameHtml +
            '<div class="msg-bubble">' + formatted + '</div>' +
            '<div class="msg-time">' + (time || now()) + '</div>' +
        '</div>';

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
}

/* ── TYPING INDICATOR ── */
function showTyping() {
    var msgs = document.getElementById('messages');
    var row  = document.createElement('div');
    row.className = 'typing-row';
    row.id = 'typing-row';
    row.innerHTML =
        '<div class="msg-avatar"><img src="../assets/img/studio_logo.png" alt="CS"></div>' +
        '<div class="typing-bubble"><span></span><span></span><span></span></div>';
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
}
function hideTyping() {
    var el = document.getElementById('typing-row');
    if (el) el.remove();
}

/* ── QUICK REPLIES ── */
function buildQuick() {
    var area = document.getElementById('quick-chips');
    QUICK.forEach(function(q) {
        var btn = document.createElement('button');
        btn.className   = 'quick-chip';
        btn.textContent = q.label;
        btn.onclick = function() {
            sendMsg(q.text);
            hideQuickArea();
        };
        area.appendChild(btn);
    });
}
function hideQuickArea() {
    var qa = document.getElementById('quick-area');
    if (qa) qa.style.display = 'none';
}

/* ── WELCOME MSG ── */
function sendWelcome() {
    setTimeout(function() {
        addMsg('bot',
            'Halo! 👋 Selamat datang di <strong>Customer Service Grid Survival</strong>.\n\n' +
            'Ada yang bisa aku bantu? Kamu bisa tanya info game, cara download, atau lapor bug/saran langsung di sini! 🎮',
            now()
        );
    }, 600);
}

/* ── SEND MSG ── */
function sendMsg(text) {
    if (!text || !text.trim() || isWaiting) return;
    text = text.trim();

    addMsg('user', text, now());
    chatHistory.push({ role: 'user', text: text });

    var inp = document.getElementById('msg-input');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }

    isWaiting = true;
    document.getElementById('send-btn').disabled = true;
    showTyping();

    fetch(CS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text,
            from: 'Pengunjung Web',
            userId: sessionId,
            history: chatHistory.slice(-8).map(function(h) {
                return { role: h.role === 'bot' ? 'model' : 'user', text: h.text };
            })
        })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideTyping();
        isWaiting = false;
        document.getElementById('send-btn').disabled = false;
        if (data.rateLimited) {
            addMsg('bot', 'Sabar ya, tunggu beberapa detik sebelum kirim pesan lagi 😊', now());
            return;
        }
        var reply = (data.reply || 'Maaf, coba lagi ya!').trim();
        addMsg('bot', reply, now());
        chatHistory.push({ role: 'bot', text: reply });
        if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);
    })
    .catch(function() {
        hideTyping();
        isWaiting = false;
        document.getElementById('send-btn').disabled = false;
        addMsg('bot', 'Koneksi bermasalah. Coba refresh halaman atau hubungi kami via Discord/Email ya! 🙏', now());
    });
}

/* ── INPUT HANDLER ── */
function initInput() {
    var inp = document.getElementById('msg-input');
    var btn = document.getElementById('send-btn');
    btn.addEventListener('click', function() { sendMsg(inp.value); hideQuickArea(); });
    inp.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMsg(inp.value);
            hideQuickArea();
        }
    });
    inp.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

/* ── REPORT MODAL ── */
function openModal(type) {
    currentType = type || 'bug';
    switchType(currentType);
    document.getElementById('modal-form').style.display    = 'block';
    document.getElementById('modal-success').classList.remove('show');
    document.getElementById('r-desc').value    = '';
    document.getElementById('r-contact').value = '';
    document.getElementById('r-game').value    = '';
    document.getElementById('r-submit').disabled    = false;
    document.getElementById('r-submit').textContent = 'Kirim Laporan';
    document.getElementById('modal-bg').classList.add('open');
}
function closeModal() {
    document.getElementById('modal-bg').classList.remove('open');
}
function switchType(type) {
    currentType = type;
    document.querySelectorAll('.type-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-type') === type);
    });
    var isBug = type === 'bug';
    document.getElementById('modal-icon').textContent  = isBug ? '🐛' : '💡';
    document.getElementById('modal-icon').className    = 'modal-icon ' + type;
    document.getElementById('modal-title').textContent = isBug ? 'Laporan Bug / Error' : 'Kirim Saran';
    document.getElementById('r-desc-label').textContent = isBug ? 'Deskripsi bug / error *' : 'Isi saran / masukan *';
    document.getElementById('r-desc').placeholder = isBug
        ? 'Ceritakan bug yang kamu temukan, langkah reproduksi, dan apa yang terjadi...'
        : 'Tulis saran atau masukan kamu untuk game Grid Survival...';
    document.getElementById('r-submit').textContent = isBug ? 'Kirim Laporan Bug' : 'Kirim Saran';
}

function submitReport() {
    var desc    = document.getElementById('r-desc').value.trim();
    var game    = document.getElementById('r-game').value;
    var contact = document.getElementById('r-contact').value.trim();
    var btn     = document.getElementById('r-submit');

    if (!desc || desc.length < 10) {
        var descEl = document.getElementById('r-desc');
        descEl.focus();
        descEl.style.borderColor = '#e74c3c';
        descEl.style.boxShadow   = '0 0 0 3px rgba(231,76,60,0.15)';
        setTimeout(function() {
            descEl.style.borderColor = '';
            descEl.style.boxShadow   = '';
        }, 2000);
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Mengirim...';

    fetch(REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: currentType, game: game, desc: desc, contact: contact })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        saveReportLocal({ id: Date.now(), type: currentType, game: game || '—', desc: desc, contact: contact, summary: data.summary || desc, time: new Date().toLocaleString('id-ID'), done: false });
        showSuccess(data.ok);
    })
    .catch(function() {
        saveReportLocal({ id: Date.now(), type: currentType, game: game || '—', desc: desc, contact: contact, summary: desc, time: new Date().toLocaleString('id-ID'), done: false, offline: true });
        showSuccess(false, true);
    });
}

function showSuccess(ok, offline) {
    document.getElementById('modal-form').style.display = 'none';
    var s = document.getElementById('modal-success');
    s.classList.add('show');
    if (ok) {
        document.querySelector('.success-icon').textContent   = currentType === 'bug' ? '✅' : '💡';
        document.getElementById('success-title').textContent = currentType === 'bug' ? 'Bug Dilaporkan!' : 'Saran Terkirim!';
        document.getElementById('success-msg').textContent   = 'Terima kasih! Tim kami akan segera menangani laporanmu.';
    } else if (offline) {
        document.querySelector('.success-icon').textContent  = '📦';
        document.getElementById('success-title').textContent = 'Tersimpan Lokal';
        document.getElementById('success-msg').textContent   = 'Laporan tersimpan. Koneksi server bermasalah saat ini.';
    } else {
        document.querySelector('.success-icon').textContent  = '⚠️';
        document.getElementById('success-title').textContent = 'Gagal Mengirim';
        document.getElementById('success-msg').textContent   = 'Coba lagi nanti atau hubungi kami via Discord.';
    }
    setTimeout(closeModal, 3000);
}

function saveReportLocal(r) {
    try {
        var all = JSON.parse(localStorage.getItem('gs_reports') || '[]');
        all.unshift(r);
        localStorage.setItem('gs_reports', JSON.stringify(all.slice(0, 100)));
    } catch(e) {}
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', function() {
    buildQuick();
    initInput();
    sendWelcome();

    document.getElementById('modal-bg').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.getElementById('btn-report-top').addEventListener('click', function() {
        openModal('bug');
    });
    document.getElementById('r-submit').addEventListener('click', submitReport);
    document.getElementById('btn-open-bug').addEventListener('click', function() { openModal('bug'); });
    document.getElementById('btn-open-saran').addEventListener('click', function() { openModal('saran'); });
    document.querySelectorAll('.type-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            switchType(btn.getAttribute('data-type'));
        });
    });
});
