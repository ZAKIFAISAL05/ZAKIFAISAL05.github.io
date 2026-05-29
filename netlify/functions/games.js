// ============================================================
//  netlify/functions/games.js
//  Nusabit Studio — Persistent Game Catalog API
//  Pakai Netlify Blobs untuk storage server-side permanen
//  GET    → list semua game
//  POST   → tambah / update game (body: { action:'add'|'update', game:{...} })
//  DELETE → hapus game (body: { id:'...' })
// ============================================================

const { getStore } = require('@netlify/blobs');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type':                 'application/json',
};

const STORE_KEY = 'game-catalog';

// Helper: buat store dengan fallback ke env vars manual
function createStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token  = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;

  const opts = { name: 'nusabit-studio', consistency: 'strong' };

  // Kalau env vars tersedia, inject manual (berguna saat netlify dev atau env tidak ter-inject)
  if (siteID && token) {
    opts.siteID = siteID;
    opts.token  = token;
  }

  return getStore(opts);
}

// Game default — hanya dipakai kalau belum ada data di Blobs sama sekali
const DEFAULT_GAMES = [
  { id:'minecraft-parkour-2d',       title:'Minecraft Parkun 2D',         genre:'Arcade',     desc:'Petualangan parkour seru 2D terinspirasi Minecraft.',    icon:'assets/img/mc_parkun_logo.png',     platforms:[{name:'TapTap (Mobile)',url:'https://www.taptap.io/app/236072',cls:'btn-taptap'}] },
  { id:'the-one-for-zombie',          title:'THE ONE FOR ZOMBIE',           genre:'Action',     desc:'Game aksi bertahan hidup melawan gerombolan zombie.',     icon:'assets/img/one_zombie_logo.png',    platforms:[{name:'TapTap (Mobile)',url:'https://www.taptap.io/app/346358',cls:'btn-taptap'}] },
  { id:'desa-karya-investasi-zombie', title:'Desa Karya Investasi Zombie',  genre:'Simulation', desc:'Manajemen desa, investasi, dan pertahanan zombie.',        icon:'assets/img/desa_invest_logo.png',   platforms:[{name:'TapTap (Mobile)',url:'https://www.taptap.io/app/33703520',cls:'btn-taptap'},{name:'Itch.io',url:'https://zakifaisalofficial.itch.io/desa-cipta-karya-invensi-zombie',cls:'btn-itchio'}] },
  { id:'gerbang-parkun-2d',           title:'Gerbang Parkun 2D',            genre:'Platformer', desc:'Parkour 2D kompetitif dengan speedrun challenge.',          icon:'assets/img/gerbang_parkun_logo.png',platforms:[{name:'Itch.io',url:'https://zakifaisalofficial.itch.io/gerbang-parkun-2d',cls:'btn-itchio'},{name:'TapTap (Mobile)',url:'https://www.taptap.io/app/33618770',cls:'btn-taptap'}] },
  { id:'desa-cipta-karya-ch2',        title:'Desa Cipta Karya Chapter 2',   genre:'Simulation', desc:'Kelanjutan simulasi pembangunan desa.',                    icon:'assets/img/cipta_karya2_logo.png',  platforms:[{name:'TapTap (Mobile)',url:'https://www.taptap.io/app/33752652',cls:'btn-taptap'},{name:'Itch.io',url:'https://zakifaisalofficial.itch.io/desa-karya-chapter-2',cls:'btn-itchio'}] },
  { id:'the-undeads-roblox',          title:'The Undeads (Roblox)',         genre:'Survival',   desc:'Game survival zombie populer di Roblox.',                  icon:'assets/img/undeads_roblox_logo.png',platforms:[{name:'Play on Roblox',url:'https://www.roblox.com/share?code=e4fd841cb9108b43bc5d7e7d9b47a2b3',cls:'btn-roblox'}] },
  { id:'frequency-fury-obby',         title:'Frequency Fury Obby (Roblox)',genre:'Arcade',     desc:'Obby parkour menantang di Roblox.',                        icon:'assets/img/frequency_fury_logo.png',platforms:[{name:'Play on Roblox',url:'https://www.roblox.com/id/games/113175281404228/Frequency-Fury-Obby',cls:'btn-roblox'}] },
];

async function getGames(store) {
  try {
    const raw = await store.get(STORE_KEY);
    if (!raw) return null; // null = belum ada data, perlu seed
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveGames(store, games) {
  await store.set(STORE_KEY, JSON.stringify(games));
}

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };

  let store;
  try {
    store = createStore();
  } catch (e) {
    console.error("[games.js] Gagal init Blobs store:", e.message);
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Storage tidak tersedia. Pastikan NETLIFY_SITE_ID dan NETLIFY_AUTH_TOKEN sudah di-set di Netlify dashboard.", detail: e.message }) };
  }

  // ── GET: ambil semua game ──
  if (event.httpMethod === 'GET') {
    let games = await getGames(store);
    if (games === null) {
      // Pertama kali — seed dengan DEFAULT_GAMES
      await saveGames(store, DEFAULT_GAMES);
      games = DEFAULT_GAMES;
    }
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, games }) };
  }

  // ── POST: tambah atau update game ──
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

    const { action, game } = body;
    if (!game || !game.id || !game.title) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Data game tidak lengkap' }) };
    }

    let games = await getGames(store) || [];

    if (action === 'update') {
      const idx = games.findIndex(g => g.id === game.id);
      if (idx === -1) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Game tidak ditemukan' }) };
      games[idx] = game;
    } else {
      // add — cek duplikat
      if (games.find(g => g.id === game.id)) {
        return { statusCode: 409, headers: CORS, body: JSON.stringify({ error: 'Game dengan ID ini sudah ada' }) };
      }
      games.push(game);
    }

    await saveGames(store, games);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, games }) };
  }

  // ── DELETE: hapus game ──
  if (event.httpMethod === 'DELETE') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

    const { id } = body;
    if (!id) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'ID game wajib diisi' }) };

    let games = await getGames(store) || [];
    const before = games.length;
    games = games.filter(g => g.id !== id);
    if (games.length === before) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Game tidak ditemukan' }) };

    await saveGames(store, games);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, games }) };
  }

  // ── PUT: reorder / replace semua game (untuk drag reorder) ──
  if (event.httpMethod === 'PUT') {
    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Body tidak valid' }) }; }

    const { games } = body;
    if (!Array.isArray(games)) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'games harus array' }) };

    await saveGames(store, games);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, games }) };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method tidak diizinkan' }) };
};
