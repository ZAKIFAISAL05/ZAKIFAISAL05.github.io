// extras.js — Grid Survival
// Dark mode • Mascot • Particles • Stats • Filter • Easter Egg • Toast • Scroll Top
(function () {
    'use strict';

    var html = document.documentElement;

    /* ══════════════════════════════════════════
       DARK / LIGHT THEME TOGGLE
    ══════════════════════════════════════════ */
    var tbtn   = document.getElementById('themeToggle');
    var ticon  = tbtn  && tbtn.querySelector('.t-icon');
    var tlabel = tbtn  && tbtn.querySelector('.t-label');

    function applyTheme(t) {
        html.setAttribute('data-theme', t);
        localStorage.setItem('gs-theme', t);
        if (ticon)  ticon.textContent  = t === 'dark' ? '🌙' : '☀️';
        if (tlabel) tlabel.textContent = t === 'dark' ? 'DARK' : 'LITE';
    }

    applyTheme(localStorage.getItem('gs-theme') || 'dark');

    if (tbtn) {
        tbtn.addEventListener('click', function () {
            applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        });
    }

    /* ══════════════════════════════════════════
       TOAST NOTIFICATION
    ══════════════════════════════════════════ */
    var toastEl = document.getElementById('toast');
    var toastTimer;
    function showToast(msg) {
        if (!toastEl) return;
        clearTimeout(toastTimer);
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
    }

    /* ══════════════════════════════════════════
       MASCOT BUBBLE TYPING
    ══════════════════════════════════════════ */
    var msgs = [
        'HELLO! 👾', 'WELCOME!', 'PLAY OUR GAMES!',
        'GRID SURVIVAL!', 'SELAMAT DATANG!', 'KLIK AKU! 😄',
        'INDIE FROM ID! 🇮🇩', 'HAVE FUN! 🎮', 'EST. 2024 ⚔️'
    ];
    var mi = 0, ci = 0, typing = true, pt = null;
    var btxt = document.getElementById('btext');

    function tick() {
        if (!btxt) return;
        var m = msgs[mi];
        if (typing) {
            if (ci < m.length) { btxt.textContent += m.charAt(ci++); setTimeout(tick, 80); }
            else { pt = setTimeout(function () { typing = false; tick(); }, 2400); }
        } else {
            if (ci > 0) { btxt.textContent = btxt.textContent.slice(0, --ci); setTimeout(tick, 38); }
            else { mi = (mi + 1) % msgs.length; typing = true; setTimeout(tick, 350); }
        }
    }
    setTimeout(tick, 1400);

    var mascotEl = document.getElementById('mascot');
    if (mascotEl) {
        mascotEl.addEventListener('click', function () {
            clearTimeout(pt);
            if (btxt) btxt.textContent = '';
            ci = 0; typing = true;
            mi = (mi + 1) % msgs.length;
            tick();
            showToast('> GRID SURVIVAL!');
        });
    }

    /* ══════════════════════════════════════════
       SCROLL TO TOP BUTTON
    ══════════════════════════════════════════ */
    var stb = document.getElementById('scrollTopBtn');
    if (stb) {
        window.addEventListener('scroll', function () {
            stb.classList.toggle('show', window.scrollY > 350);
        });
        stb.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ══════════════════════════════════════════
       GENRE FILTER TABS
    ══════════════════════════════════════════ */
    var tabs     = document.querySelectorAll('.filter-tab');
    var allCards = document.querySelectorAll('.game-card');

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var genre = tab.getAttribute('data-genre');
            tabs.forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');

            allCards.forEach(function (card) {
                if (genre === 'all') {
                    card.classList.remove('hidden');
                } else {
                    var g = (card.getAttribute('data-genre') || '').toLowerCase();
                    card.classList.toggle('hidden', g.indexOf(genre) === -1);
                }
            });
        });
    });

    /* ══════════════════════════════════════════
       STATS COUNTER ANIMATION
    ══════════════════════════════════════════ */
    var statsSection = document.getElementById('stats-section');
    if (statsSection) {
        var statNums = statsSection.querySelectorAll('.stat-number');
        var statsObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                statNums.forEach(function (el) {
                    var target = parseInt(el.getAttribute('data-target'), 10);
                    var suffix = el.getAttribute('data-suffix') || '';
                    var start  = 0;
                    var dur    = 1600;
                    var step   = 16;
                    var steps  = dur / step;
                    var inc    = target / steps;
                    var curr   = 0;
                    var timer  = setInterval(function () {
                        curr += inc;
                        if (curr >= target) { curr = target; clearInterval(timer); }
                        el.textContent = Math.floor(curr) + suffix;
                    }, step);
                });
                statsObserver.disconnect();
            });
        }, { threshold: 0.3 });
        statsObserver.observe(statsSection);
    }

    /* ══════════════════════════════════════════
       KONAMI CODE EASTER EGG
       ↑ ↑ ↓ ↓ ← → ← → B A
    ══════════════════════════════════════════ */
    var KONAMI = [38,38,40,40,37,39,37,39,66,65];
    var kIdx   = 0;
    var eeEl   = document.getElementById('easter-egg');

    document.addEventListener('keydown', function (e) {
        if (e.keyCode === KONAMI[kIdx]) {
            kIdx++;
            if (kIdx === KONAMI.length) {
                kIdx = 0;
                if (eeEl) eeEl.classList.add('show');
            }
        } else { kIdx = 0; }
    });
    if (eeEl) {
        eeEl.addEventListener('click', function () { eeEl.classList.remove('show'); });
    }

    /* ══════════════════════════════════════════
       PIXEL PARTICLE BACKGROUND
    ══════════════════════════════════════════ */
    var cv = document.getElementById('pcanvas');
    if (!cv) return;
    var cx = cv.getContext('2d');

    function rsz() { cv.width = window.innerWidth; cv.height = window.innerHeight; }
    rsz();
    window.addEventListener('resize', rsz);

    var DARK_C = ['#00ff41','#00e5ff','#ffe600','#c86fdf'];
    var LITE_C = ['#007a1f','#006ea8','#a07b00','#7b2fa3'];
    function rndCol() {
        var arr = html.getAttribute('data-theme') === 'dark' ? DARK_C : LITE_C;
        return arr[Math.floor(Math.random() * arr.length)];
    }

    var pts = [];
    function mkP() {
        return {
            x: Math.random() * cv.width,
            y: Math.random() * cv.height,
            sz: (Math.floor(Math.random() * 3) + 1) * 2,
            col: rndCol(),
            vx: (Math.random() - 0.5) * 0.4,
            vy: -Math.random() * 0.5 - 0.15,
            a: Math.random() * 0.5 + 0.2,
            life: Math.random(),
            dec: Math.random() * 0.003 + 0.001
        };
    }
    function resetP(p) {
        p.x = Math.random() * cv.width; p.y = cv.height + 10;
        p.sz = (Math.floor(Math.random() * 3) + 1) * 2;
        p.col = rndCol(); p.vx = (Math.random() - 0.5) * 0.4;
        p.vy = -Math.random() * 0.5 - 0.15;
        p.a = Math.random() * 0.5 + 0.2; p.life = 1;
        p.dec = Math.random() * 0.003 + 0.001;
    }

    for (var i = 0; i < 40; i++) pts.push(mkP());

    function anim() {
        cx.clearRect(0, 0, cv.width, cv.height);
        pts.forEach(function (p) {
            p.x += p.vx; p.y += p.vy; p.life -= p.dec;
            if (p.life <= 0 || p.y < -10) resetP(p);
            cx.globalAlpha = p.life * p.a;
            cx.fillStyle   = p.col;
            cx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
        });
        cx.globalAlpha = 1;
        requestAnimationFrame(anim);
    }
    anim();

}());
