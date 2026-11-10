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
})();
