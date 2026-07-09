/**
 * tour.js — Restovski · Sekce koncertů
 * ─────────────────────────────────────────────────────────────────────────────
 * Architektura:
 *  1. Fetch: načte ./koncerty.json přes Fetch API
 *  2. Sort: seřadí data ASC (nejbližší datum první)
 *  3. Render: generuje DOM přes createElement/textContent — žádný innerHTML s daty
 *             → 100% odolné vůči XSS bez potřeby sanitizace
 *  4. Skeleton: schová placeholder AŽ po načtení dat → nulový CLS
 *  5. Filter: event listenery přidá TEPRVE po úspěšném načtení dat,
 *             výchozí stav = "upcoming" (nadcházející)
 *
 * Přidání / editace koncertů: edituj pouze koncerty.json. JS kód beze změn.
 *
 * Pole v koncerty.json:
 *  id        — unikátní slug (string)
 *  date      — "YYYY-MM-DD" (ISO 8601)
 *  city      — město (string)
 *  venue     — název místa/klubu (string)
 *  type      — "club" | "festival"
 *  note      — volitelný podtitulek, null pokud chybí (string | null)
 *  ticketUrl — odkaz na lístky, null pro vyprodáno/proběhlé (string | null)
 *  soldOut   — true/false (boolean)
 */

