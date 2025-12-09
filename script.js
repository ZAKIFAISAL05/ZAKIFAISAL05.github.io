// File: script.js
// Mengimpor data game dari file modular terpisah
import { gameData } from './games/gameData.js'; 

document.addEventListener('DOMContentLoaded', () => {
    
    // --- ELEMEN UTAMA ---
    const heroSection = document.getElementById('hero');
    const menuOverlay = document.getElementById('menuOverlay');
    const modal = document.getElementById('gameModal');
    const gameCards = document.querySelectorAll('.game-card'); 

    let currentSlide = 0;
    
    // --- UTILITY: SCROLL LOCK TOGGLE ---
    const toggleBodyScroll = (lock) => {
        document.body.classList.toggle('modal-open', lock);
    };

    // --- 1. HERO ANIMATION (FIXED: Bug Hilang Hitam Doang) ---
    // Memastikan class 'loaded' ditambahkan untuk transisi opacity di CSS
    if (heroSection) {
        // Timeout sedikit untuk memastikan DOM stabil sebelum menjalankan transisi CSS
        setTimeout(() => {
            heroSection.classList.add('loaded');
        }, 100);
    }

    // --- 2. NAVIGATION MENU (HAMBURGER) ---
    const menuButton = document.getElementById('menuButton');
    const menuCloseBtn = document.querySelector('.menu-close-btn');
    const menuLinks = document.querySelectorAll('.menu-links a');

    const closeMenu = () => {
        menuOverlay.classList.remove('open');
        toggleBodyScroll(false); 
    };

    menuButton.addEventListener('click', () => {
        menuOverlay.classList.add('open');
        toggleBodyScroll(true); 
    });
    
    menuCloseBtn.addEventListener('click', closeMenu);

    menuLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });
    
    menuOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'menuOverlay') {
            closeMenu();
        }
    });

    // --- 3. MODAL & GAME DETAILS LOGIC ---
    const closeModalBtn = document.querySelector('.close-modal');
    
    // Fungsi untuk menampilkan slide tertentu
    const showSlide = (index) => {
        const slides = document.querySelectorAll('#gallery-slides .gallery-slide');
        const dots = document.querySelectorAll('#gallery-dots .gallery-dot');

        if (slides.length === 0) return;

        if (index >= slides.length) { index = 0; }
        if (index < 0) { index = slides.length - 1; }
        currentSlide = index;

        const offset = -currentSlide * 100;
        document.getElementById('gallery-slides').style.transform = `translateX(${offset}%)`;

        dots.forEach(dot => dot.classList.remove('active'));
        if(dots[currentSlide]) dots[currentSlide].classList.add('active');
    };

    // Fungsi Rendering Galeri (Slider)
    const renderGallery = (game, screenshots) => {
        const slidesContainer = document.getElementById('gallery-slides');
        const dotsContainer = document.getElementById('gallery-dots');
        slidesContainer.innerHTML = '';
        dotsContainer.innerHTML = '';
        
        // Memastikan gambar dimuat dengan path yang benar
        screenshots.forEach((src, index) => {
            // Slides
            const slide = document.createElement('div');
            slide.classList.add('gallery-slide');
            slide.innerHTML = `<img src="${src}" alt="${game.title} Screenshot ${index + 1}">`;
            slidesContainer.appendChild(slide);

            // Dots
            const dot = document.createElement('span');
            dot.classList.add('gallery-dot');
            if (index === 0) dot.classList.add('active');
            dot.addEventListener('click', () => {
                showSlide(index);
            });
            dotsContainer.appendChild(dot);
        });

        showSlide(currentSlide);
    };

    // Fungsi Navigasi Slider
    document.querySelector('.gallery-prev').addEventListener('click', () => {
        showSlide(currentSlide - 1);
    });
    document.querySelector('.gallery-next').addEventListener('click', () => {
        showSlide(currentSlide + 1);
    });

    // Fungsi Rendering Tombol Platform
    const renderPlatformButtons = (platforms) => {
        const platformContainer = document.getElementById('platform-buttons');
        platformContainer.innerHTML = '';

        platforms.forEach(platform => {
            const button = document.createElement('a');
            button.href = platform.url;
            button.target = "_blank";
            button.classList.add('btn-platform', platform.class);
            button.textContent = `DOWNLOAD ${platform.name.toUpperCase()}`;
            platformContainer.appendChild(button);
        });
    };
    
    // Fungsi Rendering Kartu Game Lain 
    const renderOtherGames = (currentId) => {
        const otherGamesGrid = document.getElementById('other-games-grid');
        otherGamesGrid.innerHTML = '';
        
        const availableGames = gameData.filter(g => g.id !== currentId);

        if (availableGames.length <= 1) { 
            document.getElementById('other-games-container').style.display = 'none';
            return;
        } else {
            document.getElementById('other-games-container').style.display = 'block';
        }

        const shuffledGames = [...availableGames]; 
        for (let i = shuffledGames.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledGames[i], shuffledGames[j]] = [shuffledGames[j], shuffledGames[i]];
        }
        
        const otherGames = shuffledGames.slice(0, 3);

        otherGames.forEach(game => {
            const card = document.createElement('div');
            card.classList.add('other-game-card');
            card.setAttribute('data-game-id', game.id);
            card.addEventListener('click', () => {
                showGameDetails(game.id); 
                modal.querySelector('.modal-content').scrollTop = 0; 
            });

            card.innerHTML = `
                <div class="game-image-wrapper">
                    <img src="${game.logo}" alt="${game.title} Logo" class="game-image">
                </div>
                <div class="game-info" style="padding: 10px;">
                    <h3 class="game-title" style="font-size:0.9rem;">${game.title}</h3>
                </div>
            `;
            otherGamesGrid.appendChild(card);
        });
    };

    // Fungsi utama menampilkan detail game ke dalam Modal
    const showGameDetails = (gameId) => {
        const game = gameData.find(g => g.id === gameId);
        if (!game) return;

        currentSlide = 0;

        document.getElementById('modal-logo').src = game.logo;
        document.getElementById('modal-title').textContent = game.title;
        document.getElementById('modal-description').textContent = game.desc;
        
        renderGallery(game, game.gallery);
        renderPlatformButtons(game.platforms);
        renderOtherGames(gameId); 

        modal.classList.add('active');
        toggleBodyScroll(true); 
        modal.scrollTo(0, 0); 
    };
    
    // Event listener untuk setiap game card di halaman utama
    gameCards.forEach(card => {
        card.addEventListener('click', () => {
            const gameId = card.getAttribute('data-game-id');
            showGameDetails(gameId);
        });
    });

    // Event listener menutup modal
    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        toggleBodyScroll(false); 
    });

    // Menutup modal ketika mengklik di luar modal-content
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'gameModal') {
            modal.classList.remove('active');
            toggleBodyScroll(false); 
        }
    });

});