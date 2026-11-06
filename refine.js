/**
 * refine.js — „Příště naživo“ v hero: nejbližší koncert z koncerty.json.
 * Když data nejsou, odkaz zůstane obecný („Koncerty a vstupenky“).
 */
(function () {
  'use strict';
  const out = document.querySelector('[data-next-show]');
  if (!out) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parse = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  fetch('koncerty.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => {
      if (!Array.isArray(list)) return;
      const next = list
        .filter((c) => c && c.date && parse(c.date) >= today)
        .sort((a, b) => parse(a.date) - parse(b.date))[0];
      if (!next) return;
      const d = parse(next.date);
      out.textContent = d.getDate() + '. ' + (d.getMonth() + 1) + '. — ' + next.city + ', ' + next.venue;
    });
})();
