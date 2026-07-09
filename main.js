// theme toggle
(function () {
  const root = document.documentElement;
  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  if (!btn) return;

  const flash = document.createElement('div');
  flash.className = 'theme-flash';
  document.body.appendChild(flash);

  function syncIcon() {
    const dark = (root.getAttribute('data-theme') || 'dark') === 'dark';
    icon.textContent = dark ? '☾' : '☀';
    btn.setAttribute('aria-pressed', dark ? 'false' : 'true');
  }
  syncIcon();

  btn.addEventListener('click', () => {
    const next = (root.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('rest-theme', next); } catch (e) {}
    syncIcon();
    flash.classList.remove('flashing');
    // Reading offsetWidth forces a synchronous layout flush — without it, removing
    // and re-adding the class in the same frame is batched by the browser and the
    // CSS animation never restarts from the beginning.
    void flash.offsetWidth;
    flash.classList.add('flashing');
  });

  // respect OS preference on first visit
  try {
    if (!localStorage.getItem('rest-theme') && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      root.setAttribute('data-theme', 'light');
      syncIcon();
    }
  } catch (e) {}
})();

// nav — hide on scroll down, show on scroll up
(function () {
  const nav = document.querySelector('nav');
  if (!nav) return;
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    nav.classList.toggle('nav-hidden', y > lastY && y > 120);
    lastY = y;
  }, { passive: true });
})();

// scroll reveal — blocks
(function () {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (!e.isIntersecting) return;
      setTimeout(() => e.target.classList.add('in'), i * 50);
      io.unobserve(e.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

// scroll reveal — hero headline (fires on load, not scroll)
(function () {
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.reveal-line').forEach(el => el.classList.add('in'));
    }, 120);
  });
})();

// hero portrait parallax
(function () {
  const img = document.querySelector('.hero-portrait img');
  if (!img) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < window.innerHeight) {
      img.style.transform = `translateY(${Math.min(y * 0.08, 40)}px) scale(1.03)`;
    }
  }, { passive: true });
})();

// discography accordion — single open
(function () {
  const details = document.querySelectorAll('#disco details');
  details.forEach(d => {
    d.addEventListener('toggle', () => {
      if (d.open) details.forEach(other => { if (other !== d) other.open = false; });
    });
  });
})();

// booking form — event type selector
(function () {
  const ACTIVE = ['border-[var(--ink)]', 'bg-[var(--ink)]', 'text-[var(--invert)]', 'font-bold'];
  document.querySelectorAll('.event-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.event-type-btn').forEach(b => {
        b.classList.remove(...ACTIVE);
        b.classList.add('border-[var(--line)]');
        b.removeAttribute('data-active');
      });
      btn.classList.add(...ACTIVE);
      btn.classList.remove('border-[var(--line)]');
      btn.setAttribute('data-active', 'true');
    });
  });
})();

// booking form — submit: hide form, show confirmation
(function () {
  const form = document.querySelector('#kontakt form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    form.style.transition = 'opacity 0.3s';
    form.style.opacity    = '0';

    setTimeout(() => {
      const msg = document.createElement('div');
      msg.className = 'lg:col-span-3 flex flex-col gap-5 justify-center py-4';

      const title = document.createElement('p');
      title.className = 'font-display font-extrabold uppercase text-[var(--ink)]';
      title.style.fontSize = 'clamp(2rem, 5vw, 3rem)';
      title.style.lineHeight = '0.96';
      title.textContent = 'Poptávka přijata. ✓';

      const subtitle = document.createElement('p');
      subtitle.className = 'font-mono text-[0.7rem] tracking-[0.06em] uppercase leading-[1.8] text-[var(--ink-dim)] max-w-[26rem]';

      const line1 = document.createTextNode('Demo verze — backend zatím není napojený.');
      const br    = document.createElement('br');
      const line2 = document.createTextNode('Ozvi se přímo na ');

      const link = document.createElement('a');
      link.href        = 'mailto:booking@tynikdy.cz';
      link.className   = 'underline underline-offset-[3px] text-[var(--ink)]';
      link.textContent = 'booking@tynikdy.cz';

      subtitle.append(line1, br, line2, link);
      msg.append(title, subtitle);
      form.replaceWith(msg);
    }, 300);
  });
})();
// press-kit demo notice
(function () {
  const link = document.getElementById('press-kit-download');
  if (!link) return;

  // build overlay once, reuse on subsequent clicks
  const overlay = document.createElement('div');
  overlay.className = 'pk-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Press-kit nedostupný');
  overlay.innerHTML = `
    <div class="pk-box">
      <button class="pk-close" aria-label="Zavřít">[ zavřít × ]</button>
      <p style="font-family:var(--font-mono);font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ink-faint);margin-bottom:1.25rem;">
        Press kit / Demo
      </p>
      <p style="font-family:var(--font-display);font-weight:800;text-transform:uppercase;font-size:clamp(1.6rem,4vw,2.4rem);line-height:0.96;color:var(--ink);margin-bottom:1.5rem;">
        Soubor<br>není k dispozici.
      </p>
      <p style="font-family:var(--font-mono);font-size:0.7rem;line-height:1.85;letter-spacing:0.04em;text-transform:uppercase;color:var(--ink-dim);">
        Toto je fanouškovský redesign.<br>
        Reálný ZIP s bio, riderem a fotkami<br>
        není součástí demo verze.<br><br>
        Pro oficiální materiály piš na<br>
        <a href="mailto:booking@tynikdy.cz"
           style="color:var(--ink);text-decoration:underline;text-underline-offset:3px;"
           onclick="event.stopPropagation()">
          booking@tynikdy.cz
        </a>
      </p>
    </div>
  `;
  document.body.appendChild(overlay);

  function open() {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('visible'));
    overlay.querySelector('.pk-close').focus();
  }

  function close() {
    overlay.classList.remove('visible');
    overlay.addEventListener('transitionend', () => {
      overlay.style.display = 'none';
    }, { once: true });
  }

  link.addEventListener('click', (e) => {
    e.preventDefault();
    open();
  });

  // close on backdrop click or close button
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.pk-close').addEventListener('click', close);

  // close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
  });
})();