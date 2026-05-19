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
function setSession(user) { const s = {user, token:randToken(), exp:Date.now()+SESSION_MINUTES*60*1000, loginAt:new Date().toLocaleTimeString('id-ID')}; sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); return s; }
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
  document.querySelector('.admin-section-title[data-form]').textContent = '▌ Tambah Game Baru';
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
  document.querySelector('.admin-section-title[data-form]').textContent = `▌ Edit Game: ${escHtml(game.title)}`;
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
  document.getElementById('confirmOverlay').classList.add('show');
  document.getElementById('confirmYes').onclick = () => { doDeleteGame(pendingDeleteId, title); closeConfirm(); };
}
function closeConfirm() { document.getElementById('confirmOverlay').classList.remove('show'); pendingDeleteId = null; }

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
  document.getElementById('statTotal').textContent     = games.length;
  document.getElementById('statRoblox').textContent    = games.filter(g=>(g.platforms||[]).some(p=>p.cls==='btn-roblox')).length;
  const plats = new Set(games.flatMap(g=>(g.platforms||[]).map(p=>p.cls)));
  document.getElementById('statPlatforms').textContent = plats.size || 0;
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
      const sess = setSession(user);
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
    timerEl.textContent = `${m}:${s}`;
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

/* ── REPORTS (tetap localStorage — data report dari user browser) ── */
function getReports()     { try { return JSON.parse(localStorage.getItem(REPORT_STORE))||[]; } catch { return []; } }
function saveReports(arr) { localStorage.setItem(REPORT_STORE, JSON.stringify(arr)); }

function renderReports() {
  const panel   = document.getElementById('reports-panel');
  const countEl = document.getElementById('reportCount');
  if (!panel) return;
  const all = getReports();
  if (countEl) countEl.textContent = `${all.length} laporan (${all.filter(r=>!r.done).length} belum selesai)`;
  if (!all.length) {
    panel.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-weight:600;">Belum ada laporan.</div>';
    return;
  }
  panel.innerHTML = all.map(r => `
<div style="background:var(--bg-card);border:2px solid rgba(155,89,182,0.2);border-radius:var(--border-r);padding:18px;margin-bottom:12px;${r.done?'opacity:0.55;':''}">
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
    <span style="font-family:var(--font-title);font-size:0.9em;color:${r.type==='bug'?'var(--c-red)':'var(--c-yellow)'};">${r.type==='bug'?'🐛 BUG':'💡 SARAN'}</span>
    <span style="font-weight:700;">${escHtml(r.game||'—')}</span>
    ${r.offline?'<span style="font-size:0.75em;color:var(--c-yellow);border:1px solid var(--c-yellow);border-radius:6px;padding:2px 8px;font-weight:700;">OFFLINE</span>':''}
    ${r.done   ?'<span style="font-size:0.75em;color:var(--c-green);border:1px solid var(--c-green);border-radius:6px;padding:2px 8px;font-weight:700;">✓ SELESAI</span>':''}
    <span style="margin-left:auto;font-size:0.8em;color:var(--text-muted);">${escHtml(r.time||'')}</span>
  </div>
  <div style="margin-bottom:6px;font-size:0.93em;">📝 ${escHtml(r.desc)}</div>
  ${r.summary&&r.summary!==r.desc?`<div style="color:var(--c-cyan);margin-bottom:6px;font-size:0.88em;">🤖 ${escHtml(r.summary)}</div>`:''}
  ${r.contact?`<div style="color:var(--text-muted);margin-bottom:10px;font-size:0.85em;">📱 ${escHtml(r.contact)}</div>`:''}
  <div style="display:flex;gap:8px;margin-top:10px;">
    ${!r.done?`<button class="btn-small" onclick="markReportDone(${r.id})">✓ Tandai Selesai</button>`:''}
    <button class="btn-delete" onclick="deleteReport(${r.id})">🗑 Hapus</button>
  </div>
</div>`).join('');
}

function markReportDone(id) { const all=getReports().map(r=>r.id===id?{...r,done:true}:r); saveReports(all); addLog(`Report #${id} ditandai selesai`); renderReports(); }
function deleteReport(id)   { const r=getReports().find(x=>x.id===id); saveReports(getReports().filter(x=>x.id!==id)); addLog(`Report dihapus — ${r?r.type+': '+r.game:'#'+id}`,'warn'); renderReports(); }
function clearDoneReports() { saveReports(getReports().filter(r=>!r.done)); addLog('Semua laporan selesai dihapus'); renderReports(); }

/* ── INIT ── */
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
