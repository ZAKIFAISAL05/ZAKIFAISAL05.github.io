// ============================================================
//  netlify/functions/cs-chat.js
//  Grid Survival CS Bot — Gemini Streaming (fast response)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const BOT_NAME     = 'Grid CS Bot';
const GEMINI_MODEL = 'gemini-3-flash-preview';
const RATE_MS      = 1500;
const lastRequest  = {};

function getNowWIB() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

function getTanggal(d) {
  return d.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
}

// Gemini NON-streaming (Netlify Functions tidak support true streaming response)
// Tapi kita optimalkan: token kecil + prompt singkat = cepat
async function callGemini(apiKey, systemPrompt, history, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const contents = [];
  // Maksimal 6 history terakhir saja supaya request lebih ringan
  for (const h of history.slice(-6)) {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        maxOutputTokens: 350,   // Cukup untuk jawaban lengkap, tetap cepat
        temperature:     0.55,  // Lebih konsisten, tidak ngelantur
        topP:            0.8,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message || res.statusText}`);
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
  } catch (_) { return false; }
}

// ── SYSTEM PROMPT: singkat, padat, profesional ──
function buildSystemPrompt(tanggal, gameList) {
  return `Kamu adalah ${BOT_NAME}, CS resmi Grid Survival (studio game indie Indonesia).

Tanggal: ${tanggal} WIB.
Game: ${gameList}

GAYA: Profesional, ramah, to-the-point. JANGAN bertele-tele. Jawab langsung tanpa basa-basi berlebihan. Gunakan bahasa Indonesia baku tapi santai. Maksimal 3-4 kalimat per balasan kecuali perlu detail teknis. WAJIB: Selalu selesaikan kalimat terakhirmu — jangan pernah berhenti di tengah kalimat.

TUGAS UTAMA:
- Info game, cara download, genre, platform (TapTap / Itch.io / Roblox)
- Troubleshoot bug / error
- Terima saran pemain
- Jawab pertanyaan umum tentang Grid Survival

LAPORAN BUG/SARAN LEWAT CHAT:
Kalau user lapor bug: tanya game + deskripsi singkat + email (opsional). Kalau sudah cukup info, konfirmasi dan sisipkan tag ini di AKHIR balasanmu (jangan tampil ke user):
[SUBMIT_REPORT:{"type":"bug","game":"nama game","desc":"deskripsi","email":"email atau kosong","contact":""}]

Kalau user kirim saran: dengarkan, apresiasi, tanya email kalau mau update, lalu sisipkan:
[SUBMIT_REPORT:{"type":"saran","game":"nama game","desc":"isi saran","email":"","contact":""}]

JANGAN pernah suruh user buka form website. Handle langsung di sini.

Kontak: Email dzakifaisal11@gmail.com | Discord discord.gg/f8jW6B3X`;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method tidak diizinkan' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

  const { text, from, userId, history, attachments } = body;
  const safeId = (userId || from || 'anon').trim().slice(0, 50);

  if (!text || !text.trim())
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Pesan kosong' }) };

  // Rate limit
  const now = Date.now();
  if (lastRequest[safeId] && (now - lastRequest[safeId]) < RATE_MS)
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, rateLimited: true }) };
  lastRequest[safeId] = now;

  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!apiKeys.length)
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key tidak dikonfigurasi' }) };

  const tanggal = getTanggal(getNowWIB());

  // Game list (coba dari Blobs, fallback hardcode)
  let gameList = 'Minecraft Parkun 2D, THE ONE FOR ZOMBIE, Desa Investasi Zombie, Gerbang Parkun 2D, Desa Cipta Karya Ch2, The Undeads (Roblox), Frequency Fury Obby (Roblox)';
  try {
    const { getStore } = require('@netlify/blobs');
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    const token  = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
    const opts   = { name: 'grid-survival', consistency: 'strong' };
    if (siteID && token) { opts.siteID = siteID; opts.token = token; }
    const store  = getStore(opts);
    const raw    = await store.get('game-catalog');
    if (raw) {
      const games = JSON.parse(raw);
      gameList = games.map(g => `${g.title} (${g.genre})`).join(', ');
    }
  } catch (_) {}

  const systemPrompt = buildSystemPrompt(tanggal, gameList);

  // Susun history Gemini (maks 6)
  const geminiHistory = (history || []).slice(-6).map(h => ({
    role: h.role === 'bot' ? 'model' : 'user',
    text: h.text,
  }));

  // Tambah info lampiran ke pesan
  let userMessage = text.trim();
  if (attachments && attachments.length) {
    userMessage += `\n[User melampirkan ${attachments.length} file: ${attachments.map(a => a.name).join(', ')}]`;
  }

  // Coba tiap API key
  let reply = '';
  for (const key of apiKeys) {
    try {
      reply = await callGemini(key, systemPrompt, geminiHistory, userMessage);
      if (reply) break;
    } catch (e) {
      console.error('Gemini error:', e.message);
    }
  }

  if (!reply) {
    reply = 'Maaf, CS sedang mengalami gangguan. Hubungi kami via Email: dzakifaisal11@gmail.com atau Discord: discord.gg/f8jW6B3X 🙏';
  }

  // Ekstrak tag SUBMIT_REPORT
  let reportSubmitted = false;
  let reportPayload   = null;
  const submitMatch   = reply.match(/\[SUBMIT_REPORT:(\{.*?\})\]/s);
  if (submitMatch) {
    try {
      reportPayload = JSON.parse(submitMatch[1]);
      if (attachments && attachments.length) {
        reportPayload.attachmentNames = attachments.map(a => a.name).join(', ');
        reportPayload.desc += '\n\n[Bukti: ' + reportPayload.attachmentNames + ']';
      }
      reportSubmitted = true;

      // Kirim WA notif ke admin
      const fonnteToken = process.env.FONNTE_API_KEY;
      const adminTarget = process.env.ADMIN_WA_NUMBER;
      if (fonnteToken && adminTarget && reportPayload) {
        const typeLabel = reportPayload.type === 'bug' ? '🐛 BUG REPORT' : '💡 SARAN';
        const waMsg =
`━━━━━━━━━━━━━━━━━━━━
${typeLabel} — GRID SURVIVAL (via CS Chat)
━━━━━━━━━━━━━━━━━━━━
🎮 *Game:* ${reportPayload.game || '—'}
📝 *Isi:* ${reportPayload.desc}
📧 *Email:* ${reportPayload.email || '—'}
📱 *Kontak:* ${reportPayload.contact || '—'}
⏰ *Waktu:* ${tanggal}
━━━━━━━━━━━━━━━━━━━━`;
        sendFonnte(fonnteToken, adminTarget, waMsg).catch(() => {});
      }
    } catch(e) { console.error('SUBMIT_REPORT parse error:', e.message); }
    reply = reply.replace(/\[SUBMIT_REPORT:.*?\]/s, '').trim();
  }

  // Format bold
  reply = reply.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, reply, from: BOT_NAME, reportSubmitted, reportPayload }),
  };
};
