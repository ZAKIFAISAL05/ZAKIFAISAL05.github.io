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
const RATE_MS     = 6000;

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
    generationConfig: { maxOutputTokens: 300, temperature: 0.8 },
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

  const systemPrompt = `Kamu adalah ${BOT_NAME}, customer service resmi Grid Survival — studio game indie dari Indonesia.

Hari ini: ${namaHari}, ${tanggal} (WIB).

Gaya bicara kamu: ramah, sopan, tapi tetap santai dan friendly. Pakai bahasa Indonesia yang natural. Jawab singkat dan jelas, maks 3-4 kalimat kecuali perlu lebih panjang.

Kamu BISA membantu soal:
- Informasi game Grid Survival (Minecraft Parkun 2D, THE ONE FOR ZOMBIE, Desa Investasi Zombie, Gerbang Parkun 2D, Desa Cipta Karya Ch2, The Undeads Roblox, Frequency Fury Obby)
- Download game (platform: TapTap, Itch.io, Roblox)
- Cara main, tips & trik game
- Bug / error yang dialami pemain
- Saran dan masukan untuk game
- Info studio Grid Survival

Kamu TIDAK bisa:
- Membuat perubahan langsung di game
- Memberikan kompensasi atau item gratis
- Mengakses data akun pemain

Kalau ada yang lapor bug atau error, minta mereka isi form di website (tombol "Laporkan Bug") dan yakinkan laporan akan diproses. Kalau ada saran, apresiasi dan catat bahwa saran diteruskan ke tim developer.

Kontak tambahan: Email dzakifaisal11@gmail.com | Discord: discord.gg/f8jW6B3X | WA Channel: whatsapp.com/channel/0029VaAxK4O2975D8utbc927`;

  // Konversi history (maks 6 pesan terakhir)
  const geminiHistory = (history || []).slice(-6).map(h => ({
    role: h.role === 'bot' ? 'model' : 'user',
    text: h.text,
  }));

  let reply = '';
  for (const key of apiKeys) {
    try {
      reply = await callGemini(key, systemPrompt, geminiHistory, text.trim());
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

  // Format bold WhatsApp style
  reply = reply.replace(/\*\*([^*]+)\*\*/g, '*$1*');

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ ok: true, reply, from: BOT_NAME }),
  };
};
