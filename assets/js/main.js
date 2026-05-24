// assets/js/main.js
// Grid Survival — Main Script

(function () {
    'use strict';

    // ────────────────────────────────────────────────
    // ELEMENTS
    // ────────────────────────────────────────────────
    const heroSection      = document.getElementById('hero');
    const menuOverlay      = document.getElementById('menuOverlay');
    const menuButton       = document.getElementById('menuButton');
    const menuCloseBtn     = document.querySelector('.menu-close-btn');
    const menuLinks        = document.querySelectorAll('.menu-links a');
    const modal            = document.getElementById('gameModal');
    const closeModalBtn    = document.getElementById('closeModalBtn');
    const prevSlide        = document.getElementById('prevSlide');
    const nextSlide        = document.getElementById('nextSlide');
    const typingEl         = document.getElementById('typing-text');
    const cursorEl         = document.querySelector('.cursor');
    const heroTitle        = document.querySelector('.hero-title');
    const primaryBtn       = document.querySelector('.btn-primary-scroll');
    const gameCards        = document.querySelectorAll('.game-card');

    let currentSlide = 0;

    // ────────────────────────────────────────────────
    // UTILITY
    // ────────────────────────────────────────────────
    const lockScroll  = () => document.body.classList.add('modal-open');
    const unlockScroll = () => document.body.classList.remove('modal-open');

    // ────────────────────────────────────────────────
    // HERO FADE-IN
    // ────────────────────────────────────────────────
    if (heroSection) {
        setTimeout(() => heroSection.classList.add('loaded'), 100);
    }

    // ────────────────────────────────────────────────
    // TYPING ANIMATION
    // ────────────────────────────────────────────────
    const taglineText = "Studio Pengembangan Game Indie — Berkomitmen pada Kualitas dan Gameplay. Spesialis dalam Survival, RPG, dan Strategy dengan sentuhan cerita yang memikat.";
    let charIndex = 0;

    function typeWriter() {
        if (charIndex < taglineText.length) {
            typingEl.textContent += taglineText.charAt(charIndex++);
            setTimeout(typeWriter, 45);
        } else {
            if (cursorEl)  cursorEl.style.display = 'inline-block';
            if (heroTitle) heroTitle.classList.add('fade-loop');
            if (primaryBtn) primaryBtn.classList.add('fade-loop');
        }
    }

    setTimeout(() => {
        if (cursorEl) cursorEl.style.display = 'none';
        typeWriter();
    }, 900);

    // ────────────────────────────────────────────────
    // HAMBURGER MENU
    // ────────────────────────────────────────────────
    const closeMenu = () => {
        menuOverlay.classList.remove('open');
        unlockScroll();
    };

    if (menuButton) menuButton.addEventListener('click', () => {
        menuOverlay.classList.add('open');
        lockScroll();
    });
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMenu);
    menuLinks.forEach(l => l.addEventListener('click', closeMenu));
    if (menuOverlay) menuOverlay.addEventListener('click', e => {
        if (e.target === menuOverlay) closeMenu();
    });

    // ────────────────────────────────────────────────
    // SMOOTH SCROLL
    // ────────────────────────────────────────────────
    if (primaryBtn) {
        primaryBtn.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(primaryBtn.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ────────────────────────────────────────────────
    // GALLERY SLIDER
    // ────────────────────────────────────────────────
    const showSlide = (index) => {
        const slides = document.querySelectorAll('#gallery-slides .gallery-slide');
        const dots   = document.querySelectorAll('#gallery-dots .gallery-dot');
        if (!slides.length) return;

        currentSlide = (index + slides.length) % slides.length;
        document.getElementById('gallery-slides').style.transform = `translateX(${-currentSlide * 100}%)`;
        dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    };

    const renderGallery = (game, screenshots) => {
        const slidesEl = document.getElementById('gallery-slides');
        const dotsEl   = document.getElementById('gallery-dots');
        slidesEl.innerHTML = '';
        dotsEl.innerHTML   = '';

        screenshots.forEach((src, i) => {
            const slide = document.createElement('div');
            slide.className = 'gallery-slide';
            slide.innerHTML = `<img src="${src}" alt="${game.title} Screenshot ${i + 1}" loading="lazy">`;
            slidesEl.appendChild(slide);

            const dot = document.createElement('span');
            dot.className = 'gallery-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => showSlide(i));
            dotsEl.appendChild(dot);
        });

        showSlide(0);
    };

    if (prevSlide) prevSlide.addEventListener('click', () => showSlide(currentSlide - 1));
    if (nextSlide) nextSlide.addEventListener('click', () => showSlide(currentSlide + 1));

    // ────────────────────────────────────────────────
    // PLATFORM BUTTONS
    // ────────────────────────────────────────────────
    const renderPlatformButtons = (platforms) => {
        const container = document.getElementById('platform-buttons');
        container.innerHTML = '';

        platforms.forEach(p => {
            const btn = document.createElement('a');
            btn.href    = p.url;
            btn.target  = '_blank';
            btn.rel     = 'noopener noreferrer';
            btn.className = `btn-platform ${p.cls}`;
            btn.textContent = p.name.toLowerCase().startsWith('play')
                ? p.name.toUpperCase()
                : `DOWNLOAD — ${p.name.toUpperCase()}`;
            container.appendChild(btn);
        });
    };

    // ────────────────────────────────────────────────
    // OTHER GAMES
    // ────────────────────────────────────────────────
    const renderOtherGames = (currentId) => {
        const grid      = document.getElementById('other-games-grid');
        const container = document.getElementById('other-games-container');
        const others    = gameData.filter(g => g.id !== currentId);

        grid.innerHTML = '';
        container.style.display = others.length ? 'block' : 'none';

        // Shuffle
        const shuffled = [...others].sort(() => Math.random() - 0.5).slice(0, 3);

        shuffled.forEach(game => {
            const card = document.createElement('div');
            card.className = 'other-game-card';
            card.setAttribute('data-game-id', game.id);
            card.innerHTML = `
                <div class="game-image-wrapper">
                    <img src="${game.thumb}" alt="${game.title}" class="game-image" loading="lazy">
                </div>
                <div class="game-info" style="padding:10px;">
                    <h3 class="game-title" style="font-size:.85rem;">${game.title}</h3>
                </div>`;
            card.addEventListener('click', () => {
                showGameDetails(game.id);
                modal.scrollTo(0, 0);
            });
            grid.appendChild(card);
        });
    };

    // ────────────────────────────────────────────────
    // TAB SWITCHING
    // ────────────────────────────────────────────────
    const switchTab = (tabName) => {
        document.querySelectorAll('.modal-tab').forEach(t => {
            t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
            t.setAttribute('aria-selected', t.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.modal-tab-content').forEach(c => {
            c.classList.toggle('active', c.id === `tab-${tabName}`);
        });
    };

    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.getAttribute('data-tab')));
    });

    // ────────────────────────────────────────────────
    // SHOW GAME MODAL
    // ────────────────────────────────────────────────
    const showGameDetails = (gameId) => {
        const game = gameData.find(g => g.id === gameId);
        if (!game) return;

        currentSlide = 0;
        document.getElementById('modal-logo').src          = game.logo;
        document.getElementById('modal-title').textContent  = game.title;
        document.getElementById('modal-description').textContent = game.desc;

        const genreBadge = document.getElementById('modal-genre-badge');
        const genreText  = document.getElementById('modal-genre-text');
        if (genreBadge) genreBadge.textContent = game.genre || '';
        if (genreText)  genreText.textContent  = game.genre || '-';

        const devEl = document.getElementById('modal-developer');
        if (devEl) devEl.textContent = game.developer || 'Grid Survival';

        renderGallery(game, game.gallery);
        renderPlatformButtons(game.platforms);
        renderOtherGames(gameId);

        // Always open on INFO tab
        switchTab('info');

        modal.classList.add('active');
        lockScroll();
        modal.scrollTo(0, 0);
    };

    // ────────────────────────────────────────────────
    // SYNC DENGAN ADMIN PANEL
    // Kalau admin hapus game, sembunyikan card-nya
    // ────────────────────────────────────────────────
    (function syncAdminDeletes() {
        var raw;
        try { raw = localStorage.getItem('gs_catalog_games'); } catch(e) { return; }
        if (!raw) return;
        var adminGames;
        try { adminGames = JSON.parse(raw); } catch(e) { return; }
        if (!Array.isArray(adminGames)) return;
        var activeIds = adminGames.map(function(g) { return g.id; });
        document.querySelectorAll('.game-card').forEach(function(card) {
            var id = card.getAttribute('data-game-id');
            if (id && activeIds.indexOf(id) === -1) {
                card.style.display = 'none';
            }
        });
    })();

    // Card click listeners
    gameCards.forEach(card => {
        card.addEventListener('click', () => showGameDetails(card.getAttribute('data-game-id')));
    });

    // Close modal
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        unlockScroll();
    });
    if (modal) modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.classList.remove('active');
            unlockScroll();
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
            unlockScroll();
        }
    });

    // ────────────────────────────────────────────────
    // SCROLL FADE-IN (IntersectionObserver)
    // ────────────────────────────────────────────────
    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('show');
                    obs.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1 }
    );

    document.querySelectorAll('.scroll-animate').forEach((el, i) => {
        el.style.transitionDelay = `${i * 0.08}s`;
        observer.observe(el);
    });

    // Mark section headers + cards for animation
    const sectionTitle = document.querySelector('#games .section-header-title');
    if (sectionTitle) {
        sectionTitle.classList.add('scroll-animate');
        observer.observe(sectionTitle);
    }

    document.querySelectorAll('.game-card').forEach((card, i) => {
        card.classList.add('scroll-animate');
        card.style.transitionDelay = `${i * 0.1}s`;
        observer.observe(card);
    });

})();
