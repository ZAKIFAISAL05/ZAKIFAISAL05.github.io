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
var ttsEnabled      = true;
var soundEnabled    = true;

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

/* ── NOTIF SUARA (ping) ── */
function playPing() {
    if (!soundEnabled) return;
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
    } catch(e) {}
}

/* ── TEXT TO SPEECH ── */
function speakText(text) {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var plain = text
        .replace(/<[^>]+>/g, '')
        .replace(/\*\*?([^*]+)\*\*?/g, '$1')
        .replace(/\n/g, ' ')
        .trim();
    if (!plain) return;
    var utt = new SpeechSynthesisUtterance(plain);
    utt.lang = 'id-ID';
    utt.rate = 1.05;
    utt.pitch = 1.0;
    // Cari suara Indonesia kalau ada
    var voices = window.speechSynthesis.getVoices();
    var idVoice = voices.find(function(v) { return v.lang.startsWith('id'); });
    if (idVoice) utt.voice = idVoice;
    window.speechSynthesis.speak(utt);
}

/* ── TOGGLE CONTROLS ── */
function initToggles() {
    var btnTts   = document.getElementById('btn-tts');
    var btnSound = document.getElementById('btn-sound');
    if (btnTts) {
        btnTts.addEventListener('click', function() {
            ttsEnabled = !ttsEnabled;
            btnTts.title = ttsEnabled ? 'TTS Aktif' : 'TTS Mati';
            btnTts.style.opacity = ttsEnabled ? '1' : '0.4';
            if (!ttsEnabled) window.speechSynthesis && window.speechSynthesis.cancel();
        });
    }
    if (btnSound) {
        btnSound.addEventListener('click', function() {
            soundEnabled = !soundEnabled;
            btnSound.title = soundEnabled ? 'Suara Aktif' : 'Suara Mati';
            btnSound.style.opacity = soundEnabled ? '1' : '0.4';
        });
    }
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

    // Tombol putar ulang TTS untuk pesan bot
    var ttsBtn = role === 'bot'
        ? '<button class="tts-replay" title="Putar suara" onclick="speakText(\'' + text.replace(/'/g, "\\'").replace(/\n/g,' ') + '\')">🔊</button>'
        : '';

    row.innerHTML =
        avatarHtml +
        '<div class="msg-content">' +
            nameHtml +
            '<div class="msg-bubble">' + formatted + '</div>' +
            '<div class="msg-meta"><span class="msg-time">' + (time || now()) + '</span>' + ttsBtn + '</div>' +
        '</div>';

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;

    if (role === 'bot') {
        playPing();
        speakText(text);
    }
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
            'Halo! 👋 Selamat datang di **Customer Service Grid Survival**.\n\n' +
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
            history: chatHistory.slice(-10).map(function(h) {
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
        if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);
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

/* ── GENERATE TICKET NUMBER ── */
function generateTicket() {
    var ts   = Date.now().toString(36).toUpperCase();
    var rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return 'GS-' + ts + rand;
}

/* ── REPORT MODAL ── */
function openModal(type) {
    currentType = type || 'bug';
    switchType(currentType);
    document.getElementById('modal-form').style.display    = 'block';
    document.getElementById('modal-success').classList.remove('show');
    document.getElementById('r-desc').value    = '';
    document.getElementById('r-contact').value = '';
    document.getElementById('r-email').value   = '';
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
    var email   = document.getElementById('r-email').value.trim();
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

    var ticketId = generateTicket();
    btn.disabled    = true;
    btn.textContent = 'Mengirim...';

    fetch(REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: currentType, game: game, desc: desc, contact: contact, email: email, ticketId: ticketId })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        saveReportLocal({ id: ticketId, type: currentType, game: game || '—', desc: desc, contact: contact, email: email, summary: data.summary || desc, time: new Date().toLocaleString('id-ID'), done: false });
        showSuccess(data.ok, false, ticketId, !!email);
    })
    .catch(function() {
        saveReportLocal({ id: ticketId, type: currentType, game: game || '—', desc: desc, contact: contact, email: email, summary: desc, time: new Date().toLocaleString('id-ID'), done: false, offline: true });
        showSuccess(false, true, ticketId, false);
    });
}

function showSuccess(ok, offline, ticketId, hasEmail) {
    document.getElementById('modal-form').style.display = 'none';
    var s = document.getElementById('modal-success');
    s.classList.add('show');

    var ticketBox  = document.getElementById('ticket-box');
    var ticketNum  = document.getElementById('ticket-number');
    var ticketNote = document.getElementById('ticket-note');

    if (ok) {
        document.querySelector('.success-icon').textContent   = currentType === 'bug' ? '✅' : '💡';
        document.getElementById('success-title').textContent = currentType === 'bug' ? 'Bug Dilaporkan!' : 'Saran Terkirim!';
        document.getElementById('success-msg').textContent   = 'Terima kasih! Tim kami akan segera menangani laporanmu.';
        if (ticketId) {
            ticketBox.style.display = 'flex';
            ticketNum.textContent   = '#' + ticketId;
            ticketNote.textContent  = hasEmail
                ? 'Konfirmasi dikirim ke email kamu. Simpan nomor ini untuk follow-up.'
                : 'Simpan nomor tiket ini untuk follow-up ke tim kami.';
        }
    } else if (offline) {
        document.querySelector('.success-icon').textContent  = '📦';
        document.getElementById('success-title').textContent = 'Tersimpan Lokal';
        document.getElementById('success-msg').textContent   = 'Laporan tersimpan. Koneksi server bermasalah saat ini.';
        if (ticketId) {
            ticketBox.style.display = 'flex';
            ticketNum.textContent   = '#' + ticketId;
            ticketNote.textContent  = 'Nomor tiket lokal — ulangi kirim saat online.';
        }
    } else {
        document.querySelector('.success-icon').textContent  = '⚠️';
        document.getElementById('success-title').textContent = 'Gagal Mengirim';
        document.getElementById('success-msg').textContent   = 'Coba lagi nanti atau hubungi kami via Discord.';
    }
    setTimeout(closeModal, 5000);
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
    initToggles();
    sendWelcome();

    // Load voices (TTS Chrome butuh ini)
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = function() {
            window.speechSynthesis.getVoices();
        };
    }

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
    var closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
});
