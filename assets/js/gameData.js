// assets/js/gameData.js
// Data semua game Nusabit Studio

const gameData = [
    {
        id: 'minecraft-parkour-2d',
        title: 'Minecraft Parkun 2D',
        logo: 'assets/img/mc_parkun_logo.png',
        thumb: 'assets/img/mc_parkun_thumb.jpg',
        desc: 'Petualangan parkour seru dalam format 2D yang terinspirasi dari dunia Minecraft. Lompat, hindari rintangan, dan selesaikan tantangan secepat mungkin!',
        genre: 'Arcade',
        gallery: [
            'assets/img/mc_parkun_ss1.jpg',
            'assets/img/mc_parkun_ss2.jpg',
            'assets/img/mc_parkun_ss3.jpg',
            'assets/img/mc_parkun_ss4.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/236072?utm_medium=share&utm_source=copylink', cls: 'btn-taptap' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'the-one-for-zombie',
        title: 'THE ONE FOR ZOMBIE',
        logo: 'assets/img/one_zombie_logo.png',
        thumb: 'assets/img/one_zombie_thumb.jpg',
        desc: 'Game aksi bertahan hidup melawan gerombolan zombie. Kumpulkan senjata dan selamatkan yang tersisa. Hanya satu yang akan bertahan!',
        genre: 'Action',
        gallery: [
            'assets/img/one_zombie_ss1.jpg',
            'assets/img/one_zombie_ss2.jpg',
            'assets/img/one_zombie_ss3.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/346358?utm_medium=share&utm_source=copylink', cls: 'btn-taptap' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'desa-karya-investasi-zombie',
        title: 'DESA KARYA INVESTASI ZOMBIE',
        logo: 'assets/img/desa_invest_logo.png',
        thumb: 'assets/img/desa_invest_thumb.jpg',
        desc: 'Gabungan unik antara manajemen desa, investasi, dan pertahanan melawan serangan zombie. Kelola sumber daya Anda dengan bijak.',
        genre: 'Simulation',
        gallery: [
            'assets/img/desa_invest_ss1.jpg',
            'assets/img/desa_invest_ss2.jpg',
            'assets/img/desa_invest_ss3.jpg',
            'assets/img/desa_invest_ss4.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33703520', cls: 'btn-taptap' },
            { name: 'Itch.io (Mobile)', url: 'https://zakifaisalofficial.itch.io/desa-cipta-karya-invensi-zombie', cls: 'btn-itchio' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'gerbang-parkun-2d',
        title: 'Gerbang Parkun 2D',
        logo: 'assets/img/gerbang_parkun_logo.png',
        thumb: 'assets/img/gerbang_parkun_thumb.jpg',
        desc: 'Parkour 2D dengan level yang menantang dan speedrun yang kompetitif. Buka gerbang menuju level berikutnya dengan skill lompatan sempurna.',
        genre: 'Platformer',
        gallery: [
            'assets/img/gerbang_parkun_ss1.jpg',
            'assets/img/gerbang_parkun_ss2.jpg',
            'assets/img/gerbang_parkun_ss3.jpg'
        ],
        platforms: [
            { name: 'Itch.io (Mobile/Windows)', url: 'https://zakifaisalofficial.itch.io/gerbang-parkun-2d', cls: 'btn-itchio' },
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33618770', cls: 'btn-taptap' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'desa-cipta-karya-ch2',
        title: 'Desa Cipta Karya Chapter 2',
        logo: 'assets/img/cipta_karya2_logo.png',
        thumb: 'assets/img/cipta_karya2_thumb.jpg',
        desc: 'Kelanjutan dari kisah pembangunan desa dan simulasi kehidupan. Hadapi tantangan baru dan kembangkan desa hingga makmur.',
        genre: 'Simulation',
        gallery: [
            'assets/img/cipta_karya2_ss1.jpg',
            'assets/img/cipta_karya2_ss2.jpg',
            'assets/img/cipta_karya2_ss3.jpg',
            'assets/img/cipta_karya2_ss4.jpg'
        ],
        platforms: [
            { name: 'TapTap (Mobile)', url: 'https://www.taptap.io/app/33752652?share_id=d04b5dd55ff9&utm_medium=share&utm_source=copylink', cls: 'btn-taptap' },
            { name: 'Itch.io (Mobile)', url: 'https://zakifaisalofficial.itch.io/desa-karya-chapter-2', cls: 'btn-itchio' },
            { name: 'Amazon (Mobile)', url: 'https://www.amazon.com/gp/product/B0DH53XXFR', cls: 'btn-amazon' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'the-undeads-roblox',
        title: 'The Undeads (Roblox)',
        logo: 'assets/img/undeads_roblox_logo.png',
        thumb: 'assets/img/undeads_roblox_thumb.jpg',
        desc: 'Game aksi bertahan hidup populer di Roblox. Bentuk tim, bangun pertahanan, dan lawan gelombang mayat hidup yang tak ada habisnya.',
        genre: 'Survival, Action',
        gallery: [
            'assets/img/undeads_roblox_ss1.jpg',
            'assets/img/undeads_roblox_ss4.jpg',
            'assets/img/undeads_roblox_ss3.jpg',
            'assets/img/undeads_roblox_ss2.jpg'
        ],
        platforms: [
            { name: 'Play on Roblox', url: 'https://www.roblox.com/share?code=e4fd841cb9108b43bc5d7e7d9b47a2b3&type=ExperienceDetails&stamp=1765460894310', cls: 'btn-roblox' }
        ],
        developer: 'Nusabit Studio'
    },
    {
        id: 'frequency-fury-obby',
        title: 'Frequency Fury Obby (Roblox)',
        logo: 'assets/img/frequency_fury_logo.png',
        thumb: 'assets/img/frequency_fury_thumb.jpg',
        desc: 'Adu nyali dan kecepatanmu dalam Frequency Fury Obby — tantangan rintangan yang menguji ketepatan dan kecepatan sebelum frekuensi bass menghantammu.',
        genre: 'Arcade, Platformer',
        gallery: [
            'assets/img/frequency_fury_ss1.jpg',
            'assets/img/frequency_fury_ss2.jpg',
            'assets/img/frequency_fury_ss3.jpg'
        ],
        platforms: [
            { name: 'Play on Roblox', url: 'https://www.roblox.com/id/games/113175281404228/Frequency-Fury-Obby', cls: 'btn-roblox' }
        ],
        developer: 'Nusabit Studio'
    }
];

// ─────────────────────────────────────────────────────────
//  SMART LOADER — cek localStorage dulu (dari Admin Panel)
//  Kalau admin sudah hapus/tambah game, pakai data itu.
//  Format admin simpan { id, title, genre, desc, icon, platforms }
//  kita merge supaya tetap punya field gallery & developer.
// ─────────────────────────────────────────────────────────
(function mergeAdminData() {
    var STORAGE_KEY = 'gs_catalog_games';
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch(e) { return; }
    if (!raw) return;

    var adminGames;
    try { adminGames = JSON.parse(raw); } catch(e) { return; }
    if (!Array.isArray(adminGames) || !adminGames.length) return;

    // Konversi format admin → format gameData
    var merged = adminGames.map(function(ag) {
        // Cari entry lama (pakai gallery & developer dari sana)
        var existing = gameData.find(function(g) { return g.id === ag.id; });
        return {
            id:        ag.id,
            title:     ag.title,
            logo:      ag.icon  || (existing && existing.logo)  || 'assets/img/studio_logo.png',
            thumb:     ag.icon  || (existing && existing.thumb) || 'assets/img/studio_logo.png',
            desc:      ag.desc  || (existing && existing.desc)  || '',
            genre:     ag.genre || (existing && existing.genre) || '',
            gallery:   (existing && existing.gallery)  || [],
            platforms: ag.platforms || (existing && existing.platforms) || [],
            developer: 'Nusabit Studio'
        };
    });

    // Ganti gameData global dengan hasil merge
    gameData.length = 0;
    merged.forEach(function(g) { gameData.push(g); });
})();
