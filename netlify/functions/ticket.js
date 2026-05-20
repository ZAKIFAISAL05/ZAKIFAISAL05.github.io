// ============================================================
//  netlify/functions/ticket.js — Grid Survival
//  GET  ?token=xxx            → user lihat tiket (hanya pemilik)
//  GET  ?admin=1&list=1&adminToken=xxx → admin list semua tiket
//  GET  ?admin=1&id=xxx&adminToken=xxx → admin lihat tiket spesifik
//  POST action:'create'       → simpan tiket baru (dari report.js)
//  POST action:'update_status'→ update status (admin panel)
//  POST action:'close'        → tutup tiket selesai (admin panel)
//  POST action:'wa_bot'       → Fonnte webhook, developer reply WA
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const STATUS = {
  received:  { label:'Diterima',     step:0 },
  seen:      { label:'Dilihat',      step:1 },
  confirmed: { label:'Dikonfirmasi', step:2 },
  done:      { label:'Selesai',      step:3 },
};

const ADMIN_PASS_HASH = '821bc6e7ed5ec0007c1d7b88e8ffdd428df9ae1444325fd5c97a372773b31df4';

function createStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  const opts   = { name: 'grid-survival', consistency: 'strong' };
  if (siteID && token) { opts.siteID = siteID; opts.token = token; }
  return getStore(opts);
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function verifyAdmin(adminToken) {
  if (!adminToken) return false;
  try { return (await sha256(adminToken)) === ADMIN_PASS_HASH; }
  catch { return false; }
}

function makeToken() {
  return Array.from({ length:24 }, () => Math.floor(Math.random()*36).toString(36)).join('').toUpperCase();
}

async function getCounter(store) {
  try { const r = await store.get('ticket-counter'); return r ? parseInt(r) : 0; } catch { return 0; }
}
async function getIndex(store) {
  try { const r = await store.get('ticket-list'); return r ? JSON.parse(r) : []; } catch { return []; }
}
async function getTicket(store, id) {
  try { const r = await store.get('ticket:' + id); return r ? JSON.parse(r) : null; } catch { return null; }
}
async function saveTicket(store, t) { await store.set('ticket:' + t.id, JSON.stringify(t)); }
async function saveIndex(store, arr) { await store.set('ticket-list', JSON.stringify(arr)); }

async function sendFonnte(token, target, message) {
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method:'POST', headers:{ Authorization: token },
      body: new URLSearchParams({ target, message, delay:'0', countryCode:'62' }),
    });
    return res.ok;
  } catch { return false; }
}

function getSiteUrl() {
  return process.env.SITE_URL || process.env.URL || 'https://zakifaisal05.netlify.app';
}

async function sendEmail(apiKey, to, subject, html) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{ Authorization:'Bearer ' + apiKey, 'Content-Type':'application/json' },
      body: JSON.stringify({ from:'Grid Survival CS <cs@gridsurvival.id>', to:[to], subject, html }),
    });
    return res.ok;
  } catch(e) { console.error('Email notif error:', e.message); return false; }
}

// Kirim SMS via Fonnte (sama seperti WA, Fonnte support SMS juga)
async function sendSms(fonnteToken, phone, message) {
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method:'POST', headers:{ Authorization: fonnteToken },
      body: new URLSearchParams({ target: phone, message, delay:'0', countryCode:'62', type:'sms' }),
    });
    return res.ok;
  } catch(e) { console.error('SMS error:', e.message); return false; }
}

