/**
 * merch.js — Restovski Merch Cart
 *
 * Architektura:
 *  - Vše v IIFE (žádné globální proměnné)
 *  - Produkty definovány jako data (lze nahradit API voláním)
 *  - Košík s podporou quantity management
 *  - getCheckoutPayload() vrací Stripe-ready formát
 *  - Custom DOM eventy pro napojení analytiky / platební brány
 *  - Renderování pouze přes DOM API (žádný innerHTML s dynamickými daty)
 *
 * Napojení platební brány (příklad):
 *   document.addEventListener('merch:checkout', (e) => {
 *     const payload = e.detail.payload;
 *     // stripe.redirectToCheckout(payload)
 *     // nebo: fetch('/api/create-checkout', { method:'POST', body: JSON.stringify(payload) })
 *   });
 */

(function () {
  'use strict';

  /* ── PRODUCTS CONFIGURATION ───────────────────────────────────────────
     V produkci: nahradit fetch('/api/products') nebo data z CMS.
     Každý produkt má unikátní id a sku pro propojení s platební bránou.
  ──────────────────────────────────────────────────────────────────────── */
  const PRODUCTS = [
    {
      id:     'hoodie-restovski-black',
      sku:    'RST-HOD-BLK-2026',
      name:   'Hoodie Restovski Black',
      price:  890,
      badge:  'Limitovaná edice',
      image:  'images/hoodie.webp',
      sizes:  ['S', 'M', 'L', 'XL', 'XXL'],
    },
    {
      id:     'trico-tlak-ii-tour',
      sku:    'RST-TEE-TLK-2026',
      name:   'Triko Tlak II Tour',
      price:  490,
      badge:  null,
      image:  'images/tshirt.webp',
      sizes:  ['S', 'M', 'L', 'XL', 'XXL'],
    },
    {
      id:     'vinyl-zavislosti-2lp',
      sku:    'RST-VNL-ZAV-2LP',
      name:   'Vinyl Závislosti 2LP',
      price:  990,
      badge:  'Nové',
      image:  'images/album.webp',
      // vinyl: žádný výběr velikosti — automaticky vybraný "2LP"
      sizes:  ['2LP'],
    },
    {
      id:     'hoodie-restovski-black',
      sku:    'RST-HOD-BSC-2025',
      name:   'Hoodie Restovski Black',
      price:  990,
      badge:  'none',
      image:  'images/hoodie1.webp',
      sizes:  ['S', 'M', 'L', 'XL', 'XXL'],
    },
  ];

  /* ── CART STATE ───────────────────────────────────────────────────────
     Každá položka: { uid, productId, sku, name, size, price, qty, image }
     uid = productId + '-' + size  →  stejný produkt+velikost = increment qty
  ──────────────────────────────────────────────────────────────────────── */
  let cart = [];

  /* ── HELPERS ──────────────────────────────────────────────────────────── */

  /** Dispatch custom DOM event — pro analytiku a platební brány */
  function dispatch(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
  }

  /** Najde produkt v PRODUCTS podle id */
  function findProduct(productId) {
    return PRODUCTS.find(p => p.id === productId) || null;
  }

  /** Celková cena košíku v haléřích (pro Stripe) */
  function getTotalCents() {
    return cart.reduce((sum, item) => sum + item.price * item.qty * 100, 0);
  }

  /** Celkový počet kusů v košíku */
  function getTotalQty() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  /* ── CART API ─────────────────────────────────────────────────────────── */

  /**
   * Přidá produkt do košíku nebo zvýší quantity.
   * @param {string} productId
   * @param {string} size
   * @returns {object} přidaná/aktualizovaná položka
   */
  function addItem(productId, size) {
    const product = findProduct(productId);
    if (!product) return null;

    const uid = `${productId}--${size}`;
    const existing = cart.find(i => i.uid === uid);

    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        uid,
        productId: product.id,
        sku:       product.sku,
        name:      product.name,
        size,
        price:     product.price,
        qty:       1,
        image:     product.image,
      });
    }

    dispatch('merch:add_to_cart', { productId, size, cart: [...cart] });
    return cart.find(i => i.uid === uid);
  }

  /**
   * Odebere položku z košíku.
   * @param {string} uid
   */
  function removeItem(uid) {
    const item = cart.find(i => i.uid === uid);
    cart = cart.filter(i => i.uid !== uid);
    dispatch('merch:remove_from_cart', { uid, item, cart: [...cart] });
  }

  /**
   * Změní množství položky. Při qty ≤ 0 položku odebere.
   * @param {string} uid
   * @param {number} delta  (+1 nebo -1)
   */
  function changeQty(uid, delta) {
    const item = cart.find(i => i.uid === uid);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) removeItem(uid);
    dispatch('merch:qty_change', { uid, qty: item?.qty, cart: [...cart] });
  }

  /** Vyprázdní celý košík */
  function clearCart() {
    cart = [];
    dispatch('merch:clear', { cart: [] });
  }

  /**
   * Vrací Stripe-ready payload pro předání platební bráně.
   * Použití:
   *   document.addEventListener('merch:checkout', (e) => {
   *     const { payload } = e.detail;
   *     // stripe.redirectToCheckout({ lineItems: payload.line_items, ... })
   *   });
   */
  function getCheckoutPayload() {
    return {
      currency:     'czk',
      amount_total: getTotalCents(),       // v haléřích — Stripe standard
      line_items: cart.map(item => ({
        price_data: {
          currency: 'czk',
          product_data: {
            name:   item.name,
            images: [item.image],
            metadata: {
              sku:  item.sku,
              size: item.size,
            },
          },
          unit_amount: item.price * 100,   // v haléřích
        },
        quantity: item.qty,
      })),
      metadata: {
        source:    'restovski-merch-demo',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /* ── DOM REFS ─────────────────────────────────────────────────────────── */

  const gridEl      = document.getElementById('product-grid');
  const drawerEl    = document.getElementById('cart-drawer');
  const backdropEl  = document.getElementById('cart-backdrop');
  const itemsEl     = document.getElementById('cart-items');
  const emptyEl     = document.getElementById('cart-empty');
  const footerEl    = document.getElementById('cart-footer');
  const totalEl     = document.getElementById('cart-total');
  const subtotalEl  = document.getElementById('cart-subtotal');
  const badgeEl     = document.getElementById('cart-badge');
  const toggleBtn   = document.getElementById('cart-toggle');
  const closeBtn    = document.getElementById('cart-close');
  const clearBtn    = document.getElementById('cart-clear');
  const checkoutBtn = document.getElementById('cart-checkout');
  const goMerchBtn  = document.getElementById('cart-go-merch');
  const toastEl     = document.getElementById('cart-toast');
  const toastText   = document.getElementById('cart-toast-text');

  if (!drawerEl || !gridEl) return; // stránka neobsahuje merch — bail out

  /* ── TOAST ────────────────────────────────────────────────────────────── */

  let toastTimer = null;

  function showToast(message) {
    if (!toastEl || !toastText) return;
    clearTimeout(toastTimer);
    toastText.textContent = message;
    toastEl.classList.add('visible');
    toastTimer = setTimeout(() => toastEl.classList.remove('visible'), 2800);
  }

  /* ── CART OPEN / CLOSE ────────────────────────────────────────────────── */

  function openCart() {
    drawerEl.classList.add('cart-drawer-open');
    backdropEl.classList.remove('opacity-0', 'pointer-events-none');
    backdropEl.classList.add('opacity-100', 'pointer-events-auto');
    document.body.style.overflow = 'hidden';
    toggleBtn?.setAttribute('aria-expanded', 'true');
    // přesun fokusu do draweru pro dostupnost
    closeBtn?.focus();
  }

  function closeCart() {
    drawerEl.classList.remove('cart-drawer-open');
    backdropEl.classList.remove('opacity-100', 'pointer-events-auto');
    backdropEl.classList.add('opacity-0', 'pointer-events-none');
    document.body.style.overflow = '';
    toggleBtn?.setAttribute('aria-expanded', 'false');
    toggleBtn?.focus();
  }

  toggleBtn?.addEventListener('click', openCart);
  closeBtn?.addEventListener('click', closeCart);
  backdropEl?.addEventListener('click', closeCart);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawerEl.classList.contains('cart-drawer-open')) {
      closeCart();
    }
  });

  goMerchBtn?.addEventListener('click', () => {
    closeCart();
    document.getElementById('merch')?.scrollIntoView({ behavior: 'smooth' });
  });

  /* ── RENDER: BADGE ────────────────────────────────────────────────────── */

  function renderBadge() {
    if (!badgeEl) return;
    const count = getTotalQty();
    badgeEl.hidden = count === 0;
    badgeEl.textContent = count > 99 ? '99+' : String(count);
    // animace "bump"
    badgeEl.classList.remove('bump');
    void badgeEl.offsetWidth;                // reflow pro restart animace
    if (count > 0) badgeEl.classList.add('bump');
  }

  /* ── RENDER: CART ITEM (DOM API, žádný innerHTML s daty) ─────────────── */

  function renderCartItem(item) {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.dataset.uid = item.uid;

    // thumbnail
    const thumb = document.createElement('div');
    thumb.className = 'cart-item__thumb';
    const img = document.createElement('img');
    img.src   = item.image;
    img.alt   = item.name;
    img.loading = 'lazy';
    thumb.appendChild(img);

    // info
    const info = document.createElement('div');
    info.className = 'cart-item__info';

    const name = document.createElement('p');
    name.className   = 'cart-item__name';
    name.textContent = item.name;

    const meta = document.createElement('p');
    meta.className   = 'cart-item__meta';
    meta.textContent = `Velikost: ${item.size}`;

    const price = document.createElement('p');
    price.className   = 'cart-item__price';
    price.textContent = `${item.price * item.qty} Kč`;

    // quantity controls
    const qtyRow = document.createElement('div');
    qtyRow.className = 'cart-item__qty';

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.className = 'qty-btn';
    btnMinus.textContent = '−';
    btnMinus.setAttribute('aria-label', `Snížit množství ${item.name}`);
    btnMinus.addEventListener('click', () => {
      changeQty(item.uid, -1);
      renderCart();
      renderBadge();
    });

    const qtyVal = document.createElement('span');
    qtyVal.className   = 'qty-value';
    qtyVal.textContent = String(item.qty);

    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.className = 'qty-btn';
    btnPlus.textContent = '+';
    btnPlus.setAttribute('aria-label', `Zvýšit množství ${item.name}`);
    btnPlus.addEventListener('click', () => {
      changeQty(item.uid, +1);
      renderCart();
      renderBadge();
    });

    qtyRow.append(btnMinus, qtyVal, btnPlus);
    info.append(name, meta, qtyRow, price);

    // remove button
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'cart-item__remove';
    removeBtn.setAttribute('aria-label', `Odebrat ${item.name} z košíku`);
    removeBtn.textContent = '[ × ]';
    removeBtn.addEventListener('click', () => {
      removeItem(item.uid);
      renderCart();
      renderBadge();
      showToast(`${item.name} odebrán`);
    });

    row.append(thumb, info, removeBtn);
    return row;
  }

  /* ── RENDER: CELÝ KOŠÍK ───────────────────────────────────────────────── */

  function renderCart() {
    // odstraníme dřívější položky (zachováme empty state div)
    itemsEl.querySelectorAll('.cart-item').forEach(el => el.remove());

    if (cart.length === 0) {
      emptyEl.classList.remove('hidden');
      footerEl.classList.add('hidden');
      clearBtn.style.visibility = 'hidden';
      return;
    }

    emptyEl.classList.add('hidden');
    footerEl.classList.remove('hidden');
    clearBtn.style.visibility = 'visible';

    // render každé položky
    const fragment = document.createDocumentFragment();
    cart.forEach(item => fragment.appendChild(renderCartItem(item)));
    itemsEl.appendChild(fragment);

    // aktualizuj ceny
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    if (totalEl)    totalEl.textContent    = `${total} Kč`;
    if (subtotalEl) subtotalEl.textContent = `${total} Kč`;
  }

  /* ── RENDER: PRODUKT KARTA ────────────────────────────────────────────── */

  function renderProductCard(product) {
    const isVinyl = product.sizes.length === 1; // vinyl = jen "2LP", bez výběru

    const card = document.createElement('div');
    card.className        = 'product-card';
    card.dataset.productId = product.id;

    /* obrázek */
    const imageWrap = document.createElement('div');
    imageWrap.className = 'product-card__image';

    const img = document.createElement('img');
    img.src     = product.image;
    img.alt     = product.name;
    img.loading = 'lazy';
    imageWrap.appendChild(img);

    if (product.badge) {
      const badge = document.createElement('span');
      badge.className   = 'product-card__badge';
      badge.textContent = product.badge;
      imageWrap.appendChild(badge);
    }

    /* body */
    const body = document.createElement('div');
    body.className = 'product-card__body';

    /* název + cena */
    const header = document.createElement('div');
    header.className = 'product-card__header';

    const nameEl = document.createElement('h3');
    nameEl.className   = 'product-card__name';
    nameEl.textContent = product.name;

    const priceEl = document.createElement('p');
    priceEl.className   = 'product-card__price';
    priceEl.textContent = `${product.price} Kč`;

    header.append(nameEl, priceEl);

    /* size selector (pro vinyl skrytý) */
    let sizeSelector = null;

    if (!isVinyl) {
      const sizeWrap = document.createElement('div');

      const sizeLabel = document.createElement('p');
      sizeLabel.className   = 'size-label';
      sizeLabel.textContent = 'Velikost';

      sizeSelector = document.createElement('div');
      sizeSelector.className        = 'size-selector';
      sizeSelector.dataset.productId = product.id;

      product.sizes.forEach(size => {
        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = 'size-btn';
        btn.dataset.size = size;
        btn.textContent  = size;
        btn.setAttribute('aria-label', `Velikost ${size}`);
        sizeSelector.appendChild(btn);
      });

      sizeWrap.append(sizeLabel, sizeSelector);
      body.append(header, sizeWrap);
    } else {
      body.append(header);
    }

    /* add-to-cart tlačítko */
    const addBtn = document.createElement('button');
    addBtn.type      = 'button';
    addBtn.className = isVinyl ? 'add-to-cart ready' : 'add-to-cart';
    addBtn.disabled  = !isVinyl;
    addBtn.dataset.productId = product.id;
    addBtn.dataset.size      = isVinyl ? product.sizes[0] : '';
    addBtn.textContent = isVinyl ? 'Přidat do košíku' : 'Vyber velikost';

    body.appendChild(addBtn);
    card.append(imageWrap, body);
    return card;
  }

  /* ── DELEGOVANÝ EVENT: SIZE SELECTION ────────────────────────────────── */

  gridEl.addEventListener('click', e => {
    const sizeBtn = e.target.closest('.size-btn');
    if (!sizeBtn) return;

    const selector  = sizeBtn.closest('.size-selector');
    const productId = selector?.dataset.productId;
    if (!productId) return;

    // deaktivuj ostatní, aktivuj vybrané
    selector.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    sizeBtn.classList.add('active');

    // odemkni tlačítko "Přidat do košíku"
    const card   = selector.closest('.product-card');
    const addBtn = card?.querySelector('.add-to-cart');
    if (!addBtn) return;

    addBtn.dataset.size  = sizeBtn.dataset.size;
    addBtn.textContent   = 'Přidat do košíku';
    addBtn.disabled      = false;
    addBtn.classList.add('ready');
  });

  /* ── DELEGOVANÝ EVENT: ADD TO CART ───────────────────────────────────── */

  gridEl.addEventListener('click', e => {
    const addBtn = e.target.closest('.add-to-cart.ready');
    if (!addBtn || addBtn.disabled) return;

    const productId = addBtn.dataset.productId;
    const size      = addBtn.dataset.size;
    if (!productId || !size) return;

    const product = findProduct(productId);
    if (!product) return;

    addItem(productId, size);
    renderCart();
    renderBadge();

    // vizuální feedback na kartě
    addBtn.textContent = '✓ Přidáno';
    addBtn.classList.remove('ready');
    addBtn.classList.add('success');
    addBtn.disabled = true;

    setTimeout(() => {
      addBtn.textContent = 'Přidat do košíku';
      addBtn.classList.remove('success');
      addBtn.classList.add('ready');
      addBtn.disabled = false;
    }, 1400);

    showToast(`${product.name} (${size}) přidán`);
    openCart();
  });

  /* ── CLEAR CART ───────────────────────────────────────────────────────── */

  clearBtn?.addEventListener('click', () => {
    clearCart();
    renderCart();
    renderBadge();
    showToast('Košík byl vyprázdněn');
  });

  /* ── CHECKOUT ─────────────────────────────────────────────────────────── */

  checkoutBtn?.addEventListener('click', () => {
    if (cart.length === 0) return;

    const payload = getCheckoutPayload();

    // Demo: výpis do konzole (v produkci: volejte API endpoint)
    console.group('merch:checkout payload (Stripe-ready)');
    console.log(JSON.stringify(payload, null, 2));
    console.groupEnd();

    // Dispatch custom event — napojte zde svůj payment handler
    dispatch('merch:checkout', { payload, cart: [...cart] });

    showToast('Přesměrování na platební bránu…');

    // Demo: po 1.2 s přesměruj na e-shop
    setTimeout(() => {
      window.open('https://shop.tynikdy.cz/', '_blank', 'noopener,noreferrer');
    }, 1200);
  });


  /* ── INIT ─────────────────────────────────────────────────────────────── */

  function init() {
    // vykresli produkty z PRODUCTS konfigurace
    const fragment = document.createDocumentFragment();
    PRODUCTS.forEach(p => fragment.appendChild(renderProductCard(p)));
    gridEl.appendChild(fragment);

    // nastav initial stav košíku
    renderCart();
    renderBadge();
    clearBtn && (clearBtn.style.visibility = 'hidden');
  }

  init();

})();
