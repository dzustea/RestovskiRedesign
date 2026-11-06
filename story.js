/**
 * story.js — sekce „Z battlů na vrchol scény“ jako MPC sampler
 *  - klik / tap na pad = zobrazí milník na displeji
 *  - šipky ←/→ přepínají pady
 *  - autoplay projíždí pady jako sekvenci, dokud uživatel nesáhne na pad
 *    (pauzuje mimo obrazovku, vypnutý při prefers-reduced-motion)
 */
(function () {
  'use strict';

  const root = document.querySelector('[data-mpc]');
  if (!root) return;

  const pads   = Array.from(root.querySelectorAll('.mpc-pad'));
  const screen = root.querySelector('.mpc-screen');
  const $ = (sel) => root.querySelector(sel);
  const out = {
    pad:   $('[data-mpc-pad]'),
    side:  $('[data-mpc-side]'),
    year:  $('[data-mpc-year]'),
    title: $('[data-mpc-title]'),
    desc:  $('[data-mpc-desc]'),
    tag:   $('[data-mpc-tag]'),
    seq:   $('[data-mpc-seq]'),
  };

  const STEP = 4200;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = -1;
  let timer = null;
  let auto = !reduced;     // po první interakci uživatele se vypne
  let visible = false;

  // sekvencer — jeden krok na pad
  const steps = pads.map(() => out.seq.appendChild(document.createElement('i')));

  function show(i, fromUser) {
    if (i === current) return;
    current = i;
    const d = pads[i].dataset;

    pads.forEach((p, n) => {
      const on = n === i;
      p.classList.toggle('is-active', on);
      p.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    steps.forEach((s, n) => s.classList.toggle('on', n <= i));

    out.pad.textContent   = 'PAD ' + String(i + 1).padStart(2, '0');
    out.side.textContent  = 'SIDE ' + d.side;
    out.year.textContent  = d.year;
    out.title.textContent = d.title;
    out.desc.textContent  = d.desc;
    out.tag.textContent   = '[ ' + d.tag + ' ]';

    if (!reduced) {
      screen.classList.remove('is-swap');
      void screen.offsetWidth; // restart animace
      screen.classList.add('is-swap');
    }
    if (fromUser) {
      pads[i].classList.add('is-hit');
      setTimeout(() => pads[i].classList.remove('is-hit'), 140);
    }
    // restart časovače na aktivním padu
    const el = pads[i];
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  function schedule() {
    clearTimeout(timer);
    const playing = auto && visible;
    root.classList.toggle('is-playing', playing);
    if (playing) {
      timer = setTimeout(() => {
        show((current + 1) % pads.length);
        schedule();
      }, STEP);
    }
  }

  function stopAuto() {
    auto = false;
    schedule();
  }

  pads.forEach((pad, i) => {
    pad.addEventListener('click', () => {
      stopAuto();
      show(i, true);
    });
    pad.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const n = (i + dir + pads.length) % pads.length;
      stopAuto();
      show(n, true);
      pads[n].focus();
    });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      schedule();
    }, { threshold: 0.35 }).observe(root);
  }

  show(0);
})();
