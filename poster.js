/**
 * poster.js — interakce plakátového redesignu
 *  1. Ticker + „Příště naživo“ z koncerty.json
 *  2. Crew credits — jméno → role a popis
 *  3. Bedna s deskami — výběr desky (tablist)
 */
(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. TICKER + NEXT GIG ─────────────────────────────────────────────── */
  (function () {
    const track = document.querySelector('[data-ticker]');
    const next  = document.querySelector('[data-next-gig]');
    if (!track && !next) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parse = (iso) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const short = (d) => d.getDate() + '. ' + (d.getMonth() + 1) + '.';

    fetch('koncerty.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((list) => {
        if (!Array.isArray(list)) return;
        const upcoming = list
          .filter((c) => c && c.date && parse(c.date) >= today)
          .sort((a, b) => parse(a.date) - parse(b.date));
        if (!upcoming.length) return;

        if (next) {
          const c = upcoming[0];
          next.textContent = short(parse(c.date)) + ' ' + c.city + ', ' + c.venue;
        }

        if (track) {
          const frag = document.createDocumentFragment();
          // dvě kopie => plynulá smyčka (posun o -50 %)
          for (let k = 0; k < 2; k++) {
            upcoming.forEach((c) => {
              const s = document.createElement('span');
              s.textContent = short(parse(c.date)) + ' ' + c.city + ' — ' + c.venue;
              frag.appendChild(s);
            });
            // když je termínů málo, doplníme slogan, ať pás není prázdný
            if (upcoming.length < 4) {
              ['Žádnej klid', 'Ty Nikdy'].forEach((t) => {
                const s = document.createElement('span');
                s.textContent = t;
                frag.appendChild(s);
              });
            }
          }
          track.textContent = '';
          track.appendChild(frag);
          track.classList.add('is-live');
        }
      });
  })();

  /* ── 2. CREW CREDITS ──────────────────────────────────────────────────── */
  (function () {
    const root = document.querySelector('[data-credits]');
    if (!root) return;
    const names = Array.from(root.querySelectorAll('.credit'));
    const role  = root.querySelector('[data-credit-role]');
    const desc  = root.querySelector('[data-credit-desc]');

    function pick(btn) {
      names.forEach((n) => n.setAttribute('aria-pressed', n === btn ? 'true' : 'false'));
      role.textContent = btn.dataset.role;
      desc.textContent = btn.dataset.desc;
    }
    names.forEach((n) => {
      n.addEventListener('click', () => pick(n));
      n.addEventListener('focus', () => pick(n));
      n.addEventListener('mouseenter', () => pick(n));
    });
    if (names[0]) pick(names[0]);
  })();

  /* ── 3. BEDNA S DESKAMI ───────────────────────────────────────────────── */
  (function () {
    const root = document.querySelector('[data-crate]');
    if (!root) return;
    const tabs   = Array.from(root.querySelectorAll('.sleeve'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

    function select(i, focus) {
      tabs.forEach((t, n) => {
        const on = n === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (panels[n]) panels[n].hidden = !on;
      });
      if (focus) tabs[i].focus();
      // na mobilu (vodorovný scroll) dorovnáme vybraný obal do záběru
      tabs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
    }

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        select((i + dir + tabs.length) % tabs.length, true);
      });
    });
    tabs.forEach((t, n) => (t.tabIndex = n === 0 ? 0 : -1));
  })();
})();
