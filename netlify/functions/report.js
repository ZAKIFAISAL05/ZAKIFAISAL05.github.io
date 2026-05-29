// ============================================================
//  netlify/functions/report.js — Nusabit Studio
//  POST { type, game, desc, contact, email, ticketId }
//  1. Generate / terima ticketId
//  2. AI summarize via Gemini
//  3. Simpan tiket ke Netlify Blobs (via ticket function logic)
//  4. Kirim notif WA admin via Fonnte
//  5. Kirim email konfirmasi ke user (jika ada email)
//  6. Kirim email notif ke admin
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const GEMINI_MODEL = 'gemini-2.5-flash';

/* ── TICKET BLOBS HELPERS ── */
function createTicketStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const tok    = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  const opts   = { name: 'nusabit-studio', consistency: 'strong' };
  if (siteID && tok) { opts.siteID = siteID; opts.token = tok; }
  return getStore(opts);
}

async function saveTicketToBlobs({ id, type, game, desc, email, contact, summary }) {
  try {
    const store = createTicketStore();
    const COUNTER_KEY = 'ticket-counter';
    const TICKETS_KEY = 'ticket-list';

    const rawCounter = await store.get(COUNTER_KEY).catch(() => null);
    const num = rawCounter ? parseInt(rawCounter) + 1 : 1;
    await store.set(COUNTER_KEY, String(num));

    const token = Array.from({ length: 24 }, () =>
      Math.floor(Math.random() * 36).toString(36)
    ).join('').toUpperCase();

    const now = new Date().toISOString();
    const fullTicket = {
      id, num, token, type, game: game || '—', desc, email: email || '',
      contact: contact || '', summary: summary || desc,
      status: 'received', statusLabel: 'Diterima',
      statusStep: 0, createdAt: now, updatedAt: now, done: false, devNote: ''
    };

    await store.set('ticket:' + id, JSON.stringify(fullTicket));

    const rawIdx = await store.get(TICKETS_KEY).catch(() => null);
    const idx = rawIdx ? JSON.parse(rawIdx) : [];
    idx.unshift({ id, num, token, status: 'received', createdAt: now, done: false });
    await store.set(TICKETS_KEY, JSON.stringify(idx));

    return { num, token, ticketUrl: '/tiket/?token=' + token };
  } catch (e) {
    console.error('Gagal simpan tiket ke Blobs:', e.message);
    return null;
  }
}

async function callGemini(apiKey, prompt) {
  const url  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 200, temperature: 0.5 },
  };
  const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || res.statusText);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function sendFonnte(token, target, message) {
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: new URLSearchParams({ target, message, delay: '0', countryCode: '62' }),
    });
    return res.ok;
  } catch (e) { console.error('Fonnte error:', e.message); return false; }
}

// Kirim email via Resend (https://resend.com — gratis 3000 email/bulan)
async function sendEmail(apiKey, to, subject, html) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'Nusabit Studio CS <onboarding@resend.dev>',
        to:      [to],
        subject: subject,
        html:    html,
      }),
    });
    const data = await res.json();
    if (!res.ok) console.error('Resend error:', JSON.stringify(data));
    return res.ok;
  } catch (e) { console.error('Email error:', e.message); return false; }
}

