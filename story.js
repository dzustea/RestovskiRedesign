/**
 * story.js — sekce „Z battlů na vrchol scény“ (tracklist kariéry)
 *  - generuje waveform sloupky (deterministicky podle roku)
 *  - při scrollu posouvá přehrávací hlavu (--p) a označuje aktivní stopu
 */
(function () {
  'use strict';

  const story = document.querySelector('[data-story]');
  if (!story) return;

  const tracks = Array.from(story.querySelectorAll('.story-track'));
  const BARS = 26;

  // pseudo-náhodné, ale stabilní výšky sloupků pro každou stopu
  tracks.forEach((track) => {
    const wave = track.querySelector('.story-wave');
    if (!wave) return;
    let seed = parseInt(track.querySelector('.story-year').dataset.year, 10) || 1;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const frag = document.createDocumentFragment();
    for (let i = 0; i < BARS; i++) {
      const bar = document.createElement('i');
      // obálka: tišší okraje, hlasitější střed — vypadá jako reálná stopa
      const env = Math.sin((Math.PI * (i + 0.5)) / BARS);
      const h = 0.18 + env * (0.35 + rand() * 0.47);
      bar.style.setProperty('--h', h.toFixed(3));
      bar.style.setProperty('--i', i);
      frag.appendChild(bar);
    }
    wave.appendChild(frag);
  });

  // vstupní animace stop
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-seen');
          seen.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    tracks.forEach((t) => seen.observe(t));

    const playing = new IntersectionObserver((entries) => {
      entries.forEach((e) => story.classList.toggle('is-playing', e.isIntersecting));
    });
    playing.observe(story);
  } else {
    tracks.forEach((t) => t.classList.add('is-seen'));
  }

  // průběh + aktivní stopa podle středu obrazovky
  let ticking = false;
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    const focus = vh * 0.55;
    const rect = story.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (focus - rect.top) / rect.height));
    story.style.setProperty('--p', p.toFixed(4));

    let active = null;
    tracks.forEach((t) => {
      const r = t.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      t.classList.toggle('is-passed', mid <= focus);
      if (r.top <= focus && r.bottom >= focus) active = t;
    });
    tracks.forEach((t) => t.classList.toggle('is-active', t === active));
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