function isPhoneNumber(str) {
  // Nomor HP Indonesia: diawali 08/628, panjang 9-15 digit
  const digits = (str || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

function isEmail(str) {
  return (str || '').includes('@') && (str || '').includes('.');
}

function emailStatusHtml(t, status, devNote, ticketUrl) {
  const siteUrl     = getSiteUrl();
  const statusInfo  = {
    received:  { emoji:'📥', label:'Diterima',     color:'#7c4dff', msg:'Laporanmu sudah kami terima! Tim developer akan segera meninjau.' },
    seen:      { emoji:'👀', label:'Sedang Ditinjau', color:'#00e5ff', msg:'Developer sudah melihat laporanmu dan sedang dipelajari.' },
    confirmed: { emoji:'🔧', label:'Dikonfirmasi', color:'#f39c12', msg:'Laporan dikonfirmasi! Developer sedang mengerjakan perbaikan / tindak lanjut.' },
    done:      { emoji:'🎉', label:'Selesai',       color:'#27ae60', msg:'Masalah sudah diselesaikan! Terima kasih sudah melaporkan.' },
  };
  const info = statusInfo[status] || { emoji:'📋', label:status, color:'#7c4dff', msg:'' };
  const typeLabel = t.type === 'bug' ? '🐛 Bug / Error' : '💡 Saran';

  return \`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><style>
  body{font-family:'Segoe UI',sans-serif;background:#0d0d0d;color:#e0e0e0;margin:0;padding:0}
  .wrap{max-width:540px;margin:28px auto;background:#1a1a2e;border-radius:14px;overflow:hidden}
  .hdr{padding:22px 28px;background:#111;border-bottom:3px solid \${info.color}}
  .hdr-top{display:flex;align-items:center;gap:10px}
  .hdr-emoji{font-size:1.8rem}
  .hdr-title{font-size:1rem;font-weight:700;color:\${info.color}}
  .hdr-sub{font-size:0.78rem;color:#888;margin-top:2px}
  .body{padding:22px 28px}
  .status-box{background:\${info.color}18;border:1.5px solid \${info.color};border-radius:10px;padding:14px 18px;margin-bottom:18px}
  .status-label{font-size:0.72rem;text-transform:uppercase;letter-spacing:1px;color:\${info.color};display:block;margin-bottom:4px}
  .status-msg{font-size:0.9rem;line-height:1.5}
  .tkt-row{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
  .tkt-chip{background:#7c4dff22;border:1px solid #7c4dff;border-radius:7px;padding:4px 12px;font-size:0.82rem;font-weight:700;color:#7c4dff}
  .type-chip{background:#ffffff10;border:1px solid #ffffff20;border-radius:7px;padding:4px 12px;font-size:0.82rem;color:#aaa}
  .field{margin-bottom:12px}
  .field label{font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:3px}
  .field p{margin:0;background:#0d0d1a;border-radius:7px;padding:9px 13px;font-size:0.88rem;line-height:1.5}
  .dev-note{background:#0d2a1a;border:1px solid #27ae60;border-radius:8px;padding:11px 14px;margin-bottom:14px}
  .dev-note label{font-size:0.7rem;color:#27ae60;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:4px}
  .track-btn{display:block;text-align:center;background:#7c4dff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:700;font-size:0.9rem;margin-top:16px}
  .footer{border-top:1px solid #222;padding:16px 28px;font-size:0.75rem;color:#666;text-align:center}
  .footer a{color:#7c4dff;text-decoration:none}
  </style></head><body>
  <div class="wrap">
    <div class="hdr">
      <div class="hdr-top"><span class="hdr-emoji">\${info.emoji}</span><div><div class="hdr-title">Update Status Tiket — Grid Survival</div><div class="hdr-sub">Status berubah: \${info.label}</div></div></div>
    </div>
    <div class="body">
      <div class="tkt-row">
        <span class="tkt-chip">Tiket #\${t.num}</span>
        <span class="tkt-chip" style="color:#aaa;border-color:#333;">\${t.id}</span>
        <span class="type-chip">\${typeLabel}</span>
      </div>
      <div class="status-box">
        <span class="status-label">\${info.emoji} Status Terbaru</span>
        <div class="status-msg">\${info.msg}</div>
      </div>
      \${devNote ? \`<div class="dev-note"><label>💬 Catatan Developer</label><p>\${devNote}</p></div>\` : ''}
      <div class="field"><label>Game</label><p>\${t.game||'—'}</p></div>
      <div class="field"><label>Laporan Kamu</label><p>\${(t.desc||'').replace(/\n/g,'<br>')}</p></div>
      <a class="track-btn" href="\${siteUrl}\${ticketUrl}">📋 Lihat Status Tiket Lengkap →</a>
    </div>
    <div class="footer">Grid Survival CS &nbsp;|&nbsp; <a href="mailto:dzakifaisal11@gmail.com">dzakifaisal11@gmail.com</a> &nbsp;|&nbsp; <a href="https://discord.gg/f8jW6B3X">Discord</a></div>
  </div></body></html>\`;
}

// Fungsi terpusat: kirim notif ke user (email + WA + SMS) setiap perubahan status
async function notifyUser(t, status, devNote, ticketUrl) {
  const fonnteToken = process.env.FONNTE_API_KEY;
  const resendKey   = process.env.RESEND_API_KEY;
  const siteUrl     = getSiteUrl();
  const fullUrl     = siteUrl + ticketUrl;
  const statusLabel = { received:'Diterima', seen:'Sedang Ditinjau', confirmed:'Dikonfirmasi', done:'Selesai' }[status] || status;
  const statusEmoji = { received:'📥', seen:'👀', confirmed:'🔧', done:'🎉' }[status] || '📋';

  const promises = [];

  // ── Email notif (kalau ada email) ──
  if (resendKey && t.email && isEmail(t.email)) {
    const subj = \`\${statusEmoji} [\${statusLabel}] Tiket #\${t.num} — Grid Survival\`;
    promises.push(
      sendEmail(resendKey, t.email, subj, emailStatusHtml(t, status, devNote, ticketUrl))
    );
  }

  // ── WA notif (kalau kontak adalah nomor HP) ──
  const waNum = (t.contact || '').replace(/\D/g,'');
  if (fonnteToken && waNum.length >= 9) {
    const waMsg =
\`━━━━━━━━━━━━━━━━━━━━
\${statusEmoji} UPDATE TIKET GRID SURVIVAL
━━━━━━━━━━━━━━━━━━━━
Tiket: *#\${t.num}* (\${t.id})
Status: *\${statusLabel}*
\${devNote ? '\nCatatan Developer:\n' + devNote + '\n' : ''}
🔗 \${fullUrl}
━━━━━━━━━━━━━━━━━━━━\`;
    promises.push(sendFonnte(fonnteToken, waNum, waMsg));

    // ── SMS juga (kalau nomor HP valid & bukan WA) ──
    // Kirim SMS sebagai backup notif
    const smsMsg = \`[Grid Survival] Tiket #\${t.num} status: \${statusLabel}. \${devNote ? 'Catatan: ' + devNote + '. ' : ''}Cek: \${fullUrl}\`;
    promises.push(sendSms(fonnteToken, waNum, smsMsg));
  }

  await Promise.allSettled(promises);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };

  let store;
  try { store = createStore(); }
  catch(e) { return { statusCode:503, headers:CORS, body:JSON.stringify({ error:'Storage tidak tersedia', detail:e.message }) }; }

  // ═══ GET ═══
  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};

    // Admin: list semua tiket
    if (q.admin === '1' && q.list === '1') {
      if (!(await verifyAdmin(q.adminToken)))
        return { statusCode:403, headers:CORS, body:JSON.stringify({ error:'Akses ditolak' }) };
      const idx     = await getIndex(store);
      const tickets = await Promise.all(idx.map(async e => (await getTicket(store, e.id)) || e));
      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, tickets }) };
    }

    // Admin: tiket by ID
    if (q.admin === '1' && q.id) {
      if (!(await verifyAdmin(q.adminToken)))
        return { statusCode:403, headers:CORS, body:JSON.stringify({ error:'Akses ditolak' }) };
      const t = await getTicket(store, q.id);
      if (!t) return { statusCode:404, headers:CORS, body:JSON.stringify({ error:'Tiket tidak ditemukan' }) };
      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, ticket:t }) };
    }

    // User: lihat dengan token rahasia
    if (q.token) {
      const idx   = await getIndex(store);
      const entry = idx.find(e => e.token === q.token);
      if (!entry)
        return { statusCode:404, headers:CORS, body:JSON.stringify({ error:'Token tidak valid. Pastikan kamu menggunakan link yang dikirim saat laporan dibuat.' }) };

      // Tiket selesai → tampilkan halaman "selesai" bukan data
      if (entry.done)
        return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, expired:true, num:entry.num }) };

      const t = await getTicket(store, entry.id);
      if (!t) return { statusCode:404, headers:CORS, body:JSON.stringify({ error:'Tiket tidak ditemukan' }) };

      // Kembalikan data aman saja (sembunyikan email/kontak dari user)
      const safe = {
        id:entry.id, num:t.num, type:t.type, game:t.game, desc:t.desc,
        status:t.status, statusLabel:STATUS[t.status]?.label || t.status,
        statusStep:STATUS[t.status]?.step ?? 0,
        createdAt:t.createdAt, updatedAt:t.updatedAt,
        done:t.done, devNote:t.devNote || '',
        hasAttachments: !!(t.attachments && t.attachments.length),
        attachmentCount: t.attachments ? t.attachments.length : 0,
      };
      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, ticket:safe }) };
    }

    return { statusCode:400, headers:CORS, body:JSON.stringify({ error:'Parameter tidak valid' }) };
  }

  // ═══ POST ═══
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode:400, headers:CORS, body:JSON.stringify({ error:'Body tidak valid' }) }; }

    const { action } = body;

    // ── Buat tiket baru (dipanggil dari report.js) ──
    if (action === 'create') {
      const { id, type, game, desc, email, contact, summary, attachments } = body.ticket || {};
      if (!id || !type || !desc)
        return { statusCode:400, headers:CORS, body:JSON.stringify({ error:'Data tidak lengkap' }) };

      const num   = (await getCounter(store)) + 1;
      await store.set('ticket-counter', String(num));

      const token = makeToken();
      const now   = new Date().toISOString();

      const ticket = {
        id, num, token, type,
        game:    game    || '—',
        desc, summary:   summary || desc,
        email:   email   || '',
        contact: contact || '',
        attachments: attachments || [],
        status:'received', statusLabel:'Diterima',
        createdAt:now, updatedAt:now,
        done:false, devNote:'',
      };

      await saveTicket(store, ticket);

      const idx = await getIndex(store);
      idx.unshift({ id, num, token, status:'received', createdAt:now, done:false });
      await saveIndex(store, idx);

      const ticketUrl = '/tiket/?token=' + token;
      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, num, token, ticketUrl }) };
    }

    // ── Update status (admin panel) ──
    if (action === 'update_status') {
      const { id, status, adminToken, devNote } = body;
      if (!(await verifyAdmin(adminToken)))
        return { statusCode:403, headers:CORS, body:JSON.stringify({ error:'Akses ditolak' }) };
      if (!id || !STATUS[status])
        return { statusCode:400, headers:CORS, body:JSON.stringify({ error:'Data tidak valid' }) };

      const t = await getTicket(store, id);
      if (!t) return { statusCode:404, headers:CORS, body:JSON.stringify({ error:'Tiket tidak ditemukan' }) };

      t.status      = status;
      t.statusLabel = STATUS[status].label;
      t.updatedAt   = new Date().toISOString();
      if (devNote !== undefined) t.devNote = devNote;
      await saveTicket(store, t);

      const idx = await getIndex(store);
      const ei  = idx.findIndex(e => e.id === id);
      if (ei !== -1) { idx[ei].status = status; await saveIndex(store, idx); }

      // Kirim notif ke user (email + WA + SMS) setiap perubahan status
      const ticketUrlForNotif = '/tiket/?token=' + t.token;
      notifyUser(t, status, devNote || '', ticketUrlForNotif).catch(()=>{});

      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, ticket:t }) };
    }

    // ── Tutup tiket (selesai) ──
    if (action === 'close') {
      const { id, adminToken, devNote } = body;
      if (!(await verifyAdmin(adminToken)))
        return { statusCode:403, headers:CORS, body:JSON.stringify({ error:'Akses ditolak' }) };

      const t = await getTicket(store, id);
      if (!t) return { statusCode:404, headers:CORS, body:JSON.stringify({ error:'Tiket tidak ditemukan' }) };

      t.status      = 'done';
      t.statusLabel = 'Selesai';
      t.done        = true;
      t.updatedAt   = new Date().toISOString();
      t.closedAt    = t.updatedAt;
      if (devNote !== undefined) t.devNote = devNote;
      await saveTicket(store, t);

      const idx = await getIndex(store);
      const ei  = idx.findIndex(e => e.id === id);
      if (ei !== -1) { idx[ei].status='done'; idx[ei].done=true; await saveIndex(store, idx); }

      // Kirim notif selesai ke user (email + WA + SMS)
      const ticketUrlForClose = '/tiket/?token=' + t.token;
      notifyUser(t, 'done', devNote || '', ticketUrlForClose).catch(()=>{});

      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, closed:true }) };
    }

    // ── WA Bot: developer reply WA → update status otomatis ──
    // Format reply: "status seen GS-ABCXYZ" atau "selesai GS-ABCXYZ"
    if (action === 'wa_bot') {
      const waSecret = process.env.WA_BOT_SECRET || process.env.TICKET_SECRET || 'gs_wa_bot_2025';
      if (body.secret !== waSecret)
        return { statusCode:403, headers:CORS, body:JSON.stringify({ error:'Akses ditolak' }) };

      const msg = (body.message || '').trim();

      // Pola: "status <status> <ID>" atau "<status> <ID>"
      const pattern = /(?:status\s+)?(received|seen|confirmed|done|diterima|dilihat|dikonfirmasi|selesai)\s+([A-Z0-9\-]{4,20})/i;
      const match   = msg.match(pattern);
      if (!match)
        return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:false, msg:'Format tidak dikenali. Gunakan: status seen GS-0001' }) };

      const rawStatus = match[1].toLowerCase();
      const statusMap = { diterima:'received', dilihat:'seen', dikonfirmasi:'confirmed', selesai:'done' };
      const status    = statusMap[rawStatus] || rawStatus;
      const ticketId  = match[2].toUpperCase();

      if (!STATUS[status])
        return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:false, msg:'Status tidak valid: ' + status }) };

      const t = await getTicket(store, ticketId);
      if (!t)
        return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:false, msg:'Tiket tidak ditemukan: ' + ticketId }) };

      const prevStatus = t.status;
      t.status      = status;
      t.statusLabel = STATUS[status].label;
      t.done        = status === 'done';
      t.updatedAt   = new Date().toISOString();
      if (status === 'done') t.closedAt = t.updatedAt;
      await saveTicket(store, t);

      const idx = await getIndex(store);
      const ei  = idx.findIndex(e => e.id === ticketId);
      if (ei !== -1) { idx[ei].status = status; idx[ei].done = t.done; await saveIndex(store, idx); }

      // Konfirmasi ke admin WA
      const fonnteToken = process.env.FONNTE_API_KEY;
      const adminTarget = process.env.ADMIN_WA_NUMBER;
      if (fonnteToken && adminTarget) {
        sendFonnte(fonnteToken, adminTarget,
          `✅ Tiket *#${t.num}* (${ticketId}) diupdate: *${prevStatus}* → *${STATUS[status].label}* via WA Bot`
        ).catch(()=>{});
      }

      // Kirim notif ke user (email + WA + SMS)
      notifyUser(t, status, '', '/tiket/?token=' + t.token).catch(()=>{});

      return { statusCode:200, headers:CORS, body:JSON.stringify({ ok:true, ticketId, status, label:STATUS[status].label }) };
    }

    return { statusCode:400, headers:CORS, body:JSON.stringify({ error:'Action tidak dikenali' }) };
  }

  return { statusCode:405, headers:CORS, body:JSON.stringify({ error:'Method tidak diizinkan' }) };
};