(function () {
  'use strict';

  /* ── DOM REFS ────────────────────────────────────────────────────────────── */
  const listEl     = document.getElementById('tour-list');
  const skeletonEl = document.getElementById('tour-skeleton');
  const emptyEl    = document.getElementById('tour-empty');
  const errorEl    = document.getElementById('tour-error');

  // Pokud sekce na stránce neexistuje, IIFE se tiše ukončí.
  if (!listEl) return;

  /* ── CSS TŘÍDY pro aktivní / neaktivní filtr tlačítko ───────────────────── */
  const CLS_ACTIVE   = ['border-[var(--ink)]', 'bg-[var(--ink)]', 'text-[var(--invert)]', 'font-bold'];
  const CLS_INACTIVE = 'border-[var(--line)]';

  /* ── STATE ───────────────────────────────────────────────────────────────── */
  let allConcerts = [];   // seřazený ASC seznam všech koncertů z JSON

  const FALLBACK_CONCERTS = [
    {
      id: 'plzen-beseda-2026-03',
      date: '2026-03-22',
      city: 'Plzeň',
      venue: 'Měšťanská Beseda',
      type: 'club',
      note: null,
      ticketUrl: null,
      soldOut: false,
    },
    {
      id: 'trutnov-openair-2026-06',
      date: '2026-06-27',
      city: 'Trutnov',
      venue: 'Open Air Festival',
      type: 'festival',
      note: 'Main Stage 21:30',
      ticketUrl: null,
      soldOut: false,
    },
    {
      id: 'hhk-hradec-2026-07',
      date: '2026-07-02',
      city: 'Hradec Králové',
      venue: 'Hip Hop Kemp',
      type: 'festival',
      note: 'Forest Stage',
      ticketUrl: null,
      soldOut: false,
    },
    {
      id: 'brno-fleda-2026-09',
      date: '2026-09-12',
      city: 'Brno',
      venue: 'Fléda',
      type: 'club',
      note: 'Tlak II Tour',
      ticketUrl: 'https://goout.net/',
      soldOut: false,
    },
    {
      id: 'ostrava-barak-2026-10',
      date: '2026-10-04',
      city: 'Ostrava',
      venue: 'Barrák Music Club',
      type: 'club',
      note: 'Support: DJ Herby',
      ticketUrl: 'https://ticketstream.cz/',
      soldOut: false,
    },
    {
      id: 'praha-lucerna-2026-11',
      date: '2026-11-15',
      city: 'Praha',
      venue: 'Lucerna Music Bar',
      type: 'club',
      note: 'Vyprodáno za 4 dny',
      ticketUrl: null,
      soldOut: true,
    },
  ];

  /* ── DATUM: bezpečný parser + česky formátovaný výstup ─────────────────────
     Důvod ručního parsování: new Date('2026-09-12') vytváří UTC půlnoc.
     V CZ/SK časovém pásmu (UTC+2) by to vrátilo 11. 9. — o den dřív.
     Ruční split vždy vrátí správnou lokální půlnoc.
  ────────────────────────────────────────────────────────────────────────── */
  function parseLocalDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const dateFmt = new Intl.DateTimeFormat('cs-CZ', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });

  // Výstup: "15. 08. 2026" (Intl.DateTimeFormat, bez externích knihoven)
  function formatDate(iso) {
    return dateFmt.format(parseLocalDate(iso));
  }

  // Referenční bod "dnes" — nastavíme na půlnoc lokálního času
  const TODAY = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  function isPast(iso) {
    return parseLocalDate(iso) < TODAY;
  }

  /* ── VYTVOŘENÍ JEDNOHO ŘÁDKU (XSS bezpečné) ─────────────────────────────── */
  function createRow(concert) {
    const past      = isPast(concert.date);
    const typeLabel = concert.type === 'festival' ? 'Festival' : 'Klub';

    /* wrapper .tour-item — zachováme data atributy pro případné budoucí rozšíření */
    const item = document.createElement('div');
    item.className        = 'tour-item';
    item.dataset.date     = concert.date;
    item.dataset.type     = concert.type || 'club';

    /* vnitřní flex řádek — jiný styling pro past vs. upcoming */
    const inner = document.createElement('div');
    inner.className = past
      ? 'flex flex-col md:flex-row md:items-center gap-3 md:gap-8 py-6 px-2 opacity-70'
      : 'flex flex-col md:flex-row md:items-center gap-3 md:gap-8 py-6 px-2 hover:bg-[var(--bg-soft)] transition-colors group';

    /* datum — textContent zabraňuje jakémukoliv XSS */
    const dateEl = document.createElement('span');
    dateEl.className = past
      ? 'line-no font-display text-2xl md:text-3xl w-full md:w-36 shrink-0 tabnum text-[var(--ink-dim)]'
      : 'line-no font-display text-2xl md:text-3xl w-full md:w-36 shrink-0 tabnum text-[var(--ink-dim)] group-hover:text-[var(--ink)] transition-colors';
    dateEl.textContent = formatDate(concert.date);

    /* info blok */
    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0';

    const titleEl = document.createElement('p');
    titleEl.className   = 'font-display h-card uppercase truncate';
    titleEl.textContent = `${concert.city} \u2014 ${concert.venue}`;  // textContent = safe

    const subEl = document.createElement('p');
    subEl.className = 'font-mono text-xs uppercase tracking-wide text-[var(--ink-dim)] mt-1';
    // note z JSON zobrazíme jako podtitulek; pro minulé bez note dopíšeme "Proběhlo"
    subEl.textContent = concert.note
      ? `${typeLabel} \u00B7 ${concert.note}`
      : past ? `${typeLabel} \u00B7 Proběhlo` : typeLabel;

    info.append(titleEl, subEl);

    /* badge (typ akce) */
    const badge = document.createElement('span');
    badge.className   = 'font-mono text-[10px] uppercase tracking-wide px-3 py-1 border border-[var(--line)] text-[var(--ink-dim)] shrink-0 self-start md:self-center';
    badge.textContent = typeLabel;

    /* akční prvek — vstupenky / sold out / proběhlo (null = nic) */
    const action = buildAction(concert, past);

    inner.append(dateEl, info, badge);
    if (action) inner.appendChild(action);
    item.appendChild(inner);
    return item;
  }

  /* Akční prvek — vrací element nebo null (žádná akce) */
  function buildAction(concert, past) {
    if (past) {
      // Minulý koncert: pokud existuje odkaz na fotoreport, zobrazíme ho
      if (concert.reportUrl) {
        const a = document.createElement('a');
        a.href        = concert.reportUrl;
        a.className   = 'btn-outline text-xs px-5 py-3 shrink-0 text-center justify-center';
        a.textContent = 'Fotoreport \u2197';
        return a;
      }
      return null;  // žádná akce — "Proběhlo" je v podtitulku
    }

    if (concert.soldOut) {
      const s = document.createElement('span');
      s.className   = 'stripes-soldout font-display text-sm uppercase tracking-[0.1em] text-[var(--ink)] px-5 py-3 shrink-0 text-center';
      s.textContent = 'Sold Out';
      return s;
    }

    if (concert.ticketUrl) {
      const a = document.createElement('a');
      a.href        = concert.ticketUrl;
      a.target      = '_blank';
      a.rel         = 'noopener noreferrer';   // bezpečnost: isoluje nové okno
      a.className   = 'btn-outline text-xs px-5 py-3 shrink-0 text-center justify-center';
      a.textContent = 'Vstupenky \u2197';
      return a;
    }

    return null;
  }

  /* ── RENDER LISTU ────────────────────────────────────────────────────────── */
  function renderList(concerts) {
    // DocumentFragment = jeden zápis do DOM místo N reflow
    const frag = document.createDocumentFragment();
    concerts.forEach(c => frag.appendChild(createRow(c)));

    listEl.innerHTML = '';     // bezpečné: čistíme náš vlastní prázdný kontejner
    listEl.appendChild(frag);
    listEl.setAttribute('aria-busy', 'false');

    // Prázdný stav (např. filter "upcoming" a žádný nadcházející koncert)
    if (emptyEl) emptyEl.hidden = concerts.length > 0;
  }

  /* ── FILTER LOGIKA ───────────────────────────────────────────────────────── */
  function applyFilter(filter) {
    let result;

    if (filter === 'upcoming') {
      // Nadcházející: ASC (nejbližší nahoře) — zachováme pořadí ze sortu
      result = allConcerts.filter(c => !isPast(c.date));
    } else if (filter === 'past') {
      // Proběhlé: DESC (nejnovější nahoře) — reverse() na kopii
      result = allConcerts.filter(c => isPast(c.date)).reverse();
    } else {
      // Vše: ASC (globální sort ze fetch)
      result = allConcerts.slice();
    }

    renderList(result);
  }

  /* ── INIT FILTRŮ — volá se TEPRVE PO úspěšném načtení dat ──────────────── */
  function initFilters() {
    const filterBtns = [...document.querySelectorAll('.filter-btn[data-filter]')];

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Přepneme aktivní stav na všech tlačítkách
        filterBtns.forEach(b => {
          b.classList.remove(...CLS_ACTIVE);
          b.classList.add(CLS_INACTIVE);
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.remove(CLS_INACTIVE);
        btn.classList.add(...CLS_ACTIVE);
        btn.setAttribute('aria-pressed', 'true');

        applyFilter(btn.dataset.filter);
      });
    });

    // Výchozí filtr: "upcoming" — najdeme tlačítko a klikneme na něj programmaticky
    const defaultBtn = filterBtns.find(b => b.dataset.filter === 'upcoming');
    if (defaultBtn) {
      defaultBtn.dispatchEvent(new MouseEvent('click', { bubbles: false }));
    } else {
      applyFilter('upcoming');  // fallback pokud tlačítko neexistuje v HTML
    }
  }

  /* ── SKELETON & CHYBOVÉ STAVY ────────────────────────────────────────────── */
  function hideSkeleton() {
    if (skeletonEl) skeletonEl.hidden = true;
  }

  function showError() {
    hideSkeleton();
    if (errorEl) errorEl.hidden = false;
  }

  /* ── FETCH + BOOTSTRAP ───────────────────────────────────────────────────── */
  function init() {
    fetch('koncerty.json', {
      method:  'GET',
      headers: { 'Accept': 'application/json' },
      // 'default': respektuje HTTP Cache-Control hlavičky nastavené serverem.
      // Pro okamžité čerstvé data při každé návštěvě změň na 'no-cache'.
      cache: 'default',
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new TypeError('Nevalidní formát dat');
        return data;
      })
      .catch(err => {
        console.warn('[tour.js] Načítání koncerty.json selhalo, použiji záložní data:', err.message);
        return FALLBACK_CONCERTS;
      })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0) {
          showError();
          return;
        }

        // Seřadit ASC — nejbližší datum bude nahoře při filtru "upcoming"
        allConcerts = data.slice().sort(
          (a, b) => parseLocalDate(a.date) - parseLocalDate(b.date)
        );

        hideSkeleton();
        initFilters();   // Vykreslí výchozí filtr "upcoming" a aktivuje buttony
      });
  }

  init();
})();