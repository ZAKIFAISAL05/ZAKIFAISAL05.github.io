// ============================================================
//  cs/script.js — Grid Survival Customer Service Chat
//  CS bisa langsung handle laporan bug/saran + upload bukti
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
var pendingFiles    = []; // file yg mau dikirim bareng pesan

// Mode laporan via chat (null = normal, 'bug' = lagi ngumpulin info bug, 'saran' = saran)
var reportMode      = null;
var reportData      = {};

var QUICK = [
    { label: 'Info game apa saja?',  text: 'Ceritain dong game-game dari Grid Survival!' },
    { label: 'Cara download game',   text: 'Gimana cara download game kalian?' },
    { label: 'Kontak tim',           text: 'Gimana cara menghubungi tim Grid Survival?' },
    { label: 'Siapa Grid Survival?', text: 'Ceritain dong tentang studio Grid Survival!' },
];

/* ── TIME ── */
function now() {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/* ── NOTIF SUARA ── */
function playPing() {
    if (!soundEnabled) return;
    try {
        var ctx  = new (window.AudioContext || window.webkitAudioContext)();
        var osc  = ctx.createOscillator();
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

/* ── TTS ── */
function speakText(text) {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var plain = text.replace(/<[^>]+>/g, '').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/\n/g, ' ').trim();
    if (!plain) return;
    var utt  = new SpeechSynthesisUtterance(plain);
    utt.lang = 'id-ID'; utt.rate = 1.05; utt.pitch = 1.0;
    var voices   = window.speechSynthesis.getVoices();
    var idVoice  = voices.find(function(v) { return v.lang.startsWith('id'); });
    if (idVoice) utt.voice = idVoice;
    window.speechSynthesis.speak(utt);
}

/* ── TOGGLE ── */
function initToggles() {
    var btnTts   = document.getElementById('btn-tts');
    var btnSound = document.getElementById('btn-sound');
    if (btnTts) {
        btnTts.addEventListener('click', function() {
            ttsEnabled = !ttsEnabled;
            btnTts.title   = ttsEnabled ? 'TTS Aktif' : 'TTS Mati';
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
function addMsg(role, text, time, mediaList) {
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

    var ttsBtn = role === 'bot'
        ? '<button class="tts-replay" title="Putar suara" onclick="speakText(\'' + text.replace(/'/g, "\\'").replace(/\n/g,' ') + '\')">▶</button>'
        : '';

    // Media preview dalam bubble
    var mediaHtml = '';
    if (mediaList && mediaList.length) {
        mediaHtml = '<div class="bubble-media">';
        mediaList.forEach(function(m) {
            if (m.type === 'image') {
                mediaHtml += '<img class="bubble-img" src="' + m.url + '" alt="bukti" onclick="openLightbox(\'' + m.url + '\')">';
            } else if (m.type === 'video') {
                mediaHtml += '<video class="bubble-video" src="' + m.url + '" controls></video>';
            }
        });
        mediaHtml += '</div>';
    }

    row.innerHTML =
        avatarHtml +
        '<div class="msg-content">' +
            nameHtml +
            '<div class="msg-bubble">' + formatted + mediaHtml + '</div>' +
            '<div class="msg-meta"><span class="msg-time">' + (time || now()) + '</span>' + ttsBtn + '</div>' +
        '</div>';

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;

    if (role === 'bot') { playPing(); speakText(text); }
}

/* ── LIGHTBOX untuk gambar ── */
function openLightbox(src) {
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<img src="' + src + '" alt="bukti"><button class="lb-close" onclick="this.parentNode.remove()">✕</button>';
    lb.addEventListener('click', function(e) { if (e.target === lb) lb.remove(); });
    document.body.appendChild(lb);
}

/* ── TYPING ── */
function showTyping() {
    var msgs = document.getElementById('messages');
    var row  = document.createElement('div');
    row.className = 'typing-row'; row.id = 'typing-row';
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
        btn.onclick = function() { sendMsg(q.text); hideQuickArea(); };
        area.appendChild(btn);
    });
}
function hideQuickArea() {
    var qa = document.getElementById('quick-area');
    if (qa) qa.style.display = 'none';
}

/* ── WELCOME ── */
function sendWelcome() {
    setTimeout(function() {
        addMsg('bot',
            'Halo! Selamat datang di **Customer Service Grid Survival**.\n\n' +
            'Ada yang bisa aku bantu? Kamu bisa tanya info game, cara download, atau lapor bug dan kirim saran langsung di sini — ' +
            'aku yang akan terusin ke tim developer!',
            now()
        );
    }, 600);
}

/* ── FILE HANDLING (chat input) ── */
function initFileInput() {
    var fileInput    = document.getElementById('file-input');
    var previewBar   = document.getElementById('upload-preview-bar');
    var previewInner = document.getElementById('upload-preview-inner');
    var clearBtn     = document.getElementById('upload-clear-btn');

    fileInput.addEventListener('change', function() {
        var files = Array.from(fileInput.files);
        files.forEach(function(f) {
            if (pendingFiles.length >= 5) return; // maks 5 file
            pendingFiles.push(f);
        });
        fileInput.value = '';
        renderPendingPreviews();
    });

    clearBtn.addEventListener('click', function() {
        pendingFiles = [];
        renderPendingPreviews();
    });
}

function renderPendingPreviews() {
    var bar   = document.getElementById('upload-preview-bar');
    var inner = document.getElementById('upload-preview-inner');
    inner.innerHTML = '';
    if (!pendingFiles.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    pendingFiles.forEach(function(f, i) {
        var item = document.createElement('div');
        item.className = 'preview-item';
        var url  = URL.createObjectURL(f);
        if (f.type.startsWith('image/')) {
            item.innerHTML = '<img src="' + url + '" alt="' + f.name + '">' +
                '<button class="preview-remove" data-i="' + i + '">✕</button>';
        } else {
            item.innerHTML = '<div class="preview-video-icon">' +
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
                '<span>' + f.name.slice(0,12) + (f.name.length > 12 ? '…' : '') + '</span></div>' +
                '<button class="preview-remove" data-i="' + i + '">✕</button>';
        }
        inner.appendChild(item);
    });
    inner.querySelectorAll('.preview-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            pendingFiles.splice(parseInt(btn.getAttribute('data-i')), 1);
            renderPendingPreviews();
        });
    });
}

/* ── Konversi file ke base64 ── */
function fileToBase64(file) {
    return new Promise(function(resolve, reject) {
        var r = new FileReader();
        r.onload  = function() { resolve(r.result.split(',')[1]); };
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

/* ── SEND MSG ── */
function sendMsg(text, forcedFiles) {
    var files = forcedFiles || pendingFiles.slice();
    if ((!text || !text.trim()) && !files.length) return;
    if (isWaiting) return;

    text = (text || '').trim();

    // Buat object URL untuk preview lokal
    var mediaList = files.map(function(f) {
        return { type: f.type.startsWith('image/') ? 'image' : 'video', url: URL.createObjectURL(f), file: f };
    });

    addMsg('user', text, now(), mediaList);
    chatHistory.push({ role: 'user', text: text + (files.length ? '\n[Melampirkan ' + files.length + ' file bukti]' : '') });

    var inp = document.getElementById('msg-input');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }

    // Reset pending files
    pendingFiles = [];
    renderPendingPreviews();

    isWaiting = true;
    document.getElementById('send-btn').disabled = true;
    showTyping();

    // Konversi file ke base64 kalau ada
    var filePromises = mediaList.map(function(m) {
        return fileToBase64(m.file).then(function(b64) {
            return { name: m.file.name, type: m.file.type, base64: b64 };
        });
    });

    Promise.all(filePromises).then(function(attachments) {
        return fetch(CS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                from: 'Pengunjung Web',
                userId: sessionId,
                history: chatHistory.slice(-10).map(function(h) {
                    return { role: h.role === 'bot' ? 'model' : 'user', text: h.text };
                }),
                attachments: attachments,
                reportMode: reportMode,
                reportData: reportData
            })
        });
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        hideTyping();
        isWaiting = false;
        document.getElementById('send-btn').disabled = false;

        if (data.rateLimited) {
            addMsg('bot', 'Sabar ya, tunggu beberapa detik sebelum kirim pesan lagi.', now());
            return;
        }

        var reply = (data.reply || 'Maaf, coba lagi ya!').trim();
        addMsg('bot', reply, now());
        chatHistory.push({ role: 'bot', text: reply });
        if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

        // Cek kalau AI bilang laporan sudah dikirim ke developer
        if (data.reportSubmitted && data.reportPayload) {
            submitReportFromChat(data.reportPayload);
        }
    })
    .catch(function() {
        hideTyping();
        isWaiting = false;
        document.getElementById('send-btn').disabled = false;
        addMsg('bot', 'Koneksi bermasalah. Coba refresh halaman atau hubungi kami via Discord/Email ya.', now());
    });
}

/* ── Submit laporan ke backend dari chat ── */
function submitReportFromChat(payload) {
    var ticketId = 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
    fetch(REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, payload, { ticketId: ticketId }))
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        saveReportLocal({ id: ticketId, type: payload.type, game: payload.game || '—', desc: payload.desc, time: new Date().toLocaleString('id-ID'), done: false });
        if (data.ok) {
            addMsg('bot',
                'Laporan kamu sudah aku terusin ke tim developer dengan nomor tiket **#' + ticketId + '**.\n\n' +
                'Simpan nomor ini untuk follow-up ya' + (payload.email ? ' — konfirmasi juga dikirim ke emailmu.' : '.'),
                now()
            );
        }
    })
    .catch(function() {
        // Laporan gagal ke server, tapi sudah tersimpan lokal
    });
}

