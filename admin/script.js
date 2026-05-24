// ============================================================
//  admin/script.js — Grid Survival Admin Panel
//  Storage: Netlify Blobs via /.netlify/functions/games
//  Deploy ulang TIDAK menghapus data game
// ============================================================
'use strict';

const GAMES_API    = '/.netlify/functions/games';
const REPORT_STORE = 'gs_reports';

/* ── AUTH CONFIG ── */
const ADMIN_CREDENTIALS = {
  username: 'ZAKI',
  passHash: '821bc6e7ed5ec0007c1d7b88e8ffdd428df9ae1444325fd5c97a372773b31df4'
};
const MAX_ATTEMPTS    = 5;
const LOCKOUT_SECONDS = 300;
const SESSION_MINUTES = 60;
const SESSION_KEY     = 'gs_admin_session';
const ATTEMPT_KEY     = 'gs_admin_attempts';
const LOCKOUT_KEY     = 'gs_admin_lockout';

/* ── CRYPTO / SESSION ── */
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function randToken()      { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map(b => b.toString(16).padStart(2,'0')).join(''); }
function getAttempts()    { try { return JSON.parse(sessionStorage.getItem(ATTEMPT_KEY)) || {count:0}; } catch { return {count:0}; } }
function setAttempts(d)   { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(d)); }
function isLockedOut()    { const l = sessionStorage.getItem(LOCKOUT_KEY); if (!l) return false; const r = parseInt(l) - Date.now(); return r > 0 ? Math.ceil(r/1000) : false; }
function setLockout()     { sessionStorage.setItem(LOCKOUT_KEY, Date.now() + LOCKOUT_SECONDS * 1000); }
function getSession()     { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function setSession(user, pass) { const s = {user, token:randToken(), exp:Date.now()+SESSION_MINUTES*60*1000, loginAt:new Date().toLocaleTimeString('id-ID'), adminToken: pass || ''}; sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); return s; }
function clearSession()   { sessionStorage.removeItem(SESSION_KEY); }
function isSessionValid() { const s = getSession(); return s && Date.now() < s.exp; }

/* ── LOG ── */
const logLines = [];
function addLog(msg, type = 'evt') {
  const ts = new Date().toLocaleTimeString('id-ID', {hour12:false});
  logLines.push({ts, msg, type});
  renderLog();
}
function renderLog() {
  const el = document.getElementById('activityLog');
  if (!el) return;
  el.innerHTML = logLines.slice(-30).reverse().map(l =>
    `<div class="log-line"><span class="ts">[${l.ts}]</span><span class="${l.type==='warn'?'evt-warn':l.type==='err'?'evt-err':'evt'}">${escHtml(l.msg)}</span></div>`
  ).join('');
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ════════════════════════════════════════
   GAME CATALOG — SERVER-SIDE (Netlify Blobs)
   ════════════════════════════════════════ */

// Cache lokal supaya tidak fetch terus
let _gamesCache = null;

async function fetchGames(forceRefresh = false) {
  if (_gamesCache && !forceRefresh) return _gamesCache;
  try {
    const res  = await fetch(GAMES_API);
    const data = await res.json();
    if (data.ok) { _gamesCache = data.games; return data.games; }
    throw new Error(data.error || 'Gagal load games');
  } catch (e) {
    addLog('ERROR load games: ' + e.message, 'err');
    return _gamesCache || [];
  }
}

async function apiAddGame(game) {
  const res  = await fetch(GAMES_API, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'add', game})});
  const data = await res.json();
  if (data.ok) { _gamesCache = data.games; return data; }
  throw new Error(data.error || 'Gagal tambah game');
}

async function apiUpdateGame(game) {
  const res  = await fetch(GAMES_API, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'update', game})});
  const data = await res.json();
  if (data.ok) { _gamesCache = data.games; return data; }
  throw new Error(data.error || 'Gagal update game');
}

async function apiDeleteGame(id) {
  const res  = await fetch(GAMES_API, {method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id})});
  const data = await res.json();
  if (data.ok) { _gamesCache = data.games; return data; }
  throw new Error(data.error || 'Gagal hapus game');
}

