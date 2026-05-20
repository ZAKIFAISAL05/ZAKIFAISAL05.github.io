// ============================================================
//  netlify/functions/report.js — Grid Survival
//  POST { type, game, desc, contact, email, attachments[] }
//  1. Generate ticketId via ticket.js (nomor urut + token)
//  2. AI summarize via Gemini (fallback model)
//  3. Simpan tiket ke Netlify Blobs (via ticket function)
//  4. Kirim notif WA admin via Fonnte (+ info lampiran)
//  5. Email konfirmasi ke user (dengan link tiket)
//  6. Email notif ke admin
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];

function createStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const tok    = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  const opts   = { name: 'grid-survival', consistency: 'strong' };
  if (siteID && tok) { opts.siteID = siteID; opts.token = tok; }
  return getStore(opts);
}

async function callGemini(apiKey, prompt) {
  for (const model of GEMINI_MODELS) {
    try {
      const url  = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res  = await fetch(url, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ contents:[{ role:'user', parts:[{ text:prompt }] }], generationConfig:{ maxOutputTokens:200, temperature:0.5 } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || res.statusText);
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (txt) return txt;
    } catch(e) { console.error(`Gemini [${model}]:`, e.message); }
  }
  return '';
}

async function sendFonnte(token, target, message) {
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method:'POST', headers:{ Authorization: token },
      body: new URLSearchParams({ target, message, delay:'0', countryCode:'62' }),
    });
    return res.ok;
  } catch(e) { console.error('Fonnte:', e.message); return false; }
}

async function sendEmail(apiKey, to, subject, html) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{ Authorization:'Bearer ' + apiKey, 'Content-Type':'application/json' },
      body: JSON.stringify({ from:'Grid Survival CS <cs@gridsurvival.id>', to:[to], subject, html }),
    });
    return res.ok;
  } catch(e) { console.error('Email:', e.message); return false; }
}

function getNowWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone:'Asia/Jakarta', weekday:'long', day:'2-digit',
    month:'long', year:'numeric', hour:'2-digit', minute:'2-digit',
  });
}

function generateId() {
  return 'GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
}

function getSiteUrl() {
  return process.env.SITE_URL || process.env.URL || 'https://zakifaisal05.netlify.app';
}

