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
  const CLS_ACTIVE   = ['is-on'];
  const CLS_INACTIVE = 'is-off';

  /* ── STATE ───────────────────────────────────────────────────────────────── */
  let allConcerts = [];   // seřazený ASC seznam všech koncertů z JSON

  const FALLBACK_CONCERTS = [
    {
      "id": "liberec-lidove-sady-2026-09",
      "date": "2026-09-25",
      "city": "Liberec",
      "venue": "Lidové sady | Velký sál",
      "type": "club",
      "note": "REST – samostatný koncert",
      "ticketUrl": "https://www.ticketlive.cz/cs/event/rest-lidove-sady-liberec-25-09-2026",
      "soldOut": false
    },
    {
      "id": "mlada-boleslav-dum-kultury-2026-10",
      "date": "2026-10-09",
      "city": "Mladá Boleslav",
      "venue": "Dům kultury Mladá Boleslav",
      "type": "club",
      "note": "REST",
      "ticketUrl": null,
      "soldOut": false
    },
    {
      "id": "praha-roxy-past-fotr-2026-10",
      "date": "2026-10-22",
      "city": "Praha",
      "venue": "ROXY",
      "type": "club",
      "note": "P/\\ST: křest alba FOTR – REST jako host",
      "ticketUrl": "https://goout.net/en/pst-krest-alba-fotr/szybkky/",
      "soldOut": false
    },
    {
      "id": "ceske-budejovice-k2-2026-10-31",
      "date": "2026-10-31",
      "city": "České Budějovice",
      "venue": "K2",
      "type": "club",
      "note": "REST",
      "ticketUrl": null,
      "soldOut": false
    },
    {
      "id": "praha-akropolis-pulz-2026-11-13",
      "date": "2026-11-13",
      "city": "Praha",
      "venue": "Palác Akropolis",
      "type": "club",
      "note": "REST + special guests · návrat do Akropole · začátek 19:30",
      "ticketUrl": "https://goout.net/en/pulz-rest%2Bspecial-guests/szylely/",
      "soldOut": false
    },
    {
      "id": "praha-akropolis-pulz-2026-11-14",
      "date": "2026-11-14",
      "city": "Praha",
      "venue": "Palác Akropolis",
      "type": "club",
      "note": "REST + special guests · návrat do Akropole · začátek 19:30",
      "ticketUrl": "https://goout.net/en/pulz-rest%2Bspecial-guests/szxlely/",
      "soldOut": false
    },
    {
      "id": "pec-pod-snezkou-klondike-2027-03",
      "date": "2027-03-05",
      "city": "Pec pod Sněžkou",
      "venue": "Klondike Music Club",
      "type": "club",
      "note": "REST · začátek 21:30",
      "ticketUrl": "https://www.ticketportal.cz/event/Rest",
      "soldOut": false
    }
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

  /* ── VYTVOŘENÍ JEDNOHO ŘÁDKU (XSS bezpečné — jen textContent) ─────────── */
  const dayFmt = new Intl.DateTimeFormat('cs-CZ', { weekday: 'long' });

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function createRow(concert) {
    const past      = isPast(concert.date);
    const typeLabel = concert.type === 'festival' ? 'Festival' : 'Klub';
    const d         = parseLocalDate(concert.date);

    const item = el('article', past ? 'gig tour-item is-past' : 'gig tour-item');
    item.dataset.date = concert.date;
    item.dataset.type = concert.type || 'club';

    // datum jako hlavní typografický prvek: „13.11.“ + rok a den v týdnu
    const time = el('time', 'gig-date');
    time.dateTime = concert.date;
    time.append(
      el('span', 'gig-dm', d.getDate() + '.' + (d.getMonth() + 1) + '.'),
      el('span', 'gig-y', d.getFullYear() + ' · ' + dayFmt.format(d))
    );

    const main  = el('div', 'gig-main');
    const place = el('h3', 'gig-place', concert.city);
    place.appendChild(el('span', 'gig-venue', concert.venue));
    const bits = [typeLabel];
    if (concert.note && concert.note !== 'REST') bits.push(concert.note);
    main.append(place, el('p', 'gig-note', bits.join(' · ')));

    item.append(time, main);
    const action = buildAction(concert, past);
    if (action) item.appendChild(action);
    return item;
  }

  /* Akční prvek — vstupenky / vyprodáno / proběhlo */
  function buildAction(concert, past) {
    if (past) {
      if (concert.reportUrl) {
        const a = el('a', 'gig-cta', 'Fotoreport');
        a.href = concert.reportUrl;
        return a;
      }
      return el('span', 'gig-cta is-quiet', 'Proběhlo');
    }
    if (concert.soldOut) return el('span', 'gig-cta is-sold', 'Vyprodáno');
    if (concert.ticketUrl) {
      const a = el('a', 'gig-cta', 'Vstupenky');
      a.href   = concert.ticketUrl;
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
      a.setAttribute('aria-label', 'Vstupenky: ' + concert.city + ', ' + concert.venue);
      return a;
    }
    return el('span', 'gig-cta is-quiet', 'Prodej brzy');
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
      cache: 'no-cache',
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