async function apiReorderGames(games) {
  const res  = await fetch(GAMES_API, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({games})});
  const data = await res.json();
  if (data.ok) { _gamesCache = data.games; return data; }
  throw new Error(data.error || 'Gagal reorder');
}

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
const PNAMES = {'btn-taptap':'TapTap','btn-itchio':'Itch.io','btn-roblox':'Roblox','btn-amazon':'Amazon','btn-gplay':'Google Play','btn-steam':'Steam'};
function platformSelectHTML(selected = 'btn-taptap') {
  return Object.entries(PNAMES).map(([v,n]) =>
    `<option value="${v}"${v===selected?' selected':''}>${n}</option>`
  ).join('');
}
function addPlatformRow(cls = 'btn-taptap', url = '') {
  const id  = 'prow-' + platformRowCount++;
  const row = document.createElement('div');
  row.className = 'platform-row'; row.id = id;
  row.innerHTML = `<select class="p-type">${platformSelectHTML(cls)}</select><input class="p-url" type="url" placeholder="https://..." value="${escHtml(url)}"><button class="btn-rm-platform" onclick="removePlatform('${id}')" title="Hapus">×</button>`;
  document.getElementById('platformBuilder').appendChild(row);
}
function removePlatform(id) { const el = document.getElementById(id); if (el) el.remove(); }
function collectPlatforms() {
  return [...document.querySelectorAll('#platformBuilder .platform-row')].map(row => {
    const cls = row.querySelector('.p-type').value;
    const url = row.querySelector('.p-url').value.trim();
    return url ? {name: PNAMES[cls]||cls, url, cls} : null;
  }).filter(Boolean);
}

/* ── EDIT MODE ── */
let editingGameId = null;

function resetForm() {
  document.getElementById('fg-title').value = '';
  document.getElementById('fg-genre').value = '';
  document.getElementById('fg-desc').value  = '';
  document.getElementById('iconPreview').innerHTML = '<i class="fas fa-gamepad"></i>';
  pendingIconDataUrl = '';
  document.getElementById('platformBuilder').innerHTML =
    `<div class="platform-row" id="prow-0"><select class="p-type">${platformSelectHTML()}</select><input class="p-url" type="url" placeholder="https://..."><button class="btn-rm-platform" onclick="removePlatform('prow-0')" title="Hapus">×</button></div>`;
  platformRowCount = 1;
  editingGameId = null;
  document.getElementById('btn-add-game').textContent = '▶ Simpan Game ke Katalog';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  const formTitle = document.getElementById('formPanelTitle') || document.querySelector('.admin-section-title[data-form]');
  if (formTitle) formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Tambah Game Baru';
}

function editGame(id) {
  const game = _gamesCache.find(g => g.id === id);
  if (!game) return;
  editingGameId = id;

  document.getElementById('fg-title').value = game.title;
  document.getElementById('fg-genre').value = game.genre;
  document.getElementById('fg-desc').value  = game.desc || '';

  // icon
  if (game.icon) {
    pendingIconDataUrl = game.icon;
    document.getElementById('iconPreview').innerHTML = `<img src="${escHtml(game.icon)}" alt="preview">`;
  }

  // platforms
  document.getElementById('platformBuilder').innerHTML = '';
  platformRowCount = 0;
  if (game.platforms && game.platforms.length) {
    game.platforms.forEach(p => addPlatformRow(p.cls || 'btn-taptap', p.url));
  } else {
    addPlatformRow();
  }

  document.getElementById('btn-add-game').textContent = '💾 Update Game';
  document.getElementById('btn-cancel-edit').style.display = 'inline-block';
  const formTitle = document.getElementById('formPanelTitle') || document.querySelector('.admin-section-title[data-form]');
  if (formTitle) formTitle.innerHTML = `<i class="fas fa-pen-to-square"></i> Edit Game: ${escHtml(game.title)}`;
  document.querySelector('.add-form').scrollIntoView({behavior:'smooth', block:'start'});
}

