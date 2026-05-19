// ============================================================
//  netlify/functions/cs-chat.js
//  Customer Service AI Chat — Grid Survival
//  POST { text, history, from } → balas via Gemini AI
//  Script AI by YMB (tidak diubah modulenya)
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const BOT_NAME     = 'Grid CS Bot';
const GEMINI_MODEL = 'gemini-3-flash-preview';

// Rate limit sederhana (in-memory, reset tiap deploy)
const lastRequest = {};
const RATE_MS     = 2000;

function getNowWIB() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

function getNamaHari(d) {
  return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
}

function getTanggal(d) {
  return d.toLocaleDateString('id-ID', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
}

async function callGemini(apiKey, systemPrompt, history, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const contents = [];
  for (const h of history) {
    contents.push({ role: h.role, parts: [{ text: h.text }] });
  }
  contents.push({ role: 'user', parts: [{ text: userMessage }] });

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
  };

  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    throw new Error(`Gemini ${res.status}: ${msg}`);
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// Kirim notifikasi WA via Fonnte
async function sendFonnte(token, target, message) {
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { 'Authorization': token },
    body: new URLSearchParams({ target, message, delay: '0', countryCode: '62' }),
  });
  return res.ok;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method tidak diizinkan' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

  const { text, from, userId, history } = body;
  const safeFrom = (from  || 'Pengunjung').trim().slice(0, 30);
  const safeId   = (userId || safeFrom).trim().slice(0, 50);

  if (!text || !text.trim()) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Pesan kosong' }) };
  }

  // Rate limit
  const now = Date.now();
  if (lastRequest[safeId] && (now - lastRequest[safeId]) < RATE_MS) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, rateLimited: true }) };
  }
  lastRequest[safeId] = now;

  // Ambil API keys (3 cadangan)
  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  if (!apiKeys.length) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'API key tidak dikonfigurasi' }) };
  }

  const nowWIB   = getNowWIB();
  const namaHari = getNamaHari(nowWIB);
  const tanggal  = getTanggal(nowWIB);

  // Ambil daftar game terbaru dari Blobs
  let gameListText = 'Minecraft Parkun 2D, THE ONE FOR ZOMBIE, Desa Investasi Zombie, Gerbang Parkun 2D, Desa Cipta Karya Ch2, The Undeads (Roblox), Frequency Fury Obby (Roblox)';
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
      gameListText = games.map(g => `${g.title} (${g.genre})`).join(', ');
    }
  } catch (_) { /* pakai fallback di atas */ }

  const systemPrompt = `Kamu adalah ${BOT_NAME}, customer service resmi Grid Survival — studio game indie dari Indonesia yang berdiri sejak 2021.

Hari ini: ${namaHari}, ${tanggal} (WIB).

Gaya bicara kamu: ramah, sopan, santai, dan friendly. Pakai bahasa Indonesia yang natural dan mudah dipahami. Jawab selengkap yang dibutuhkan. Kalau pertanyaannya singkat, jawab singkat; kalau butuh detail, berikan penjelasan lengkap.

Daftar game Grid Survival saat ini: ${gameListText}

Kamu BISA membantu soal:
- Informasi lengkap tiap game (genre, cara main, tips & trik, platform tersedia)
- Link download game (TapTap, Itch.io, Roblox)
- Troubleshooting bug / error yang dialami pemain
- Saran dan masukan untuk game
- Info studio Grid Survival, tim developer, sejarah studio
- Pertanyaan umum seputar game indie Indonesia

Kamu TIDAK bisa:
- Membuat perubahan langsung di game
- Memberikan kompensasi atau item gratis
- Mengakses data akun pemain

=== PENTING: LAPORAN BUG & SARAN LANGSUNG LEWAT CHAT ===
Kalau ada yang mau lapor bug atau kirim saran, JANGAN suruh mereka pergi ke form website. Kamu yang handle langsung di sini. Proses yang harus kamu ikuti:

1. Kalau user bilang ada bug/error atau mau lapor masalah:
   - Tanya game mana yang bermasalah (kalau belum disebutkan)
   - Minta deskripsi bug yang jelas (apa yang terjadi, langkah reproduksi)
   - Tanya apakah ada gambar/video bukti (bisa dikirim lewat tombol lampiran)
   - Tanya email mereka untuk konfirmasi tiket (opsional tapi dianjurkan)
   - Setelah dapat info cukup, konfirmasi ke user bahwa laporannya siap diteruskan ke developer

2. Kalau user mau kirim saran:
   - Dengarkan dan tanya detail saran mereka
   - Apresiasi ide mereka dengan tulus
   - Tanya email kalau mereka mau dapat update
   - Setelah dapat info cukup, konfirmasi siap diteruskan

3. Saat info laporan sudah lengkap (paling tidak ada deskripsi yang jelas), balas dengan tag khusus ini di AKHIR pesanmu (jangan ditampilkan ke user, ini untuk sistem):
   [SUBMIT_REPORT:{"type":"bug","game":"nama game","desc":"deskripsi lengkap","email":"email@user.com","contact":""}]
   Atau untuk saran:
   [SUBMIT_REPORT:{"type":"saran","game":"nama game","desc":"isi saran","email":"email@user.com","contact":""}]

INGAT: Kamu CS yang proaktif. Kamu yang kumpulkan info dan teruskan ke developer — user tidak perlu kemana-mana.

Kalau ada lampiran gambar/video yang dikirim user, sebutkan bahwa bukti visual mereka sudah diterima dan akan diteruskan bersama laporan.

Kontak tambahan: Email dzakifaisal11@gmail.com | Discord: discord.gg/f8jW6B3X | WA Channel: whatsapp.com/channel/0029VaAxK4O2975D8utbc927`;

  // Konversi history (maks 6 pesan terakhir)
  const geminiHistory = (history || []).slice(-10).map(h => ({
    role: h.role === 'bot' ? 'model' : 'user',
    text: h.text,
  }));

  // Tambahkan info lampiran ke pesan user kalau ada
  const { attachments } = body;
  let userMessage = text.trim();
  if (attachments && attachments.length) {
    const fileNames = attachments.map(a => a.name).join(', ');
    userMessage += `\n[User melampirkan ${attachments.length} file bukti: ${fileNames}]`;
  }

  let reply = '';
  for (const key of apiKeys) {
    try {
      reply = await callGemini(key, systemPrompt, geminiHistory, userMessage);
      if (reply) break;
    } catch (e) {
      console.error('Gemini CS error:', e.message);
    }
  }

  if (!reply) {
    const fallbacks = [
      'Maaf, CS lagi ada gangguan. Silakan hubungi kami via Email: dzakifaisal11@gmail.com 🙏',
      'Aduh, koneksi AI lagi bermasalah. Coba lagi sebentar ya, atau langsung DM Discord kami! 😅',
    ];
    reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Ekstrak tag SUBMIT_REPORT jika ada
  let reportSubmitted = false;
  let reportPayload   = null;
  const submitMatch = reply.match(/\[SUBMIT_REPORT:(\{.*?\})\]/s);
  if (submitMatch) {
    try {
      reportPayload   = JSON.parse(submitMatch[1]);
      // Sertakan attachment info (nama file) ke payload
      if (body.attachments && body.attachments.length) {
        reportPayload.attachmentNames = body.attachments.map(a => a.name).join(', ');
        reportPayload.desc += '\n\n[Bukti: ' + reportPayload.attachmentNames + ']';
      }
      reportSubmitted = true;
    } catch(e) { console.error('SUBMIT_REPORT parse error:', e.message); }
    // Hapus tag dari reply sebelum dikirim ke user
    reply = reply.replace(/\[SUBMIT_REPORT:.*?\]/s, '').trim();
  }

  // Tambahkan konteks lampiran ke pesan user kalau ada (fallback jika reply kosong)
  if (attachments && attachments.length && !reply) {
    reply = 'Oke, bukti visualnya sudah aku terima! Ceritain juga ya bug atau masalah yang kamu temukan supaya aku bisa terusin ke tim developer.';
  }

  // Format bold WhatsApp style
  reply = reply.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, reply, from: BOT_NAME, reportSubmitted, reportPayload }),
  };
};
