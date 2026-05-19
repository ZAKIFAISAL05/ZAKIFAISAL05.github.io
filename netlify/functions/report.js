// ============================================================
//  netlify/functions/report.js
//  Bug Report & Saran — Grid Survival
//  POST { type, game, desc, contact } →
//    1. AI summarize via Gemini
//    2. Kirim notif WA ke admin via Fonnte
//    3. Return summary
// ============================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json',
};

const GEMINI_MODEL = 'gemini-3-flash-preview';

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 200, temperature: 0.5 },
  };
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || res.statusText);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function sendFonnte(token, target, message) {
  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: new URLSearchParams({
        target,
        message,
        delay: '0',
        countryCode: '62',
      }),
    });
    const data = await res.json();
    console.log('Fonnte response:', JSON.stringify(data));
    return res.ok;
  } catch (e) {
    console.error('Fonnte error:', e.message);
    return false;
  }
}

function getNowWIBString() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method tidak diizinkan' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

  const { type, game, desc, contact } = body;
  if (!type || !desc || desc.trim().length < 10) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Data laporan tidak lengkap' }) };
  }

  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
  ].filter(Boolean);

  const fonnteToken  = process.env.FONNTE_API_KEY;
  const adminTarget  = process.env.ADMIN_WA_NUMBER; // nomor WA admin, format: 628xxxx
  const waktuWIB     = getNowWIBString();
  const typeLabel    = type === 'bug' ? '🐛 BUG REPORT' : '💡 SARAN';
  const gameLabel    = game || 'Tidak disebutkan';
  const contactLabel = contact || 'Tidak ada';

  // 1. AI Summarize
  let summary = desc.trim();
  if (apiKeys.length) {
    const prompt = `Kamu adalah asisten studio game. Buat ringkasan singkat laporan berikut dalam 1-2 kalimat Bahasa Indonesia yang jelas dan informatif untuk tim developer. Jangan tambah kalimat pembuka. Laporan:\n\nJenis: ${type === 'bug' ? 'Bug/Error' : 'Saran'}\nGame: ${gameLabel}\nIsi: ${desc.trim()}`;
    for (const key of apiKeys) {
      try {
        const s = await callGemini(key, prompt);
        if (s) { summary = s; break; }
      } catch (e) { console.error('Gemini summarize error:', e.message); }
    }
  }

  // 2. Kirim WA ke admin via Fonnte
  if (fonnteToken && adminTarget) {
    const waMsg =
`━━━━━━━━━━━━━━━━━━━━
${typeLabel} — GRID SURVIVAL
━━━━━━━━━━━━━━━━━━━━
📅 *Waktu:* ${waktuWIB}
🎮 *Game:* ${gameLabel}
📝 *Deskripsi:*
${desc.trim()}

🤖 *Ringkasan AI:*
${summary}

📱 *Kontak Pelapor:*
${contactLabel}
━━━━━━━━━━━━━━━━━━━━
_Cek panel admin: zakifaisal05.github.io/admin/_`;

    await sendFonnte(fonnteToken, adminTarget, waMsg);
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      ok: true,
      summary,
      message: 'Laporan berhasil dikirim! Tim kami akan segera menangani.',
    }),
  };
};