/* ── SUBMIT ADD / UPDATE ── */
async function submitAddGame() {
  const title     = document.getElementById('fg-title').value.trim();
  const genre     = document.getElementById('fg-genre').value;
  const desc      = document.getElementById('fg-desc').value.trim();
  const platforms = collectPlatforms();
  const btn       = document.getElementById('btn-add-game');

  if (!title) { showAlert('Judul game wajib diisi!', 'error'); return; }
  if (!genre) { showAlert('Pilih genre game!', 'error');        return; }

  btn.disabled    = true;
  btn.textContent = editingGameId ? 'Menyimpan...' : 'Menambahkan...';

  try {
    const game = {
      id:        editingGameId || title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
      title, genre,
      desc:      desc || 'Game baru dari Grid Survival.',
      icon:      pendingIconDataUrl || (editingGameId ? (_gamesCache.find(g=>g.id===editingGameId)||{}).icon||'' : ''),
      platforms
    };

    if (editingGameId) {
      await apiUpdateGame(game);
      showAlert(`Game "${title}" berhasil diupdate!`, 'success');
      addLog(`GAME UPDATED — "${title}"`);
    } else {
      await apiAddGame(game);
      showAlert(`Game "${title}" berhasil ditambahkan!`, 'success');
      addLog(`GAME ADDED — "${title}" | Genre: ${genre}`);
    }

    resetForm();
    await renderGameTable();
    updateStats();
  } catch (e) {
    showAlert(e.message, 'error');
    addLog('ERROR: ' + e.message, 'err');
  } finally {
    btn.disabled    = false;
    btn.textContent = editingGameId ? '💾 Update Game' : '▶ Simpan Game ke Katalog';
  }
}

/* ── DELETE ── */
let pendingDeleteId = null;
function confirmDelete(id, title) {
  pendingDeleteId = id;
  document.getElementById('confirmMsg').textContent = `Hapus game "${title}" dari katalog?`;
  const ov = document.getElementById('confirmOverlay');
  ov.classList.add('show'); ov.classList.add('visible');
  document.getElementById('confirmYes').onclick = () => { doDeleteGame(pendingDeleteId, title); closeConfirm(); };
}
function closeConfirm() {
  const ov = document.getElementById('confirmOverlay');
  ov.classList.remove('show'); ov.classList.remove('visible');
  pendingDeleteId = null;
}

async function doDeleteGame(id, title) {
  try {
    await apiDeleteGame(id);
    addLog(`GAME DELETED — "${title}"`, 'warn');
    showAlert(`Game "${title}" berhasil dihapus.`, 'success');
    await renderGameTable();
    updateStats();
  } catch (e) {
    showAlert('Gagal hapus: ' + e.message, 'error');
    addLog('DELETE ERROR: ' + e.message, 'err');
  }
}

/* ── ALERT ── */
function showAlert(msg, type) {
  const el = document.getElementById('alertBox');
  el.textContent = msg;
  el.className   = `alert ${type} show`;
  setTimeout(() => el.classList.remove('show'), 4500);
}

/* ── RENDER TABLE ── */
const GENRE_BADGE = {Arcade:'badge-arcade', Action:'badge-action', Simulation:'badge-sim', Platformer:'badge-platform', Survival:'badge-survival'};