function getNowWIBString() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit',
    month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function emailUserHtml(ticketId, type, game, desc, waktu) {
  const typeLabel = type === 'bug' ? '🐛 Bug / Error' : '💡 Saran';
  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#f4f4f7; color:#1a1a2e; margin:0; padding:0; }
  .wrap { max-width:560px; margin:32px auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.10); }
  .header { background:linear-gradient(135deg,#7c4dff,#5c35cc); padding:28px 32px; text-align:center; }
  .header h1 { color:#fff; margin:0; font-size:1.4rem; letter-spacing:1px; }
  .header p  { color:rgba(255,255,255,0.88); margin:6px 0 0; font-size:0.9rem; }
  .body { padding:28px 32px; }
  .ticket { background:#f0ebff; border:2px solid #7c4dff; border-radius:12px; padding:16px 24px; text-align:center; margin-bottom:24px; }
  .ticket-label { font-size:0.72rem; color:#6c5ce7; text-transform:uppercase; letter-spacing:1px; display:block; }
  .ticket-num   { font-size:1.6rem; font-weight:800; color:#7c4dff; letter-spacing:2px; display:block; margin-top:4px; }
  .intro { margin:0 0 20px; line-height:1.7; color:#333; font-size:0.95rem; }
  .field  { margin-bottom:14px; }
  .field label { font-size:0.72rem; color:#888; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:4px; font-weight:600; }
  .field p { margin:0; background:#f7f7fa; border:1px solid #e8e8f0; border-radius:8px; padding:10px 14px; font-size:0.92rem; line-height:1.5; color:#1a1a2e; }
  .cta { display:block; text-align:center; background:#7c4dff; color:#fff !important; text-decoration:none; padding:13px 24px; border-radius:10px; font-weight:700; font-size:0.95rem; margin:20px 0 0; }
  .footer { border-top:1px solid #eee; padding:18px 32px; font-size:0.78rem; color:#999; text-align:center; }
  .footer a { color:#7c4dff; text-decoration:none; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🎮 Nusabit Studio</h1>
    <p>Customer Service — Konfirmasi Laporan</p>
  </div>
  <div class="body">
    <div class="ticket">
      <span class="ticket-label">Nomor Tiket Kamu</span>
      <span class="ticket-num">#${ticketId}</span>
    </div>
    <p class="intro">Halo! Kami telah menerima laporanmu. Tim Nusabit Studio akan segera meninjau dan menindaklanjuti. Simpan nomor tiket di atas untuk follow-up.</p>
    <div class="field"><label>Jenis</label><p>${typeLabel}</p></div>
    <div class="field"><label>Game</label><p>${game || 'Tidak disebutkan'}</p></div>
    <div class="field"><label>Laporan</label><p>${desc.replace(/\n/g,'<br>')}</p></div>
    <div class="field"><label>Waktu Masuk</label><p>${waktu}</p></div>
  </div>
  <div class="footer">
    Pertanyaan? Hubungi kami di <a href="mailto:dzakifaisal11@gmail.com">dzakifaisal11@gmail.com</a><br>
    atau <a href="https://discord.gg/f8jW6B3X">Discord Nusabit Studio</a>
  </div>
</div>
</body></html>`;
}

function emailAdminHtml(ticketId, type, game, desc, contact, email, summary, waktu) {
  const typeLabel = type === 'bug' ? '🐛 BUG REPORT' : '💡 SARAN';
  const accentColor = type === 'bug' ? '#e74c3c' : '#f39c12';
  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><style>
  body { font-family:'Segoe UI', Arial, sans-serif; background:#f4f4f7; color:#1a1a2e; margin:0; padding:0; }
  .wrap { max-width:580px; margin:32px auto; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.10); }
  .header { background:#1a1a2e; border-bottom:4px solid ${accentColor}; padding:20px 28px; }
  .header h1 { margin:0; font-size:1.1rem; color:#fff; }
  .header p  { margin:6px 0 0; color:#aaa; font-size:0.82rem; }
  .body { padding:24px 28px; }
  .ticket-badge { display:inline-block; background:#f0ebff; border:1.5px solid #7c4dff; border-radius:8px; padding:6px 16px; font-size:1rem; font-weight:800; color:#7c4dff; margin-bottom:20px; }
  .field { margin-bottom:14px; }
  .field label { font-size:0.72rem; color:#888; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:4px; font-weight:600; }
  .field p { margin:0; background:#f7f7fa; border:1px solid #e8e8f0; border-radius:8px; padding:10px 14px; font-size:0.9rem; line-height:1.5; color:#1a1a2e; }
  .ai-box { background:#f0fff6; border:1px solid #27ae60; border-radius:8px; padding:12px 14px; margin-bottom:14px; }
  .ai-box label { font-size:0.72rem; color:#27ae60; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:4px; font-weight:600; }
  .ai-box p { margin:0; font-size:0.9rem; line-height:1.5; color:#155724; }
  .footer { border-top:1px solid #eee; padding:14px 28px; font-size:0.78rem; color:#999; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>📋 ${typeLabel} — GRID SURVIVAL</h1>
    <p>${waktu}</p>
  </div>
  <div class="body">
    <div class="ticket-badge">#${ticketId}</div>
    <div class="field"><label>Game</label><p>${game || 'Tidak disebutkan'}</p></div>
    <div class="field"><label>Deskripsi Lengkap</label><p>${desc.replace(/\n/g,'<br>')}</p></div>
    <div class="ai-box"><label>🤖 Ringkasan AI</label><p>${summary}</p></div>
    <div class="field"><label>Email Pelapor</label><p>${email || '—'}</p></div>
    <div class="field"><label>Kontak Lain</label><p>${contact || '—'}</p></div>
  </div>
  <div class="footer">Nusabit Studio Admin Notification</div>
</div>
</body></html>`;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method tidak diizinkan' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

  const { type, game, desc, contact, email, ticketId: clientTicket } = body;
  if (!type || !desc || desc.trim().length < 10) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Data laporan tidak lengkap' }) };
  }

  // Pakai ticketId dari client, atau generate baru
  const ticketId = clientTicket || ('GS-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase());

  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  const fonnteToken  = process.env.FONNTE_API_KEY;
  const adminTarget  = process.env.ADMIN_WA_NUMBER;
  const resendKey    = process.env.RESEND_API_KEY;
  const adminEmail   = process.env.ADMIN_EMAIL || 'dzakifaisal11@gmail.com';
  const waktuWIB     = getNowWIBString();
  const typeLabel    = type === 'bug' ? '🐛 BUG REPORT' : '💡 SARAN';
  const gameLabel    = game || 'Tidak disebutkan';

  // 1. AI Summarize
  let summary = desc.trim();
  if (apiKeys.length) {
    const prompt = `Buat ringkasan singkat laporan berikut dalam 1-2 kalimat Bahasa Indonesia yang jelas untuk tim developer. Jangan tambah kalimat pembuka.\n\nJenis: ${type === 'bug' ? 'Bug/Error' : 'Saran'}\nGame: ${gameLabel}\nIsi: ${desc.trim()}`;
    for (const key of apiKeys) {
      try { const s = await callGemini(key, prompt); if (s) { summary = s; break; } }
      catch (e) { console.error('Gemini summarize error:', e.message); }
    }
  }

  // 2. Simpan tiket ke Netlify Blobs (nomor urut + token)
  const ticketData = await saveTicketToBlobs({ id: ticketId, type, game: gameLabel, desc: desc.trim(), email, contact, summary });
  const ticketNum  = ticketData?.num || '—';
  const ticketUrl  = ticketData ? `https://nusabit.netlify.app${ticketData.ticketUrl}` : '';

  // 3. WA admin via Fonnte
  if (fonnteToken && adminTarget) {
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

📧 *Email:* ${email || '—'}
📱 *Kontak:* ${contact || '—'}
━━━━━━━━━━━━━━━━━━━━
Update status tiket via /admin atau balas pesan ini dengan:
STATUS ${ticketId} seen|confirmed|done
━━━━━━━━━━━━━━━━━━━━`;
    await sendFonnte(fonnteToken, adminTarget, waMsg);
  }

  // 4. Email ke user (kalau ada email)
  if (resendKey && email && email.includes('@')) {
    const subjUser = `[Tiket #${ticketNum}] ${type === 'bug' ? 'Bug Dilaporkan' : 'Saran Diterima'} — Nusabit Studio`;
    const htmlUser = emailUserHtml(ticketId, type, gameLabel, desc.trim(), waktuWIB)
      .replace('</div>\n</body>', `
  <div class="body" style="padding-top:0;">
    <a href="${ticketUrl}" style="display:block;text-align:center;background:#7c4dff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:0.95rem;">🔍 Pantau Status Tiket Kamu</a>
  </div>
</div>\n</body>`);
    await sendEmail(resendKey, email, subjUser, htmlUser);
  }

  // 5. Email notif ke admin
  if (resendKey) {
    const subjAdmin = `[${typeLabel}] Tiket #${ticketNum} — ${gameLabel}`;
    await sendEmail(resendKey, adminEmail, subjAdmin, emailAdminHtml(ticketId, type, gameLabel, desc.trim(), contact, email, summary, waktuWIB));
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, summary, ticketId, ticketNum, ticketUrl: ticketData?.ticketUrl || '', message: 'Laporan berhasil dikirim!' }),
  };
};
