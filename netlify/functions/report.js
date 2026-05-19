// ============================================================
//  netlify/functions/report.js — Grid Survival
//  POST { type, game, desc, contact, email, ticketId }
//  1. Generate / terima ticketId
//  2. AI summarize via Gemini
//  3. Kirim notif WA admin via Fonnte
//  4. Kirim email konfirmasi ke user (jika ada email)
//  5. Kirim email notif ke admin
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const GEMINI_MODEL = 'gemini-3-flash-preview';

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
        from:    'Grid Survival CS <cs@gridsurvival.id>',
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
  body { font-family: 'Segoe UI', sans-serif; background:#0d0d0d; color:#e0e0e0; margin:0; padding:0; }
  .wrap { max-width:560px; margin:32px auto; background:#1a1a2e; border-radius:16px; overflow:hidden; }
  .header { background:linear-gradient(135deg,#7c4dff,#00e5ff); padding:28px 32px; text-align:center; }
  .header h1 { color:#fff; margin:0; font-size:1.4rem; letter-spacing:1px; }
  .header p  { color:rgba(255,255,255,0.85); margin:6px 0 0; font-size:0.9rem; }
  .body { padding:28px 32px; }
  .ticket { background:#0d0d1a; border:2px solid #7c4dff; border-radius:12px; padding:16px 24px; text-align:center; margin-bottom:24px; }
  .ticket-label { font-size:0.72rem; color:#888; text-transform:uppercase; letter-spacing:1px; display:block; }
  .ticket-num   { font-size:1.6rem; font-weight:800; color:#7c4dff; letter-spacing:2px; display:block; margin-top:4px; }
  .field  { margin-bottom:16px; }
  .field label { font-size:0.75rem; color:#888; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:4px; }
  .field p     { margin:0; background:#0d0d1a; border-radius:8px; padding:10px 14px; font-size:0.92rem; line-height:1.5; }
  .footer { border-top:1px solid #222; padding:20px 32px; font-size:0.78rem; color:#666; text-align:center; }
  .footer a { color:#7c4dff; text-decoration:none; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🎮 Grid Survival</h1>
    <p>Customer Service — Konfirmasi Laporan</p>
  </div>
  <div class="body">
    <div class="ticket">
      <span class="ticket-label">Nomor Tiket Kamu</span>
      <span class="ticket-num">#${ticketId}</span>
    </div>
    <p style="margin:0 0 20px;line-height:1.6;">Halo! Kami telah menerima laporanmu. Tim Grid Survival akan segera meninjau dan menindaklanjuti. Simpan nomor tiket di atas untuk follow-up.</p>
    <div class="field"><label>Jenis</label><p>${typeLabel}</p></div>
    <div class="field"><label>Game</label><p>${game || 'Tidak disebutkan'}</p></div>
    <div class="field"><label>Laporan</label><p>${desc.replace(/\n/g,'<br>')}</p></div>
    <div class="field"><label>Waktu Masuk</label><p>${waktu}</p></div>
  </div>
  <div class="footer">
    Pertanyaan? Hubungi kami di <a href="mailto:dzakifaisal11@gmail.com">dzakifaisal11@gmail.com</a><br>
    atau <a href="https://discord.gg/f8jW6B3X">Discord Grid Survival</a>
  </div>
</div>
</body></html>`;
}

function emailAdminHtml(ticketId, type, game, desc, contact, email, summary, waktu) {
  const typeLabel = type === 'bug' ? '🐛 BUG REPORT' : '💡 SARAN';
  return `
<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><style>
  body { font-family:'Segoe UI',sans-serif; background:#0d0d0d; color:#e0e0e0; margin:0; padding:0; }
  .wrap { max-width:580px; margin:32px auto; background:#1a1a2e; border-radius:16px; overflow:hidden; }
  .header { background:#111; border-bottom:3px solid #7c4dff; padding:20px 28px; }
  .header h1 { margin:0; font-size:1.1rem; color:#7c4dff; }
  .header p  { margin:4px 0 0; color:#888; font-size:0.82rem; }
  .body { padding:24px 28px; }
  .ticket { display:inline-block; background:#7c4dff22; border:1.5px solid #7c4dff; border-radius:8px; padding:6px 16px; font-size:1rem; font-weight:700; color:#7c4dff; margin-bottom:20px; }
  .field { margin-bottom:14px; }
  .field label { font-size:0.72rem; color:#888; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:3px; }
  .field p { margin:0; background:#111; border-radius:8px; padding:10px 14px; font-size:0.9rem; line-height:1.5; }
  .ai-box { background:#0d2a1a; border:1px solid #27ae60; border-radius:8px; padding:12px 14px; margin-bottom:14px; }
  .ai-box label { font-size:0.72rem; color:#27ae60; text-transform:uppercase; letter-spacing:0.8px; display:block; margin-bottom:4px; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>📋 ${typeLabel} — GRID SURVIVAL</h1>
    <p>${waktu}</p>
  </div>
  <div class="body">
    <div class="ticket">#${ticketId}</div>
    <div class="field"><label>Game</label><p>${game || 'Tidak disebutkan'}</p></div>
    <div class="field"><label>Deskripsi Lengkap</label><p>${desc.replace(/\n/g,'<br>')}</p></div>
    <div class="ai-box"><label>🤖 Ringkasan AI</label><p>${summary}</p></div>
    <div class="field"><label>Email Pelapor</label><p>${email || '—'}</p></div>
    <div class="field"><label>Kontak Lain</label><p>${contact || '—'}</p></div>
  </div>
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

  // 2. WA admin via Fonnte
  if (fonnteToken && adminTarget) {
    const waMsg =
`━━━━━━━━━━━━━━━━━━━━
${typeLabel} — GRID SURVIVAL
Tiket: *#${ticketId}*
━━━━━━━━━━━━━━━━━━━━
📅 *Waktu:* ${waktuWIB}
🎮 *Game:* ${gameLabel}
📝 *Deskripsi:*
${desc.trim()}

🤖 *Ringkasan AI:*
${summary}

📧 *Email:* ${email || '—'}
📱 *Kontak:* ${contact || '—'}
━━━━━━━━━━━━━━━━━━━━`;
    await sendFonnte(fonnteToken, adminTarget, waMsg);
  }

  // 3. Email ke user (kalau ada email)
  if (resendKey && email && email.includes('@')) {
    const subjUser = `[#${ticketId}] ${type === 'bug' ? 'Bug Dilaporkan' : 'Saran Diterima'} — Grid Survival`;
    await sendEmail(resendKey, email, subjUser, emailUserHtml(ticketId, type, gameLabel, desc.trim(), waktuWIB));
  }

  // 4. Email notif ke admin
  if (resendKey) {
    const subjAdmin = `[${typeLabel}] #${ticketId} — ${gameLabel}`;
    await sendEmail(resendKey, adminEmail, subjAdmin, emailAdminHtml(ticketId, type, gameLabel, desc.trim(), contact, email, summary, waktuWIB));
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, summary, ticketId, message: 'Laporan berhasil dikirim!' }),
  };
};