async function renderGameTable() {
  const tbody = document.getElementById('gameTableBody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px;">Memuat data...</td></tr>';
  const games = await fetchGames(true);
  if (!games.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;font-weight:600;">Belum ada game di katalog.</td></tr>';
    return;
  }
  tbody.innerHTML = games.map((g, i) => `<tr data-id="${escHtml(g.id)}">
    <td style="color:var(--c-cyan);font-family:var(--font-title);font-size:0.85em;">${String(i+1).padStart(2,'0')}</td>
    <td>${g.icon
      ? `<img src="${escHtml(g.icon)}" class="game-icon-cell" alt="${escHtml(g.title)}">`
      : `<span class="game-icon-placeholder"><i class="fas fa-gamepad"></i></span>`}</td>
    <td style="font-weight:700;">${escHtml(g.title)}</td>
    <td><span class="badge ${GENRE_BADGE[g.genre]||'custom-badge'}">${escHtml(g.genre)}</span></td>
    <td style="font-size:0.88em;color:var(--text-muted);">${(g.platforms||[]).map(p=>escHtml(p.name)).join(', ')||'—'}</td>
    <td>
      <button class="btn-small" onclick="editGame('${escHtml(g.id)}')">✏ Edit</button>
      <button class="btn-delete" onclick="confirmDelete('${escHtml(g.id)}','${escHtml(g.title).replace(/'/g,"\\'")}')">🗑 Hapus</button>
    </td>
  </tr>`).join('');
}

/* ── STATS ── */
async function updateStats() {
  const games = _gamesCache || [];
  const total   = games.length;
  const roblox  = games.filter(g=>(g.platforms||[]).some(p=>p.cls==='btn-roblox')).length;
  const plats   = new Set(games.flatMap(g=>(g.platforms||[]).map(p=>p.cls)));
  // Update semua elemen stats (ada di dashboard & section games)
  document.querySelectorAll('#statTotal').forEach(el     => el.textContent = total);
  document.querySelectorAll('#statRoblox').forEach(el    => el.textContent = roblox);
  document.querySelectorAll('#statPlatforms').forEach(el => el.textContent = plats.size || 0);
  // Update report badge di sidebar
  updateReportBadge();
}

/* ── EXPORT ── */
async function exportGameData() {
  const games  = await fetchGames();
  const mapped = games.map(g => ({
    id: g.id, title: g.title,
    logo:  g.icon || 'assets/img/studio_logo.png',
    thumb: g.icon || 'assets/img/studio_logo.png',
    desc: g.desc, genre: g.genre, gallery:[], platforms: g.platforms, developer:'Grid Survival'
  }));
  const jsContent = `// assets/js/gameData.js\n// Auto-generated from Admin Panel — ${new Date().toLocaleString('id-ID')}\n\nconst gameData = ${JSON.stringify(mapped,null,4)};\n`;
  const blob = new Blob([jsContent], {type:'text/javascript'});
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

  btnEl.disabled = true; btnEl.textContent = 'Mengautentikasi...';

  try {
    const hash = await sha256(pass);
    const attempts = getAttempts();
    if (user === ADMIN_CREDENTIALS.username && hash === ADMIN_CREDENTIALS.passHash) {
      setAttempts({count:0});
      sessionStorage.removeItem(LOCKOUT_KEY);
      const sess = setSession(user, pass);
      addLog(`LOGIN OK — user: ${user} | session: ${sess.token.slice(0,8)}…`);
      showAdmin(sess);
    } else {
      attempts.count = (attempts.count||0) + 1;
      setAttempts(attempts);
      const left = MAX_ATTEMPTS - attempts.count;
      addLog(`LOGIN FAILED — user: ${user} | attempt ${attempts.count}/${MAX_ATTEMPTS}`, 'warn');
      if (attempts.count >= MAX_ATTEMPTS) {
        setLockout(); setAttempts({count:0});
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
  errEl.textContent = ''; btnEl.disabled = true; let remaining = seconds;
  lockEl.style.display = 'block';
  const tick = () => {
    const m = String(Math.floor(remaining/60)).padStart(2,'0');
    const s = String(remaining%60).padStart(2,'0');
    lockEl.textContent = `⛔ Akun terkunci — tunggu ${m}:${s}`;
    if (remaining-- > 0) setTimeout(tick, 1000);
    else { lockEl.style.display='none'; btnEl.disabled=false; attEl.textContent=''; }
  };
  tick();
}

async function showAdmin(sess) {
  document.getElementById('loginWrap').style.display = 'none';
  document.getElementById('adminWrap').classList.add('show');
  document.getElementById('adminUserDisplay').textContent = sess.user.toUpperCase();
  document.getElementById('sessionId').textContent        = sess.token.slice(0,12)+'…';
  document.getElementById('loginTime').textContent        = sess.loginAt;
  startSessionTimer(sess);
  startAdminCharAnim();
  addLog('Admin panel loaded — mengambil data game dari server...');
  await renderGameTable();
  updateStats();
  renderReports();
  addLog(`Session aktif — expires in ${SESSION_MINUTES} minutes`);
}

function doLogout() { addLog('LOGOUT — session terminated','warn'); clearSession(); location.reload(); }

function startSessionTimer(sess) {
  const timerEl  = document.getElementById('sessionTimer');
  const timerEl2 = document.getElementById('sessionTimerDash');
  let warnedExpiry = false;
  const interval = setInterval(() => {
    const remaining = Math.max(0, sess.exp - Date.now());
    if (remaining === 0) {
      clearInterval(interval);
      addLog('SESSION EXPIRED — auto logout','err');
      setTimeout(() => { clearSession(); location.reload(); }, 2000);
      return;
    }
    const m = String(Math.floor(remaining/60000)).padStart(2,'0');
    const s = String(Math.floor((remaining%60000)/1000)).padStart(2,'0');
    const txt = `${m}:${s}`;
    if (timerEl)  timerEl.textContent  = txt;
    if (timerEl2) timerEl2.textContent = txt;
    // Peringatan 5 menit sebelum expire
    if (!warnedExpiry && remaining < 5 * 60 * 1000) {
      warnedExpiry = true;
      addLog('⚠ Session hampir habis — kurang dari 5 menit!', 'warn');
      showToast('Session hampir habis! Simpan pekerjaan kamu.', 'warn');
    }
  }, 1000);
}

/* ── PIXEL CHAR ANIM ── */
function startAdminCharAnim() {
  const canvas = document.getElementById('adminCharCanvas'); if (!canvas) return;
  const ctx = canvas.getContext('2d'); const SC = 3;
  const C = {_:null,S:'#f5c88a',H:'#5a3e1b',G:'#2a7a3a',T:'#1a5a2a',R:'#9b59b6',B:'#3a2a1a',D:'#8b6b4a',N:'#1a1d2e'};
  const frames = [
    [[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.H,C.S,C.S,C.H,C.N],[C.N,C.S,C.R,C.S,C.S,C.N],[C.N,C.S,C.S,C.S,C.S,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.G,C.G,C.G,C.G,C.N],[C.N,C.T,C.G,C.G,C.T,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C._,C.B,C.N,C.N,C.B,C._],[C.N,C.D,C.N,C.N,C.D,C.N]],
    [[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.H,C.S,C.S,C.H,C.N],[C.N,C.S,C.S,C.S,C.R,C.N],[C.N,C.S,C.S,C.S,C.S,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C.N,C.G,C.G,C.G,C.G,C.N],[C.N,C.T,C.G,C.G,C.T,C.N],[C._,C.N,C.N,C.N,C.N,C._],[C._,C.B,C.N,C.N,C.B,C._],[C._,C.N,C.D,C.D,C.N,C._]]
  ];
  function draw(f) { ctx.clearRect(0,0,canvas.width,canvas.height); frames[f].forEach((row,ry)=>row.forEach((color,rx)=>{if(!color)return;ctx.fillStyle=color;ctx.fillRect(rx*SC,ry*SC,SC,SC);})); }
  let f=0; setInterval(()=>{draw(f);f=(f+1)%2;},250);
}

/* ── TICKETS (server-side via Netlify Blobs) ── */
const TICKET_API = '/.netlify/functions/ticket';

// adminToken = password yang diketik saat login (dikirim ke server untuk diverifikasi hashnya)
function getAdminToken() {
  const s = getSession();
  return s ? s.adminToken || '' : '';
}

async function fetchTickets() {
  const panel   = document.getElementById('reports-panel');
  const countEl = document.getElementById('reportCount');
  if (panel) panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">Memuat tiket dari server...</div>';

  try {
    const adminToken = getAdminToken();
    const res  = await fetch(`${TICKET_API}?admin=1&list=1&adminToken=${encodeURIComponent(adminToken)}`);
    const data = await res.json();

    if (!data.ok) {
      if (panel) panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--c-red);">Gagal memuat tiket: ${escHtml(data.error)}<br><small style="color:var(--text-muted)">Pastikan password login sudah benar. Jika menggunakan custom password, pastikan ADMIN_TICKET_KEY di Netlify env vars berisi hash SHA-256 dari password kamu.</small></div>`;
      if (countEl) countEl.textContent = 'Gagal memuat';
      return;
    }

    const tickets = data.tickets || [];
    if (countEl) countEl.textContent = `${tickets.length} tiket (${tickets.filter(t=>!t.done).length} aktif)`;
    renderTicketPanel(tickets);
  } catch (e) {
    if (panel) panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--c-red);">Error: ${escHtml(e.message)}</div>`;
    addLog('Gagal fetch tiket: ' + e.message, 'err');
  }
}

function renderTicketPanel(tickets) {
  const panel = document.getElementById('reports-panel');
  if (!panel) return;

  if (!tickets.length) {
    panel.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">Belum ada laporan masuk</div>
        <div class="empty-state-sub">Laporan dari CS atau form akan muncul di sini</div>
      </div>`;
    return;
  }

  const STATUS_STEPS = { received: 0, seen: 1, confirmed: 2, done: 3 };
  const STATUS_LABEL = { received:'Diterima', seen:'Dilihat', confirmed:'Dikonfirmasi', done:'Selesai' };
  const STEP_LABELS  = ['Diterima', 'Dilihat', 'Dikonfirmasi', 'Selesai'];

  panel.innerHTML = tickets.map(t => {
    const step   = STATUS_STEPS[t.status] ?? 0;
    const isDone = t.done || t.status === 'done';
    const tid    = escHtml(t.id);
    const dateStr = t.createdAt
      ? new Date(t.createdAt).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jakarta' })
      : '—';

    // Progress stepper
    const stepperHtml = STEP_LABELS.map((label, i) => {
      const cls = i < step ? 'done' : (i === step ? (isDone ? 'done' : 'active') : '');
      const dot = (i < step || isDone) ? '✓' : (i + 1);
      return `<div class="rs-step ${cls}"><div class="rs-dot">${dot}</div><div class="rs-label">${label}</div></div>`;
    }).join('');

    // Status badge
    const badgeCls = t.status || 'received';
    const badgeLabel = STATUS_LABEL[t.status] || t.status;

    // Controls
    const controls = !isDone ? `
      <select class="status-select" id="sel-status-${tid}">
        <option value="received"  ${t.status==='received' ?'selected':''}>📥 Diterima</option>
        <option value="seen"      ${t.status==='seen'     ?'selected':''}>👀 Dilihat</option>
        <option value="confirmed" ${t.status==='confirmed'?'selected':''}>🔧 Dikonfirmasi</option>
      </select>
      <input class="devnote-input" type="text" id="note-${tid}" placeholder="Catatan untuk user (opsional)..." value="${escHtml(t.devNote||'')}">
      <button class="btn-update-status" onclick="updateTicketStatus('${tid}')">Simpan</button>
      <button class="btn-small" onclick="closeTicket('${tid}')">✓ Selesaikan</button>
      <button class="btn-del-report" onclick="deleteReport('${tid}')">Hapus</button>
    ` : `
      <span class="s-badge done">✅ Tiket Selesai &amp; Ditutup</span>
      <button class="btn-del-report" onclick="deleteReport('${tid}')" style="margin-left:auto;">Hapus</button>
    `;

    return `
<div class="report-item${isDone ? ' report-done' : ''}">
  <div class="report-item-head">
    <span class="report-badge ${t.type==='bug'?'bug':'saran'}">${t.type==='bug'?'🐛 Bug Report':'💡 Saran'}</span>
    <span class="s-badge ${badgeCls}">${badgeLabel}</span>
    <span class="report-ticket-id">#${t.num||'—'} · ${t.id}</span>
    <span class="report-time">${dateStr}</span>
  </div>

  <div class="report-game">Game: <span>${escHtml(t.game||'Tidak disebutkan')}</span></div>

  <div class="report-desc">${escHtml(t.desc||'—')}</div>

  ${t.summary && t.summary !== t.desc ? `
  <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;padding:10px 14px;background:rgba(6,182,212,0.05);border:1px solid rgba(6,182,212,0.15);border-radius:8px;font-size:0.83rem;color:var(--text-dim);">
    <span style="color:var(--c-cyan);font-weight:700;flex-shrink:0;">🤖 AI:</span> ${escHtml(t.summary)}
  </div>` : ''}

  ${t.devNote ? `
  <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:14px;padding:10px 14px;background:rgba(0,217,126,0.05);border:1px solid rgba(0,217,126,0.18);border-radius:8px;font-size:0.83rem;color:var(--text-dim);">
    <span style="color:var(--c-green);font-weight:700;flex-shrink:0;">💬 Dev:</span> ${escHtml(t.devNote)}
  </div>` : ''}

  <div class="report-contact-row">
    ${t.email ? `<div class="report-contact-item">📧 <a href="mailto:${escHtml(t.email)}">${escHtml(t.email)}</a></div>` : ''}
    ${t.contact ? `<div class="report-contact-item">📱 <span style="color:var(--text-dark)">${escHtml(t.contact)}</span></div>` : ''}
  </div>

  <div class="report-stepper">${stepperHtml}</div>

  <div class="report-status-row">${controls}</div>
</div>`;
  }).join('');
}

async function deleteReport(id) {
  const adminToken = getAdminToken();
  if (!confirm('Hapus laporan ini permanen?')) return;
  try {
    const res  = await fetch(TICKET_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id, adminToken }),
    });
    const data = await res.json();
    if (data.ok) { addLog('Laporan ' + id + ' dihapus', 'ok'); fetchTickets(); }
    else         { addLog('Gagal hapus: ' + (data.error||'?'), 'err'); }
  } catch (e)   { addLog('Error hapus: ' + e.message, 'err'); }
}

async function updateTicketStatus(id) {
  const sel   = document.getElementById('sel-status-' + id);
  const note  = document.getElementById('note-' + id);
  if (!sel) return;
  const status     = sel.value;
  const devNote    = note ? note.value.trim() : '';
  const adminToken = getAdminToken();

  try {
    const res  = await fetch(TICKET_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_status', id, status, devNote, adminToken }),
    });
    const data = await res.json();
    if (data.ok) { addLog(`Tiket ${id} → ${status}`); fetchTickets(); }
    else         { addLog('Gagal update: ' + (data.error||'?'), 'err'); }
  } catch (e) { addLog('Error update tiket: ' + e.message, 'err'); }
}

async function closeTicket(id) {
  const adminToken = getAdminToken();
  try {
    const res  = await fetch(TICKET_API, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close', id, adminToken }),
    });
    const data = await res.json();
    if (data.ok) { addLog(`Tiket ${id} ditutup (selesai)`); fetchTickets(); }
    else         { addLog('Gagal tutup tiket: ' + (data.error||'?'), 'err'); }
  } catch (e) { addLog('Error close tiket: ' + e.message, 'err'); }
}

function renderReports() { fetchTickets(); }
function clearDoneReports() {
  addLog('Hapus tiket selesai tidak tersedia — tiket disimpan permanen di server.', 'warn');
}



/* ════════════════════════════════════════
   TOAST NOTIFICATION
   ════════════════════════════════════════ */
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
    document.body.appendChild(container);
  }
  const colors = { info:'rgba(212,130,10,0.9)', ok:'rgba(26,153,0,0.9)', warn:'rgba(204,136,0,0.9)', err:'rgba(204,34,34,0.9)' };
  const icons  = { info:'fa-circle-info', ok:'fa-circle-check', warn:'fa-triangle-exclamation', err:'fa-circle-xmark' };
  const toast  = document.createElement('div');
  toast.style.cssText = `background:${colors[type]||colors.info};color:#fff;padding:10px 16px;border-radius:4px;font-family:'Share Tech Mono',monospace;font-size:0.78rem;display:flex;align-items:center;gap:8px;max-width:320px;box-shadow:0 4px 16px rgba(0,0,0,0.2);pointer-events:auto;opacity:0;transition:opacity 0.25s,transform 0.25s;transform:translateY(8px);`;
  toast.innerHTML = `<i class="fas ${icons[type]||icons.info}"></i> ${escHtml(msg)}`;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity='1'; toast.style.transform='translateY(0)'; });
  setTimeout(() => {
    toast.style.opacity='0'; toast.style.transform='translateY(8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ════════════════════════════════════════
   REPORT BADGE (angka tiket aktif di sidebar)
   ════════════════════════════════════════ */
function updateReportBadge(count) {
  const badge = document.getElementById('reportBadge');
  if (!badge) return;
  if (count === undefined) {
    // hitung dari cache tiket jika ada
    return;
  }
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

/* ════════════════════════════════════════
   SEARCH & FILTER GAME TABLE
   ════════════════════════════════════════ */
let _searchQuery = '';
let _filterGenre = '';

function initGameSearch() {
  const wrap = document.getElementById('gameTableBody');
  if (!wrap) return;
  // Cek apakah toolbar search sudah ada
  const existing = document.getElementById('game-search-input');
  if (existing) return;

  const toolbar = document.querySelector('.table-toolbar');
  if (!toolbar) return;

  // Input search
  const searchInput = document.createElement('input');
  searchInput.id = 'game-search-input';
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 Cari game...';
  searchInput.style.cssText = "background:var(--bg-input);border:1.5px solid var(--border-vis);border-radius:4px;padding:5px 10px;font-family:'Share Tech Mono',monospace;font-size:0.75rem;color:var(--text-primary);outline:none;width:160px;";
  searchInput.addEventListener('input', e => { _searchQuery = e.target.value.toLowerCase(); filterGameTable(); });
  searchInput.addEventListener('focus', e => { e.target.style.borderColor='var(--brand)'; });
  searchInput.addEventListener('blur',  e => { e.target.style.borderColor='var(--border-vis)'; });

  // Select filter genre
  const genreFilter = document.createElement('select');
  genreFilter.id = 'game-genre-filter';
  genreFilter.style.cssText = "background:var(--bg-input);border:1.5px solid var(--border-vis);border-radius:4px;padding:5px 10px;font-family:'Share Tech Mono',monospace;font-size:0.75rem;color:var(--text-primary);outline:none;cursor:pointer;";
  genreFilter.innerHTML = '<option value="">Semua Genre</option><option value="Arcade">Arcade</option><option value="Action">Action</option><option value="Simulation">Simulation</option><option value="Platformer">Platformer</option><option value="Survival">Survival</option><option value="RPG">RPG</option><option value="Strategy">Strategy</option><option value="Puzzle">Puzzle</option><option value="Horror">Horror</option><option value="Other">Other</option>';
  genreFilter.addEventListener('change', e => { _filterGenre = e.target.value; filterGameTable(); });

  toolbar.insertBefore(genreFilter, toolbar.firstChild);
  toolbar.insertBefore(searchInput, toolbar.firstChild);
}

function filterGameTable() {
  const rows = document.querySelectorAll('#gameTableBody tr[data-id]');
  let visible = 0;
  rows.forEach(row => {
    const title = (row.cells[2]?.textContent || '').toLowerCase();
    const genre = (row.cells[3]?.textContent || '').toLowerCase();
    const matchSearch = !_searchQuery || title.includes(_searchQuery);
    const matchGenre  = !_filterGenre || genre.includes(_filterGenre.toLowerCase());
    const show = matchSearch && matchGenre;
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  // Tampilkan pesan jika tidak ada hasil
  let noResult = document.getElementById('table-no-result');
  if (!visible && (rows.length > 0)) {
    if (!noResult) {
      noResult = document.createElement('tr');
      noResult.id = 'table-no-result';
      noResult.innerHTML = '<td colspan="6" class="table-empty">Tidak ada game yang cocok.</td>';
      document.getElementById('gameTableBody').appendChild(noResult);
    }
    noResult.style.display = '';
  } else if (noResult) {
    noResult.style.display = 'none';
  }
}

/* ════════════════════════════════════════
   KEYBOARD SHORTCUTS
   ════════════════════════════════════════ */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (!isSessionValid()) return;
    // Alt+1/2/3/4 = navigasi section
    if (e.altKey && ['1','2','3','4'].includes(e.key)) {
      const sections = ['dashboard','games','reports','logs'];
      const idx = parseInt(e.key) - 1;
      if (typeof navTo === 'function') navTo(sections[idx]);
      e.preventDefault();
    }
    // Alt+N = tambah game baru (fokus ke form)
    if (e.altKey && e.key === 'n') {
      if (typeof navTo === 'function') navTo('games');
      setTimeout(() => { const t = document.getElementById('fg-title'); if (t) t.focus(); }, 100);
      e.preventDefault();
    }
    // Escape = tutup modal
    if (e.key === 'Escape') {
      closeConfirm();
      if (typeof closeSidebar === 'function') closeSidebar();
    }
  });
}

/* ── Override renderGameTable: tambah initGameSearch setelah render ── */
const _origRenderGameTable = renderGameTable;
async function renderGameTable() {
  await _origRenderGameTable();
  initGameSearch();
}

/* ── Override fetchTickets: update report badge setelah fetch ── */
const _origFetchTickets = fetchTickets;
async function fetchTickets() {
  await _origFetchTickets();
  // Hitung tiket aktif dari panel yang sudah dirender
  setTimeout(() => {
    const activeItems = document.querySelectorAll('.report-item:not(.report-done)');
    updateReportBadge(activeItems.length);
  }, 200);
}

/* ── Override showAdmin: init fitur baru ── */
const _origShowAdmin = showAdmin;
async function showAdmin(sess) {
  await _origShowAdmin(sess);
  initKeyboardShortcuts();
  addLog('Fitur tambahan aktif: search, keyboard shortcuts');
}


document.addEventListener('DOMContentLoaded', function() {
  ['adminUser','adminPass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
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
    if (e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key))||(e.ctrlKey&&e.key==='U'))
      e.preventDefault();
  });
});