/* ── INPUT ── */
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

/* ── TICKET ── */
function generateTicket() {
    return 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

/* ── REPORT MODAL (untuk akses via tombol Bug di topbar) ── */
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
    document.getElementById('r-submit').textContent = currentType === 'bug' ? 'Kirim Laporan Bug' : 'Kirim Saran';
    document.getElementById('modal-upload-preview').innerHTML = '';
    document.getElementById('modal-bg').classList.add('open');
}
function closeModal() { document.getElementById('modal-bg').classList.remove('open'); }
function switchType(type) {
    currentType = type;
    document.querySelectorAll('.type-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-type') === type);
    });
    var isBug = type === 'bug';
    document.getElementById('modal-icon').className    = 'modal-icon ' + type;
    document.getElementById('modal-title').textContent = isBug ? 'Laporan Bug / Error' : 'Kirim Saran';
    document.getElementById('r-desc-label').textContent = isBug ? 'Deskripsi bug / error *' : 'Isi saran / masukan *';
    document.getElementById('r-desc').placeholder = isBug
        ? 'Ceritakan bug yang kamu temukan...'
        : 'Tulis saran atau masukan kamu...';
    document.getElementById('r-submit').textContent = isBug ? 'Kirim Laporan Bug' : 'Kirim Saran';
}