function emailUserHtml(ticketNum, ticketId, type, game, desc, waktu, ticketUrl) {
  const siteUrl   = getSiteUrl();
  const typeLabel = type === 'bug' ? '🐛 Bug / Error' : '💡 Saran';
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><style>
  body{font-family:'Segoe UI',sans-serif;background:#0d0d0d;color:#e0e0e0;margin:0;padding:0}
  .wrap{max-width:560px;margin:32px auto;background:#1a1a2e;border-radius:16px;overflow:hidden}
  .hdr{background:linear-gradient(135deg,#7c4dff,#00e5ff);padding:28px 32px;text-align:center}
  .hdr h1{color:#fff;margin:0;font-size:1.4rem;letter-spacing:1px}
  .hdr p{color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:0.9rem}
  .body{padding:28px 32px}
  .tkt{background:#0d0d1a;border:2px solid #7c4dff;border-radius:12px;padding:16px 24px;text-align:center;margin-bottom:20px}
  .tkt-lbl{font-size:0.72rem;color:#888;text-transform:uppercase;letter-spacing:1px;display:block}
  .tkt-num{font-size:1.6rem;font-weight:800;color:#7c4dff;letter-spacing:2px;display:block;margin-top:4px}
  .track-btn{display:block;margin:16px auto 0;background:#7c4dff;color:#fff;text-decoration:none;padding:11px 24px;border-radius:9px;font-weight:700;font-size:0.92rem;width:fit-content}
  .field{margin-bottom:14px}
  .field label{font-size:0.75rem;color:#888;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:4px}
  .field p{margin:0;background:#0d0d1a;border-radius:8px;padding:10px 14px;font-size:0.92rem;line-height:1.5}
  .footer{border-top:1px solid #222;padding:20px 32px;font-size:0.78rem;color:#666;text-align:center}
  .footer a{color:#7c4dff;text-decoration:none}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>🎮 Grid Survival</h1><p>Customer Service — Konfirmasi Laporan</p></div>
    <div class="body">
      <div class="tkt">
        <span class="tkt-lbl">Tiket #${ticketNum}</span>
        <span class="tkt-num">${ticketId}</span>
        <a class="track-btn" href="${siteUrl}${ticketUrl}">📋 Pantau Status Tiket Kamu →</a>
      </div>
      <p style="margin:0 0 20px;line-height:1.6;">Halo! Kami telah menerima laporanmu. Pantau status penanganan secara real-time di link di atas. Bookmark link tersebut — hanya kamu yang bisa mengaksesnya.</p>
      <div class="field"><label>Jenis</label><p>${typeLabel}</p></div>
      <div class="field"><label>Game</label><p>${game}</p></div>
      <div class="field"><label>Laporan</label><p>${desc.replace(/\n/g,'<br>')}</p></div>
      <div class="field"><label>Waktu Masuk</label><p>${waktu}</p></div>
    </div>
    <div class="footer">Pertanyaan? <a href="mailto:dzakifaisal11@gmail.com">dzakifaisal11@gmail.com</a> | <a href="https://discord.gg/f8jW6B3X">Discord Grid Survival</a></div>
  </div></body></html>`;
}

function emailAdminHtml(ticketNum, ticketId, type, game, desc, contact, email, summary, waktu, attCount, ticketUrl) {
  const siteUrl   = getSiteUrl();
  const typeLabel = type === 'bug' ? '🐛 BUG REPORT' : '💡 SARAN';
  return `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><style>
  body{font-family:'Segoe UI',sans-serif;background:#0d0d0d;color:#e0e0e0;margin:0;padding:0}
  .wrap{max-width:580px;margin:32px auto;background:#1a1a2e;border-radius:16px;overflow:hidden}
  .hdr{background:#111;border-bottom:3px solid #7c4dff;padding:20px 28px}
  .hdr h1{margin:0;font-size:1.1rem;color:#7c4dff}.hdr p{margin:4px 0 0;color:#888;font-size:0.82rem}
  .body{padding:24px 28px}
  .tkt{display:inline-block;background:#7c4dff22;border:1.5px solid #7c4dff;border-radius:8px;padding:6px 16px;font-size:1rem;font-weight:700;color:#7c4dff;margin-bottom:16px}
  .field{margin-bottom:14px}.field label{font-size:0.72rem;color:#888;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:3px}
  .field p{margin:0;background:#111;border-radius:8px;padding:10px 14px;font-size:0.9rem;line-height:1.5}
  .ai{background:#0d2a1a;border:1px solid #27ae60;border-radius:8px;padding:12px 14px;margin-bottom:14px}
  .ai label{font-size:0.72rem;color:#27ae60;text-transform:uppercase;letter-spacing:0.8px;display:block;margin-bottom:4px}
  .att-box{background:#1a1a00;border:1px solid #ffe600;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:0.85rem}
  .track-btn{display:inline-block;background:#7c4dff;color:#fff;text-decoration:none;padding:8px 20px;border-radius:8px;font-weight:700;font-size:0.85rem;margin-top:10px}
  </style></head><body>
  <div class="wrap">
    <div class="hdr"><h1>📋 ${typeLabel} — GRID SURVIVAL</h1><p>${waktu}</p></div>
    <div class="body">
      <div class="tkt">Tiket #${ticketNum} — ${ticketId}</div>
      ${attCount ? `<div class="att-box">📎 <strong>${attCount} file bukti</strong> dilampirkan oleh pelapor.</div>` : ''}
      <div class="field"><label>Game</label><p>${game}</p></div>
      <div class="field"><label>Deskripsi</label><p>${desc.replace(/\n/g,'<br>')}</p></div>
      <div class="ai"><label>🤖 Ringkasan AI</label><p>${summary}</p></div>
      <div class="field"><label>Email Pelapor</label><p>${email||'—'}</p></div>
      <div class="field"><label>Kontak WA</label><p>${contact||'—'}</p></div>
      <a class="track-btn" href="${siteUrl}${ticketUrl}">📋 Lihat & Update Status Tiket →</a>
    </div>
  </div></body></html>`;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  if (event.httpMethod !== 'POST')    return { statusCode:405, headers:CORS, body:JSON.stringify({ error:'Method tidak diizinkan' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode:400, headers:CORS, body:JSON.stringify({ error:'Body tidak valid' }) }; }

  const { type, game, desc, contact, email, attachments } = body;
  if (!type || !desc || desc.trim().length < 10)
    return { statusCode:400, headers:CORS, body:JSON.stringify({ error:'Data laporan tidak lengkap' }) };

  const ticketId  = body.ticketId || generateId();
  const apiKeys   = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3].filter(Boolean);
  const fonnteToken = process.env.FONNTE_API_KEY;
  const adminTarget = process.env.ADMIN_WA_NUMBER;
  const resendKey   = process.env.RESEND_API_KEY;
  const adminEmail  = process.env.ADMIN_EMAIL || 'dzakifaisal11@gmail.com';
  const waktuWIB    = getNowWIB();
  const typeLabel   = type === 'bug' ? '🐛 BUG REPORT' : '💡 SARAN';
  const gameLabel   = game || 'Tidak disebutkan';

  // 1. Simpan lampiran base64 ke Blobs (maks 5 file)
  const store = createStore();
  const savedAttachments = [];
  if (attachments && attachments.length) {
    for (let i = 0; i < Math.min(attachments.length, 5); i++) {
      const att = attachments[i];
      if (!att.base64 || !att.name) continue;
      const attKey = `att:${ticketId}:${i}:${att.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,40)}`;
      try {
        await store.set(attKey, att.base64);
        savedAttachments.push({ key:attKey, name:att.name, type:att.type||'image/jpeg', index:i });
      } catch(e) { console.error('Attachment save:', e.message); }
    }
  }

  // 2. AI Summarize
  let summary = desc.trim();
  for (const key of apiKeys) {
    try {
      const s = await callGemini(key, `Buat ringkasan 1-2 kalimat laporan ini untuk tim developer. Jangan tambah pembuka.\n\nJenis: ${type==='bug'?'Bug/Error':'Saran'}\nGame: ${gameLabel}\nIsi: ${desc.trim()}`);
      if (s) { summary = s; break; }
    } catch(_) {}
  }

  // 3. Simpan tiket ke Blobs via ticket logic langsung
  let ticketNum = '—';
  let ticketUrl = '/tiket/';
  let ticketToken = '';
  try {
    // Panggil ticket.js logic langsung (tanpa HTTP roundtrip)
    const counter = await (async () => {
      try { const r = await store.get('ticket-counter'); return r ? parseInt(r) : 0; } catch { return 0; }
    })();
    ticketNum = counter + 1;
    await store.set('ticket-counter', String(ticketNum));

    ticketToken = Array.from({ length:24 }, () => Math.floor(Math.random()*36).toString(36)).join('').toUpperCase();
    const now   = new Date().toISOString();

    const ticket = {
      id:ticketId, num:ticketNum, token:ticketToken,
      type, game:gameLabel, desc:desc.trim(), summary,
      email:email||'', contact:contact||'',
      attachments: savedAttachments,
      status:'received', statusLabel:'Diterima',
      createdAt:now, updatedAt:now,
      done:false, devNote:'',
    };
    await store.set('ticket:' + ticketId, JSON.stringify(ticket));

    const idx = await (async () => { try { const r = await store.get('ticket-list'); return r ? JSON.parse(r) : []; } catch { return []; } })();
    idx.unshift({ id:ticketId, num:ticketNum, token:ticketToken, status:'received', createdAt:now, done:false });
    await store.set('ticket-list', JSON.stringify(idx));

    ticketUrl = '/tiket/?token=' + ticketToken;
  } catch(e) {
    console.error('Gagal simpan tiket:', e.message);
  }

  const siteUrl    = getSiteUrl();
  const fullTicketUrl = siteUrl + ticketUrl;

  // 4. WA admin via Fonnte
  if (fonnteToken && adminTarget) {
    const attInfo = savedAttachments.length ? `\n📎 *Lampiran:* ${savedAttachments.length} file bukti` : '';
    const waMsg =
`━━━━━━━━━━━━━━━━━━━━
${typeLabel} — GRID SURVIVAL
Tiket: *#${ticketNum}* (${ticketId})
━━━━━━━━━━━━━━━━━━━━
📅 *Waktu:* ${waktuWIB}
🎮 *Game:* ${gameLabel}
📝 *Deskripsi:*
${desc.trim()}

🤖 *Ringkasan AI:*
${summary}

📧 *Email:* ${email||'—'}
📱 *Kontak:* ${contact||'—'}${attInfo}
━━━━━━━━━━━━━━━━━━━━
🔗 ${fullTicketUrl}

_Reply WA untuk update status:_
_status seen ${ticketId}_
_status confirmed ${ticketId}_
_status done ${ticketId}_
━━━━━━━━━━━━━━━━━━━━`;
    await sendFonnte(fonnteToken, adminTarget, waMsg);
  }

  // 5. Email ke user
  if (resendKey && email && email.includes('@')) {
    const subj = `[Tiket #${ticketNum}] ${type==='bug'?'Bug Dilaporkan':'Saran Diterima'} — Grid Survival`;
    await sendEmail(resendKey, email, subj, emailUserHtml(ticketNum, ticketId, type, gameLabel, desc.trim(), waktuWIB, ticketUrl));
  }

  // 6. Email admin
  if (resendKey) {
    const subj = `[${typeLabel}] Tiket #${ticketNum} — ${gameLabel}`;
    await sendEmail(resendKey, adminEmail, subj, emailAdminHtml(ticketNum, ticketId, type, gameLabel, desc.trim(), contact, email, summary, waktuWIB, savedAttachments.length, ticketUrl));
  }

  return {
    statusCode:200, headers:CORS,
    body: JSON.stringify({ ok:true, summary, ticketId, ticketNum, ticketUrl, message:'Laporan berhasil dikirim!' }),
  };
};
