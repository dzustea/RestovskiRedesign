/**
 * story.js — „Z battlů na vrchol scény“ jako mechanické počítadlo.
 * Číslice roku se protáčí mezi milníky; sekce se sama posouvá,
 * jen když je vidět (IntersectionObserver), při najetí myší čeká.
 */
(function () {
  'use strict';
  const root = document.querySelector('[data-odo]');
  if (!root) return;

  const cols  = Array.from(root.querySelectorAll('.odo-col'));
  const steps = Array.from(root.querySelectorAll('.odo-step'));
  const info  = root.querySelector('.odo-info');
  const out = {
    tag:   root.querySelector('[data-odo-tag]'),
    title: root.querySelector('[data-odo-title]'),
    desc:  root.querySelector('[data-odo-desc]'),
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DWELL = 3400;
  root.style.setProperty('--dur', DWELL + 'ms');

  let cur = -1;
  let timer = 0;
  let visible = false;
  let hold = false;      // myš nad sekcí
  let resumeAt = 0;      // po kliknutí chvíli nečekat na autoplay

  function show(i) {
    const year = steps[i].textContent.trim();
    cols.forEach((c, k) => c.style.setProperty('--d', year[k]));
    steps.forEach((s, k) => {
      s.classList.toggle('is-on', k === i);
      s.classList.toggle('is-past', k < i);
      s.classList.remove('is-run');
      s.setAttribute('aria-current', k === i ? 'step' : 'false');
    });
    const d = steps[i].dataset;
    out.tag.textContent = d.tag;
    out.title.textContent = d.title;
    out.desc.textContent = d.desc;
    if (cur !== -1 && !reduced) {
      info.classList.remove('is-swap');
      void info.offsetWidth;
      info.classList.add('is-swap');
    }
    cur = i;
    schedule();
  }

  function schedule() {
    clearTimeout(timer);
    const auto = !reduced && visible && !hold && Date.now() >= resumeAt;
    root.classList.toggle('is-auto', auto);
    if (!auto) {
      if (!reduced && visible && !hold) timer = setTimeout(schedule, resumeAt - Date.now());
      return;
    }
    const s = steps[cur];
    s.classList.remove('is-run');
    void s.offsetWidth;
    s.classList.add('is-run');
    timer = setTimeout(() => show((cur + 1) % steps.length), DWELL);
  }

  steps.forEach((s, i) => {
    s.addEventListener('click', () => { resumeAt = Date.now() + 9000; show(i); });
    s.addEventListener('keydown', (e) => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const n = (i + dir + steps.length) % steps.length;
      resumeAt = Date.now() + 9000;
      show(n);
      steps[n].focus();
    });
  });
  root.addEventListener('mouseenter', () => { hold = true; schedule(); });
  root.addEventListener('mouseleave', () => { hold = false; schedule(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      schedule();
    }, { threshold: 0.4 }).observe(root);
  }

  show(0);
})();
