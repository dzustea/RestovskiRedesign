/**
 * single.js — nový singl GO!: YouTube se načte až po kliknutí
 * (žádný iframe ani skripty YouTube při načtení stránky → rychlost).
 */
(function () {
  'use strict';
  const root = document.querySelector('[data-single]');
  if (!root) return;
  const id = root.dataset.yt;
  const player = root.querySelector('[data-single-player]');
  const label = root.querySelector('[data-single-label]');

  function open() {
    if (!player.firstChild) {
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title = 'REST feat. Masta Ace — GO! (prod. Idea)';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      player.appendChild(f);
    }
    player.hidden = false;
    root.classList.add('is-playing');
    if (label) label.textContent = 'Hraje';
    player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  root.querySelectorAll('[data-single-play]').forEach((b) => b.addEventListener('click', open));

  /* ostrý záběr do písmen GO!: zkusí náhled v plném rozlišení (1280×720),
     jinak 640×480, nakonec 480×360. YouTube u chybějící velikosti vrací šedý obrázek
     120×90, proto se kontroluje skutečná šířka. Načítá se až před
     příjezdem k sekci, takže nezdržuje načtení stránky. */
  function upgrade() {
    const tryImg = (name, minW, done, fail) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => (img.naturalWidth >= minW ? done(img.src) : fail());
      img.onerror = fail;
      img.src = 'https://i.ytimg.com/vi/' + id + '/' + name;
    };
    tryImg('maxresdefault.jpg', 1280, (src) => {
      root.style.setProperty('--thumb', 'url("' + src + '")');
      root.classList.add('is-hd');
    }, () => tryImg('sddefault.jpg', 640, (src) => {
      root.style.setProperty('--thumb', 'url("' + src + '")');
    }, () => tryImg('hqdefault.jpg', 480, (src) => {
      root.style.setProperty('--thumb', 'url("' + src + '")');
    }, () => {})));
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { io.disconnect(); upgrade(); }
    }, { rootMargin: '600px 0px' });
    io.observe(root);
  } else {
    upgrade();
  }
})();
