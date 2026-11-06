/**
 * story.js — „Z battlů na vrchol scény“: kariéra jako jedna stopa
 *  2003 → 2026 = 00:00 → 23:00 (rok = minuta). Milníky jsou komentáře v čase.
 *  - ▶ přehraje kariéru (playhead projede vlnu, milníky se střídají)
 *  - ⏮ / ⏭ a klik na milník nebo do vlny = skok na milník
 *  - při prvním zobrazení se stopa jednou sama přehraje (ne při reduced motion)
 */
(function () {
  'use strict';

  const root = document.querySelector('[data-track]');
  if (!root) return;

  const wave  = root.querySelector('[data-wave]');
  const bars  = Array.from(root.querySelectorAll('[data-bars]'));
  const pins  = Array.from(root.querySelectorAll('.pin'));
  const now   = root.querySelector('.track-now');
  const playB = root.querySelector('[data-play]');
  const out = {
    time:  root.querySelector('[data-time]'),
    tag:   root.querySelector('[data-tag]'),
    year:  root.querySelector('[data-year]'),
    title: root.querySelector('[data-title]'),
    desc:  root.querySelector('[data-desc]'),
  };

  const reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MINUTES  = 23;
  const YEAR_MS  = 420;                 // délka „roku“ při přehrávání
  const marks    = pins.map((p) => (Number(p.dataset.year) - 2003) / MINUTES);

  let p = 0;            // pozice 0–1
  let active = -1;
  let playing = false;
  let raf = 0;
  let last = 0;
  let touched = false;  // uživatel už na něco sáhl → žádný autoplay

  /* ── vlna: výšky sloupků (stabilní), špičky u milníků ── */
  function buildBars() {
    const w = wave.clientWidth || 600;
    const n = Math.max(48, Math.min(180, Math.round(w / 6)));
    let seed = 2003;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const heights = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      let h = 0.16 + rand() * 0.24;
      pins.forEach((pin, k) => {
        const big = pin.dataset.tag === 'Album' || pin.dataset.tag === 'Live' ? 0.62 : 0.42;
        const d = (x - marks[k]) * 26;
        h += big * Math.exp(-d * d) * (0.75 + rand() * 0.35);
      });
      heights.push(Math.min(1, h));
    }
    bars.forEach((layer) => {
      layer.textContent = '';
      const frag = document.createDocumentFragment();
      heights.forEach((h) => {
        const b = document.createElement('i');
        b.style.setProperty('--h', h.toFixed(3));
        frag.appendChild(b);
      });
      layer.appendChild(frag);
    });
  }

  /* ── vykreslení stavu ── */
  function fmt(pos) {
    const s = Math.round(pos * MINUTES * 60);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function setP(v) {
    p = Math.max(0, Math.min(1, v));
    root.style.setProperty('--p', p.toFixed(4));
    out.time.textContent = fmt(p);
    let idx = 0;
    marks.forEach((m, k) => { if (m <= p + 1e-6) idx = k; });
    pins.forEach((pin, k) => pin.classList.toggle('is-passed', marks[k] <= p + 1e-6));
    show(idx);
  }

  function show(i) {
    if (i === active) return;
    active = i;
    const d = pins[i].dataset;
    pins.forEach((pin, k) => {
      pin.classList.toggle('is-active', k === i);
      pin.setAttribute('aria-pressed', k === i ? 'true' : 'false');
    });
    out.year.textContent  = d.year;
    out.title.textContent = d.title;
    out.desc.textContent  = d.desc;
    out.tag.textContent   = d.tag;
    if (!reduced) {
      now.classList.remove('is-swap');
      void now.offsetWidth;
      now.classList.add('is-swap');
    }
  }

  /* ── přehrávání ── */
  function tick(t) {
    const dt = t - last;
    last = t;
    setP(p + dt / (MINUTES * YEAR_MS));
    if (p >= 1) { stop(); return; }
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (p >= 1) setP(0);
    playing = true;
    root.classList.remove('is-seeking');
    playB.textContent = '❚❚';
    playB.setAttribute('aria-label', 'Pozastavit');
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    playB.textContent = '▶';
    playB.setAttribute('aria-label', 'Přehrát kariéru');
  }

  function seek(i) {
    stop();
    root.classList.add('is-seeking');
    setP(marks[i]);
    show(i);
    out.time.textContent = fmt(marks[i]);
  }

  function interact() { touched = true; }

  playB.addEventListener('click', () => { interact(); playing ? stop() : play(); });
  root.querySelector('[data-prev]').addEventListener('click', () => {
    interact();
    seek(Math.max(0, (marks[active] < p - 0.01 ? active : active - 1)));
  });
  root.querySelector('[data-next]').addEventListener('click', () => {
    interact();
    seek(Math.min(pins.length - 1, active + 1));
  });
  pins.forEach((pin, i) => {
    pin.addEventListener('click', () => { interact(); seek(i); });
    pin.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const n = Math.max(0, Math.min(pins.length - 1, i + dir));
      interact();
      seek(n);
      pins[n].focus();
    });
  });
  // klik do vlny → nejbližší milník
  wave.addEventListener('click', (e) => {
    interact();
    const r = wave.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    let best = 0;
    marks.forEach((m, k) => { if (Math.abs(m - x) < Math.abs(marks[best] - x)) best = k; });
    seek(best);
  });

  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(buildBars, 150);
  });

  buildBars();
  setP(0);

  // jednou se sama přehraje, když na ni návštěvník dojede
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !touched && !playing && p === 0) {
        io.disconnect();
        setTimeout(() => { if (!touched) play(); }, 500);
      }
    }, { threshold: 0.6 });
    io.observe(root);
  }
})();
