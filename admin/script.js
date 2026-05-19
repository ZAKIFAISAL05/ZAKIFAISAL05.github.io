// ============================================================
//  admin/script.js — Grid Survival Admin Panel
// ============================================================
'use strict';

/* ── SECURITY CONFIG ── */
const ADMIN_CREDENTIALS = {
    username: 'ZAKI',
    passHash: '821bc6e7ed5ec0007c1d7b88e8ffdd428df9ae1444325fd5c97a372773b31df4'
};
const MAX_ATTEMPTS     = 5;
const LOCKOUT_SECONDS  = 300;
const SESSION_MINUTES  = 60;
const SESSION_KEY      = 'gs_admin_session';
const ATTEMPT_KEY      = 'gs_admin_attempts';
const LOCKOUT_KEY      = 'gs_admin_lockout';
const GAMES_STORAGE    = 'gs_catalog_games';
const REPORT_STORE     = 'gs_reports';

/* ── CRYPTO / SESSION HELPERS ── */
async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function randToken() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}
function getAttempts()  { try { return JSON.parse(sessionStorage.getItem(ATTEMPT_KEY)) || { count: 0 }; } catch { return { count: 0 }; } }
function setAttempts(d) { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(d)); }
function isLockedOut()  { const l = sessionStorage.getItem(LOCKOUT_KEY); if (!l) return false; const r = parseInt(l) - Date.now(); return r > 0 ? Math.ceil(r / 1000) : false; }
function setLockout()   { sessionStorage.setItem(LOCKOUT_KEY, Date.now() + LOCKOUT_SECONDS * 1000); }
function getSession()   { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function setSession(user) {
    const s = { user, token: randToken(), exp: Date.now() + SESSION_MINUTES * 60 * 1000, loginAt: new Date().toLocaleTimeString('id-ID') };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
}
function clearSession() { sessionStorage.removeItem(SESSION_KEY); }
function isSessionValid() { const s = getSession(); return s && Date.now() < s.exp; }

/* ── ACTIVITY LOG ── */
const logLines = [];
function addLog(msg, type = 'evt') {
    const ts = new Date().toLocaleTimeString('id-ID', { hour12: false });
    logLines.push({ ts, msg, type });
    renderLog();
}
function renderLog() {
    const el = document.getElementById('activityLog');
    if (!el) return;
    el.innerHTML = logLines.slice(-30).reverse().map(l =>
        `<div class="log-line"><span class="ts">[${l.ts}]</span><span class="${l.type === 'warn' ? 'evt-warn' : l.type === 'err' ? 'evt-err' : 'evt'}">${escHtml(l.msg)}</span></div>`
    ).join('');
}
function escHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ── GAME CATALOG ── */
const DEFAULT_GAMES = [
    { id: 'minecraft-parkour-2d',       title: 'Minecraft Parkun 2D',          genre: 'Arcade',     desc: 'Petualangan parkour seru 2D terinspirasi Minecraft.',     icon: '../assets/img/mc_parkun_logo.png',       platforms: [{ name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/236072', cls: 'btn-taptap' }] },
    { id: 'the-one-for-zombie',          title: 'THE ONE FOR ZOMBIE',            genre: 'Action',     desc: 'Game aksi bertahan hidup melawan gerombolan zombie.',      icon: '../assets/img/one_zombie_logo.png',       platforms: [{ name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/346358', cls: 'btn-taptap' }] },
    { id: 'desa-karya-investasi-zombie', title: 'Desa Karya Investasi Zombie',   genre: 'Simulation', desc: 'Manajemen desa, investasi, dan pertahanan zombie.',         icon: '../assets/img/desa_invest_logo.png',      platforms: [{ name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33703520', cls: 'btn-taptap' }, { name: 'Itch.io', url: 'https://zakifaisalofficial.itch.io/desa-cipta-karya-invensi-zombie', cls: 'btn-itchio' }] },
    { id: 'gerbang-parkun-2d',           title: 'Gerbang Parkun 2D',             genre: 'Platformer', desc: 'Parkour 2D kompetitif dengan speedrun challenge.',           icon: '../assets/img/gerbang_parkun_logo.png',   platforms: [{ name: 'Itch.io', url: 'https://zakifaisalofficial.itch.io/gerbang-parkun-2d', cls: 'btn-itchio' }, { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33618770', cls: 'btn-taptap' }] },
    { id: 'desa-cipta-karya-ch2',        title: 'Desa Cipta Karya Chapter 2',    genre: 'Simulation', desc: 'Kelanjutan simulasi pembangunan desa.',                     icon: '../assets/img/cipta_karya2_logo.png',     platforms: [{ name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33752652', cls: 'btn-taptap' }, { name: 'Itch.io', url: 'https://zakifaisalofficial.itch.io/desa-karya-chapter-2', cls: 'btn-itchio' }] },
    { id: 'the-undeads-roblox',          title: 'The Undeads (Roblox)',          genre: 'Survival',   desc: 'Game survival zombie populer di Roblox.',                   icon: '../assets/img/undeads_roblox_logo.png',   platforms: [{ name: 'Play on Roblox', url: 'https://www.roblox.com/share?code=e4fd841cb9108b43bc5d7e7d9b47a2b3', cls: 'btn-roblox' }] },
    { id: 'frequency-fury-obby',         title: 'Frequency Fury Obby (Roblox)', genre: 'Arcade',     desc: 'Obby parkour menantang di Roblox.',                         icon: '../assets/img/frequency_fury_logo.png',   platforms: [{ name: 'Play on Roblox', url: 'https://www.roblox.com/id/games/113175281404228/Frequency-Fury-Obby', cls: 'btn-roblox' }] }
];

function loadGames() { try { const s = localStorage.getItem(GAMES_STORAGE); if (s) return JSON.parse(s); } catch {} saveGames(DEFAULT_GAMES); return DEFAULT_GAMES; }
function saveGames(g) { localStorage.setItem(GAMES_STORAGE, JSON.stringify(g)); }
function getGames()   { return loadGames(); }

/* ── ICON UPLOAD ── */
let pendingIconDataUrl = '';
function handleIconUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showAlert('File terlalu besar (maks 2MB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
        pendingIconDataUrl = ev.target.result;
        document.getElementById('iconPreview').innerHTML = `<img src="${pendingIconDataUrl}" alt="preview">`;
    };
    reader.readAsDataURL(file);
}

/* ── PLATFORM BUILDER ── */
let platformRowCount = 1;
const PNAMES = { 'btn-taptap': 'TapTap', 'btn-itchio': 'Itch.io', 'btn-roblox': 'Roblox', 'btn-amazon': 'Amazon', 'btn-gplay': 'Google Play', 'btn-steam': 'Steam' };

function platformSelectHTML() {
    return `<select class="p-type">
        <option value="btn-taptap">TapTap</option>
        <option value="btn-itchio">Itch.io</option>
        <option value="btn-roblox">Roblox</option>
        <option value="btn-amazon">Amazon</option>
        <option value="btn-gplay">Google Play</option>
        <option value="btn-steam">Steam</option>
    </select>`;
}
function addPlatformRow() {
    const id  = 'prow-' + platformRowCount++;
    const row = document.createElement('div');
    row.className = 'platform-row';
    row.id = id;
    row.innerHTML = `${platformSelectHTML()}<input class="p-url" type="url" placeholder="https://..."><button class="btn-rm-platform" onclick="removePlatform('${id}')" title="Hapus">×</button>`;
    document.getElementById('platformBuilder').appendChild(row);
}
function removePlatform(id) { const el = document.getElementById(id); if (el) el.remove(); }

function collectPlatforms() {
    const rows   = document.querySelectorAll('#platformBuilder .platform-row');
    const result = [];
    rows.forEach(row => {
        const cls = row.querySelector('.p-type').value;
        const url = row.querySelector('.p-url').value.trim();
        if (url) result.push({ name: PNAMES[cls] || cls, url, cls });
    });
    return result;
}

/* ── ADD GAME ── */
function submitAddGame() {
    const title     = document.getElementById('fg-title').value.trim();
    const genre     = document.getElementById('fg-genre').value;
    const desc      = document.getElementById('fg-desc').value.trim();
    const platforms = collectPlatforms();

    if (!title) { showAlert('Judul game wajib diisi!', 'error'); return; }
    if (!genre) { showAlert('Pilih genre game!', 'error'); return; }

    const games = getGames();
    const id    = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (games.find(g => g.id === id)) { showAlert('Game dengan judul ini sudah ada!', 'error'); return; }

    games.push({ id, title, genre, desc: desc || 'Game baru dari Grid Survival.', icon: pendingIconDataUrl || '', platforms });
    saveGames(games);
    showAlert(`Game "${title}" berhasil ditambahkan!`, 'success');
    addLog(`GAME ADDED — "${title}" | Genre: ${genre}`);

    // Reset form
    document.getElementById('fg-title').value = '';
    document.getElementById('fg-genre').value = '';
    document.getElementById('fg-desc').value  = '';
    document.getElementById('iconPreview').innerHTML = '<i class="fas fa-gamepad"></i>';
    pendingIconDataUrl = '';
    document.getElementById('platformBuilder').innerHTML =
        `<div class="platform-row" id="prow-0">${platformSelectHTML()}<input class="p-url" type="url" placeholder="https://..."><button class="btn-rm-platform" onclick="removePlatform('prow-0')" title="Hapus">×</button></div>`;
    platformRowCount = 1;
    renderGameTable();
    updateStats();
}

/* ── DELETE GAME ── */
let pendingDeleteId = null;
function confirmDelete(id, title) {
    pendingDeleteId = id;
    document.getElementById('confirmMsg').textContent = `Hapus game "${title}" dari katalog?`;
    document.getElementById('confirmOverlay').classList.add('show');
    document.getElementById('confirmYes').onclick = () => { deleteGame(pendingDeleteId); closeConfirm(); };
}
function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('show'); pendingDeleteId = null; }
function deleteGame(id) {
    let games = getGames();
    const game = games.find(g => g.id === id);
    if (!game) return;
    games = games.filter(g => g.id !== id);
    saveGames(games);
    addLog(`GAME DELETED — "${game.title}"`, 'warn');
    showAlert(`Game "${game.title}" dihapus.`, 'success');
    renderGameTable();
    updateStats();
}

/* ── ALERTS ── */
function showAlert(msg, type) {
    const el = document.getElementById('alertBox');
    el.textContent = msg;
    el.className = `alert ${type} show`;
    setTimeout(() => el.classList.remove('show'), 4000);
}

/* ── RENDER TABLE ── */
const GENRE_BADGE = { 'Arcade': 'badge-arcade', 'Action': 'badge-action', 'Simulation': 'badge-sim', 'Platformer': 'badge-platform', 'Survival': 'badge-survival' };

function renderGameTable() {
    const tbody = document.getElementById('gameTableBody');
    const games = getGames();
    if (!games.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">Belum ada game.</td></tr>';
        return;
    }
    tbody.innerHTML = games.map((g, i) => `<tr>
        <td style="color:var(--c-cyan);font-family:var(--font-title);font-size:0.85em;">${String(i + 1).padStart(2, '0')}</td>
        <td>${g.icon
            ? `<img src="${escHtml(g.icon)}" class="game-icon-cell" alt="${escHtml(g.title)}">`
            : `<span class="game-icon-placeholder"><i class="fas fa-gamepad"></i></span>`}</td>
        <td style="font-weight:700;">${escHtml(g.title)}</td>
        <td><span class="badge ${GENRE_BADGE[g.genre] || 'custom-badge'}">${escHtml(g.genre)}</span></td>
        <td>${g.platforms.map(p => `<span style="margin-right:6px;color:var(--text-muted);font-size:0.88em;">${escHtml(p.name)}</span>`).join('') || '—'}</td>
        <td>
            <a href="../index.html" target="_blank" class="btn-small">VIEW</a>
            <button class="btn-delete" onclick="confirmDelete('${escHtml(g.id)}','${escHtml(g.title).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">HAPUS</button>
        </td>
    </tr>`).join('');
}

/* ── STATS ── */
function updateStats() {
    const games = getGames();
    document.getElementById('statTotal').textContent     = games.length;
    document.getElementById('statRoblox').textContent    = games.filter(g => g.platforms.some(p => p.cls === 'btn-roblox')).length;
    const plats = new Set(games.flatMap(g => g.platforms.map(p => p.cls)));
    document.getElementById('statPlatforms').textContent = plats.size || 0;
}

/* ── EXPORT ── */
function exportGameData() {
    const games  = getGames();
    const mapped = games.map(g => ({
        id: g.id, title: g.title,
        logo:  g.icon && g.icon.startsWith('data:') ? g.icon : (g.icon || 'assets/img/studio_logo.png'),
        thumb: g.icon && g.icon.startsWith('data:') ? g.icon : (g.icon || 'assets/img/studio_logo.png'),
        desc: g.desc, genre: g.genre, gallery: [], platforms: g.platforms, developer: 'Grid Survival'
    }));
    const jsContent = `// assets/js/gameData.js\n// Auto-generated from Admin Panel — ${new Date().toLocaleString('id-ID')}\n\nconst gameData = ${JSON.stringify(mapped, null, 4)};\n`;
    const blob = new Blob([jsContent], { type: 'text/javascript' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'gameData.js'; a.click();
    URL.revokeObjectURL(url);
    addLog('EXPORTED gameData.js — ' + games.length + ' games');
    showAlert('gameData.js diexport! Upload ke assets/js/ di website.', 'success');
}

/* ── LOGIN ── */
async function doLogin() {
    const errEl = document.getElementById('loginErr');
    const attEl = document.getElementById('loginAttempts');
    const btnEl = document.getElementById('loginBtn');
    errEl.textContent = '';

    const remaining = isLockedOut();
    if (remaining) { showLockout(remaining); return; }

    const user = document.getElementById('adminUser').value.trim();
    const pass = document.getElementById('adminPass').value;
    if (!user || !pass) { errEl.textContent = 'Username dan password wajib diisi!'; return; }

    btnEl.disabled    = true;
    btnEl.textContent = 'Mengautentikasi...';

    try {
        const hash     = await sha256(pass);
        const attempts = getAttempts();
        if (user === ADMIN_CREDENTIALS.username && hash === ADMIN_CREDENTIALS.passHash) {
            setAttempts({ count: 0 });
            sessionStorage.removeItem(LOCKOUT_KEY);
            const sess = setSession(user);
            addLog(`LOGIN OK — user: ${user} | session: ${sess.token.slice(0, 8)}…`);
            showAdmin(sess);
        } else {
            attempts.count = (attempts.count || 0) + 1;
            setAttempts(attempts);
            const left = MAX_ATTEMPTS - attempts.count;
            addLog(`LOGIN FAILED — user: ${user} | attempt ${attempts.count}/${MAX_ATTEMPTS}`, 'warn');
            if (attempts.count >= MAX_ATTEMPTS) {
                setLockout(); setAttempts({ count: 0 });
                addLog('ACCOUNT LOCKED', 'err');
                showLockout(LOCKOUT_SECONDS);
            } else {
                errEl.textContent = `Akses ditolak — ${left} percobaan tersisa`;
                attEl.textContent = `${attempts.count}/${MAX_ATTEMPTS} percobaan`;
            }
        }
    } catch(e) {
        errEl.textContent = 'Terjadi kesalahan sistem. Coba lagi.';
        console.error(e);
    } finally {
        btnEl.disabled    = false;
        btnEl.textContent = 'Masuk ke Panel';
        document.getElementById('adminPass').value = '';
    }
}

function showLockout(seconds) {
    const lockEl = document.getElementById('lockoutMsg');
    const btnEl  = document.getElementById('loginBtn');
    const errEl  = document.getElementById('loginErr');
    errEl.textContent = '';
    btnEl.disabled    = true;
    let remaining     = seconds;
    lockEl.style.display = 'block';
    const tick = () => {
        const m = String(Math.floor(remaining / 60)).padStart(2, '0');
        const s = String(remaining % 60).padStart(2, '0');
        lockEl.textContent = `⛔ Akun terkunci — tunggu ${m}:${s}`;
        if (remaining-- > 0) setTimeout(tick, 1000);
        else { lockEl.style.display = 'none'; btnEl.disabled = false; document.getElementById('loginAttempts').textContent = ''; }
    };
    tick();
}

function showAdmin(sess) {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('adminWrap').classList.add('show');
    document.getElementById('adminUserDisplay').textContent = sess.user.toUpperCase();
    document.getElementById('sessionId').textContent        = sess.token.slice(0, 12) + '…';
    document.getElementById('loginTime').textContent        = sess.loginAt;
    renderGameTable();
    updateStats();
    startSessionTimer(sess);
    startAdminCharAnim();
    renderReports();
    addLog('Admin panel loaded — Game catalog ready');
    addLog(`Session expires in ${SESSION_MINUTES} minutes`);
}

function doLogout() { addLog('LOGOUT — session terminated', 'warn'); clearSession(); location.reload(); }

function startSessionTimer(sess) {
    const timerEl  = document.getElementById('sessionTimer');
    const interval = setInterval(() => {
        const remaining = Math.max(0, sess.exp - Date.now());
        if (remaining === 0) {
            clearInterval(interval);
            addLog('SESSION EXPIRED — auto logout', 'err');
            setTimeout(() => { clearSession(); location.reload(); }, 2000);
            return;
        }
        const m = String(Math.floor(remaining / 60000)).padStart(2, '0');
        const s = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }, 1000);
}

/* ── PIXEL CHAR IN NAV ── */
function startAdminCharAnim() {
    const canvas = document.getElementById('adminCharCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const SC  = 3;
    const C   = { _: null, S: '#f5c88a', H: '#5a3e1b', G: '#2a7a3a', T: '#1a5a2a', R: '#9b59b6', B: '#3a2a1a', D: '#8b6b4a', N: '#1a1d2e' };
    const frames = [
        [[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.H,C.S,C.S,C.H,C.N],[C.N,C.S,C.R,C.S,C.S,C.N],[C.N,C.S,C.S,C.S,C.S,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.G,C.G,C.G,C.G,C.N],[C.N,C.T,C.G,C.G,C.T,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C._,C.B,C.N,C.N,C.B,C._],[C.N,C.D,C.N,C.N,C.D,C.N]],
        [[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.H,C.S,C.S,C.H,C.N],[C.N,C.S,C.S,C.S,C.R,C.N],[C.N,C.S,C.S,C.S,C.S,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.G,C.G,C.G,C.G,C.N],[C.N,C.T,C.G,C.G,C.T,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C._,C.B,C.N,C.N,C.B,C._],[C._,C.N,C.D,C.D,C.N,C._]]
    ];
    function draw(f) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frames[f].forEach((row, ry) => row.forEach((color, rx) => {
            if (!color) return;
            ctx.fillStyle = color;
            ctx.fillRect(rx * SC, ry * SC, SC, SC);
        }));
    }
    let f = 0;
    setInterval(() => { draw(f); f = (f + 1) % 2; }, 250);
}

/* ── REPORTS ── */
function getReports()       { try { return JSON.parse(localStorage.getItem(REPORT_STORE)) || []; } catch { return []; } }
function saveReports(arr)   { localStorage.setItem(REPORT_STORE, JSON.stringify(arr)); }

function renderReports() {
    const panel   = document.getElementById('reports-panel');
    const countEl = document.getElementById('reportCount');
    if (!panel) return;
    const all = getReports();
    if (countEl) countEl.textContent = `${all.length} laporan (${all.filter(r => !r.done).length} belum selesai)`;
    if (!all.length) { panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-weight:600;">Belum ada laporan.</div>'; return; }
    panel.innerHTML = all.map(r => `
<div style="background:var(--bg-card);border:2px solid rgba(155,89,182,0.2);border-radius:var(--border-r);padding:18px;margin-bottom:12px;${r.done ? 'opacity:0.55;' : ''}">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
        <span style="font-family:var(--font-title);font-size:0.9em;color:${r.type === 'bug' ? 'var(--c-red)' : 'var(--c-yellow)'};">${r.type === 'bug' ? '🐛 BUG' : '💡 SARAN'}</span>
        <span style="font-weight:700;color:var(--text-dark);">${escHtml(r.game || '—')}</span>
        ${r.offline ? '<span style="font-size:0.75em;color:var(--c-yellow);border:1px solid var(--c-yellow);border-radius:6px;padding:2px 8px;font-weight:700;">OFFLINE</span>' : ''}
        ${r.done    ? '<span style="font-size:0.75em;color:var(--c-green);border:1px solid var(--c-green);border-radius:6px;padding:2px 8px;font-weight:700;">✓ SELESAI</span>' : ''}
        <span style="margin-left:auto;font-size:0.8em;color:var(--text-muted);">${escHtml(r.time || '')}</span>
    </div>
    <div style="color:var(--text-dark);margin-bottom:6px;font-size:0.93em;">📝 ${escHtml(r.desc)}</div>
    ${r.summary && r.summary !== r.desc ? `<div style="color:var(--c-cyan);margin-bottom:6px;font-size:0.88em;">🤖 AI: ${escHtml(r.summary)}</div>` : ''}
    ${r.contact ? `<div style="color:var(--text-muted);margin-bottom:10px;font-size:0.85em;">📱 Kontak: ${escHtml(r.contact)}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:10px;">
        ${!r.done ? `<button class="btn-small" onclick="markReportDone(${r.id})">✓ Tandai Selesai</button>` : ''}
        <button class="btn-delete" onclick="deleteReport(${r.id})">🗑 Hapus</button>
    </div>
</div>`).join('');
}

function markReportDone(id) {
    const all = getReports().map(r => r.id === id ? { ...r, done: true } : r);
    saveReports(all); addLog(`Report #${id} ditandai selesai`); renderReports();
}
function deleteReport(id) {
    const r   = getReports().find(x => x.id === id);
    const all = getReports().filter(x => x.id !== id);
    saveReports(all); addLog(`Report dihapus — ${r ? r.type + ': ' + r.game : '#' + id}`, 'warn'); renderReports();
}
function clearDoneReports() {
    const all = getReports().filter(r => !r.done);
    saveReports(all); addLog('Semua laporan selesai dihapus'); renderReports();
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', function() {
    ['adminUser', 'adminPass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    });

    const remaining = isLockedOut();
    if (remaining) showLockout(remaining);

    if (isSessionValid()) {
        const sess = getSession();
        addLog(`Session restored — user: ${sess.user}`);
        showAdmin(sess);
    } else {
        clearSession();
        addLog('Admin panel initialized — awaiting authentication');
    }

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) || (e.ctrlKey && e.key === 'U'))
            e.preventDefault();
    });
});