/* ── MODAL FILE UPLOAD ── */
var modalFiles = [];
function initModalFileInput() {
    var mInput   = document.getElementById('modal-file-input');
    var mPreview = document.getElementById('modal-upload-preview');
    if (!mInput) return;
    mInput.addEventListener('change', function() {
        Array.from(mInput.files).forEach(function(f) {
            if (modalFiles.length < 5) modalFiles.push(f);
        });
        mInput.value = '';
        renderModalPreviews();
    });
}
function renderModalPreviews() {
    var mPreview = document.getElementById('modal-upload-preview');
    mPreview.innerHTML = '';
    modalFiles.forEach(function(f, i) {
        var item = document.createElement('div');
        item.className = 'preview-item-sm';
        var url = URL.createObjectURL(f);
        if (f.type.startsWith('image/')) {
            item.innerHTML = '<img src="' + url + '" alt="' + f.name + '"><button class="preview-remove" data-i="' + i + '">✕</button>';
        } else {
            item.innerHTML = '<div class="preview-video-icon-sm">' + f.name.slice(0,10) + '…</div>' +
                '<button class="preview-remove" data-i="' + i + '">✕</button>';
        }
        mPreview.appendChild(item);
    });
    mPreview.querySelectorAll('.preview-remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            modalFiles.splice(parseInt(btn.getAttribute('data-i')), 1);
            renderModalPreviews();
        });
    });
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
        setTimeout(function() { descEl.style.borderColor = ''; descEl.style.boxShadow = ''; }, 2000);
        return;
    }

    var ticketId = generateTicket();
    btn.disabled    = true;
    btn.textContent = 'Mengirim...';

    // Konversi modalFiles ke base64
    var filePromises = modalFiles.map(function(f) {
        return fileToBase64(f).then(function(b64) {
            return { name: f.name, type: f.type, base64: b64 };
        });
    });

    Promise.all(filePromises).then(function(attachments) {
        return fetch(REPORT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: currentType, game: game, desc: desc, contact: contact, email: email, ticketId: ticketId, attachments: attachments })
        });
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        saveReportLocal({ id: ticketId, type: currentType, game: game || '—', desc: desc, contact: contact, email: email, summary: data.summary || desc, time: new Date().toLocaleString('id-ID'), done: false });
        showSuccess(data.ok, false, ticketId, !!email);
        modalFiles = [];
    })
    .catch(function() {
        saveReportLocal({ id: ticketId, type: currentType, game: game || '—', desc: desc, contact: contact, email: email, summary: desc, time: new Date().toLocaleString('id-ID'), done: false, offline: true });
        showSuccess(false, true, ticketId, false);
        modalFiles = [];
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
        document.getElementById('success-title').textContent = currentType === 'bug' ? 'Bug Dilaporkan!' : 'Saran Terkirim!';
        document.getElementById('success-msg').textContent   = 'Terima kasih! Tim kami akan segera menangani laporanmu.';
        if (ticketId) {
            ticketBox.style.display = 'flex';
            ticketNum.textContent   = '#' + ticketId;
            ticketNote.textContent  = hasEmail ? 'Konfirmasi dikirim ke email kamu. Simpan nomor ini.' : 'Simpan nomor tiket ini untuk follow-up.';
        }
    } else if (offline) {
        document.getElementById('success-title').textContent = 'Tersimpan Lokal';
        document.getElementById('success-msg').textContent   = 'Laporan tersimpan. Koneksi server bermasalah saat ini.';
        if (ticketId) { ticketBox.style.display = 'flex'; ticketNum.textContent = '#' + ticketId; ticketNote.textContent = 'Nomor tiket lokal.'; }
    } else {
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
    initFileInput();
    initModalFileInput();
    sendWelcome();

    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = function() { window.speechSynthesis.getVoices(); };
    }

    document.getElementById('modal-bg').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.getElementById('btn-report-top').addEventListener('click', function() { openModal('bug'); });
    document.getElementById('r-submit').addEventListener('click', submitReport);
    document.getElementById('btn-open-bug').addEventListener('click', function() {
        // Lapor bug langsung lewat chat
        hideQuickArea();
        addMsg('bot',
            'Oke, aku bantu lapor bug ke tim developer.\n\n' +
            'Ceritain dulu: **bug apa yang kamu temukan?** Kalau ada gambar atau video buktinya, bisa kamu kirim sekalian pakai tombol lampiran di bawah.',
            now()
        );
        reportMode = 'bug';
        reportData = {};
    });
    document.getElementById('btn-open-saran').addEventListener('click', function() {
        // Kirim saran langsung lewat chat
        hideQuickArea();
        addMsg('bot',
            'Oke, aku siap tampung saranmu untuk tim developer!\n\n' +
            '**Saran apa yang mau kamu kasih?** Boleh detail sebanyak-banyaknya ya — semua masukan sangat berharga.',
            now()
        );
        reportMode = 'saran';
        reportData = {};
    });

    document.querySelectorAll('.type-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchType(btn.getAttribute('data-type')); });
    });
    var closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
});
