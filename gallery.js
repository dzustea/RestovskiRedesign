/**
 * gallery.js — Restovski foto galerie
 *
 * Architektura:
 *  - PAGE_SIZE = 8: počet fotek v první dávce a v každém load-more
 *  - Append-only: load-more PŘIDÁ položky do gridu, nepřekresluje celé
 *  - Filter: fade → re-render prvních PAGE_SIZE → update tlačítka
 *  - loading="lazy" + decoding="async": browser nenačte fotky mimo viewport
 *  - Lightbox: fullscreen, prev/next, Esc, swipe
 *
 * Přidání fotek: rozšiř pole PHOTOS — vše ostatní automaticky.
 */
(function () {
  'use strict';

  /* ── FOTKY ────────────────────────────────────────────────────────────────
     Kategorie: 'live' | 'promo'
     V produkci: nahraď src vlastními URL nebo načti přes fetch('/api/photos')
  ────────────────────────────────────────────────────────────────────────── */
  var PHOTOS = [
    { src: 'images/rest.webp',  alt: 'Rest — live na koncertě',  category: 'live',  caption: 'Live · 2025' },
    { src: 'images/rest2.webp',  alt: 'Rest — live na koncertě',  category: 'live',  caption: 'Live · 2024' },
    { src: 'images/rest3.webp',  alt: 'Rest — promo fotka',       category: 'promo', caption: 'Promo · 2024' },
    { src: 'images/1.webp',  alt: 'Rest — promo fotka',       category: 'promo', caption: 'Promo · 2024' },
    { src: 'images/2.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/3.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/4.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/5.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/6.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/7.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/8.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/9.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/10.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/11.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/12.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' },
    { src: 'images/13.webp', alt: 'Live vystoupení', category: 'live',  caption: 'Tour · 2023' }
  ];

  var PAGE_SIZE = 8;  // fotek v první dávce a v každém load-more

  /* ── STATE ─────────────────────────────────────────────────────────────── */
  var filteredPhotos = PHOTOS.slice();  // aktuálně filtrovaná sada
  var renderedCount  = 0;               // počet fotek aktuálně v DOM
  var lightboxIndex  = 0;
  var lightboxActive = false;

  /* ── DOM REFS ──────────────────────────────────────────────────────────── */
  var gridEl      = document.getElementById('gallery-grid');
  var countEl     = document.getElementById('gallery-count');
  var loadWrapEl  = document.getElementById('gallery-load-wrap');
  var loadMoreBtn = document.getElementById('gallery-load-more');
  var loadCountEl = document.getElementById('gallery-load-count');
  var allLoadedEl = document.getElementById('gallery-all-loaded');
  var lbEl        = document.getElementById('gallery-lightbox');
  var lbImg       = document.getElementById('gallery-lb-img');
  var lbCaption   = document.getElementById('gallery-lb-caption');
  var lbIndex     = document.getElementById('gallery-lb-index');
  var lbClose     = document.getElementById('gallery-lb-close');
  var lbPrev      = document.getElementById('gallery-lb-prev');
  var lbNext      = document.getElementById('gallery-lb-next');

  if (!gridEl || !lbEl) return;

  /* ── APPEND ITEM (přidá jednu fotku do gridu) ─────────────────────────── */

  function appendItem(photo, indexInFiltered, animDelay) {
    var item = document.createElement('div');
    item.className = 'gallery-item';
    // stagger: každá nová dávka přichází postupně, ne najednou
    item.style.animationDelay = (animDelay || 0) + 'ms';
    item.setAttribute('role',     'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', 'Foto ' + (indexInFiltered + 1) + ': ' + photo.alt);
    item.dataset.index = String(indexInFiltered);

    var img = document.createElement('img');
    img.src      = photo.src;
    img.alt      = photo.alt;
    img.loading  = 'lazy';     // browser načte jen viditelné
    img.decoding = 'async';    // neblokovací dekódování
    item.appendChild(img);

    var overlay = document.createElement('div');
    overlay.className = 'gallery-item__overlay';

    var no = document.createElement('span');
    no.className   = 'gallery-item__no';
    no.textContent = String(indexInFiltered + 1).padStart(2, '0');

    var cap = document.createElement('span');
    cap.className   = 'gallery-item__cap';
    cap.textContent = photo.caption;

    overlay.appendChild(no);
    overlay.appendChild(cap);
    item.appendChild(overlay);

    // klik + klávesnice — uzavřením přes IIFE zachytíme správný index
    (function (idx) {
      item.addEventListener('click', function () { openLightbox(idx); });
      item.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(idx);
        }
      });
    })(indexInFiltered);

    gridEl.appendChild(item);
  }

  /* ── RENDER: první dávka ──────────────────────────────────────────────── */

  function renderInitial() {
    gridEl.innerHTML = '';
    renderedCount = 0;

    var batch = filteredPhotos.slice(0, PAGE_SIZE);
    for (var i = 0; i < batch.length; i++) {
      appendItem(batch[i], i, i * 45);
    }
    renderedCount = batch.length;

    if (countEl) countEl.textContent = filteredPhotos.length + ' fotek';
    updateLoadMoreBtn();
  }

  /* ── LOAD MORE: přidá další dávku do gridu bez re-renderu ────────────── */

  function loadMore() {
    var batch = filteredPhotos.slice(renderedCount, renderedCount + PAGE_SIZE);
    if (!batch.length) return;

    var startCount = renderedCount;
    for (var i = 0; i < batch.length; i++) {
      appendItem(batch[i], startCount + i, i * 45);
    }
    renderedCount += batch.length;

    updateLoadMoreBtn();

    // scroll k první nové fotce (optional UX hint)
    var firstNew = gridEl.querySelector('[data-index="' + startCount + '"]');
    if (firstNew) {
      setTimeout(function () {
        firstNew.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  }

  /* ── UPDATE: stav load-more tlačítka ─────────────────────────────────── */

  function updateLoadMoreBtn() {
    var remaining = filteredPhotos.length - renderedCount;

    if (!loadMoreBtn) return;

    if (remaining <= 0) {
      loadMoreBtn.classList.add('hidden');
      if (allLoadedEl && filteredPhotos.length > PAGE_SIZE) {
        allLoadedEl.classList.remove('hidden');
      }
    } else {
      loadMoreBtn.classList.remove('hidden');
      if (allLoadedEl) allLoadedEl.classList.add('hidden');
      var nextBatch = Math.min(remaining, PAGE_SIZE);
      if (loadCountEl) loadCountEl.textContent = nextBatch;
    }
  }

  /* ── FILTER ────────────────────────────────────────────────────────────── */

  var filterBtns = document.querySelectorAll('.gallery-filter-btn');

  for (var fb = 0; fb < filterBtns.length; fb++) {
    filterBtns[fb].addEventListener('click', (function (btn) {
      return function () {
        // přepnutí aktivního tlačítka
        for (var b = 0; b < filterBtns.length; b++) {
          filterBtns[b].classList.remove('active');
          filterBtns[b].setAttribute('aria-pressed', 'false');
        }
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        var cat = btn.dataset.filter;
        filteredPhotos = cat === 'all'
          ? PHOTOS.slice()
          : PHOTOS.filter(function (p) { return p.category === cat; });

        // fade out → re-render prvních PAGE_SIZE → fade in
        gridEl.style.opacity   = '0';
        gridEl.style.transform = 'translateY(8px)';
        setTimeout(function () {
          renderInitial();
          gridEl.style.opacity   = '1';
          gridEl.style.transform = 'translateY(0)';
        }, 200);
      };
    })(filterBtns[fb]));
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMore);
  }

  /* ── LIGHTBOX ──────────────────────────────────────────────────────────── */

  function openLightbox(i) {
    lightboxIndex  = i;
    lightboxActive = true;
    updateLbPhoto();
    lbEl.classList.add('gallery-lightbox-open');
    document.body.style.overflow = 'hidden';
    if (lbClose) lbClose.focus();
  }

  function closeLightbox() {
    lightboxActive = false;
    lbEl.classList.remove('gallery-lightbox-open');
    document.body.style.overflow = '';
    var prev = gridEl.querySelector('[data-index="' + lightboxIndex + '"]');
    if (prev) prev.focus();
  }

  function navigate(dir) {
    lightboxIndex = (lightboxIndex + dir + filteredPhotos.length) % filteredPhotos.length;
    updateLbPhoto();
  }

  function updateLbPhoto() {
    var p = filteredPhotos[lightboxIndex];
    if (!p || !lbImg) return;

    lbImg.style.opacity = '0';
    setTimeout(function () {
      lbImg.src           = p.src;
      lbImg.alt           = p.alt;
      lbImg.style.opacity = '1';
    }, 130);

    if (lbCaption) lbCaption.textContent = p.caption;
    if (lbIndex)   lbIndex.textContent   = (lightboxIndex + 1) + ' / ' + filteredPhotos.length;

    var single = filteredPhotos.length <= 1;
    if (lbPrev) lbPrev.toggleAttribute('disabled', single);
    if (lbNext) lbNext.toggleAttribute('disabled', single);
  }

  if (lbClose) lbClose.addEventListener('click', closeLightbox);
  if (lbPrev)  lbPrev.addEventListener('click', function () { navigate(-1); });
  if (lbNext)  lbNext.addEventListener('click', function () { navigate(+1); });

  lbEl.addEventListener('click', function (e) {
    if (e.target === lbEl || e.target.classList.contains('gallery-lightbox-bg')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!lightboxActive) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  navigate(-1);
    if (e.key === 'ArrowRight') navigate(+1);
  });

  // swipe (mobile)
  var touchX = 0;
  lbEl.addEventListener('touchstart', function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  lbEl.addEventListener('touchend', function (e) {
    if (!lightboxActive) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── INIT ──────────────────────────────────────────────────────────────── */

  gridEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  renderInitial();

})();