// ============================================================
// HOSTEL ITALIAN — main.js
// Punto de entrada. Importa módulos separados.
// ============================================================

import { initReservation } from './reservation.js';
import { getConfig }       from './storage.js';

// ── Inyección de header y footer ─────────────────────────
const _base = location.pathname.includes('/page/') ? '../' : '';

async function loadPartial(selector, url) {
  try {
    const res  = await fetch(_base + url);
    const html = await res.text();
    document.querySelector(selector).innerHTML = html;
  } catch {
    // Partial no disponible (file:// protocol o ruta incorrecta)
  }
}

async function initPartials() {
  await Promise.all([
    loadPartial('#header-placeholder', 'partials/header.html'),
    loadPartial('#footer-placeholder', 'partials/footer.html'),
  ]);

  // Ajustar hrefs de los partials cuando estamos en una subpágina
  if (_base) {
    ['#header-placeholder', '#footer-placeholder'].forEach(id => {
      document.querySelectorAll(`${id} a[href]`).forEach(a => {
        const href = a.getAttribute('href');
        if (!href.startsWith('http') && !href.startsWith('#') &&
            !href.startsWith('mailto:') && !href.startsWith('tel:') &&
            !href.startsWith('../')) {
          a.setAttribute('href', _base + href);
        }
      });
    });
  }

  // Año actual en footer
  document.querySelectorAll('.js-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // Marcar link activo según página actual
  const filename = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar__link, .navbar__cta').forEach(link => {
    const linkFile = link.getAttribute('href').split('/').pop();
    if (linkFile === filename || (filename === '' && linkFile === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Inicializar navbar y mobile menu después de inyectar
  initNavbar();
}

// ── Navbar scroll ─────────────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  const toggle      = document.querySelector('.navbar__toggle');
  const mobileMenu  = document.querySelector('.mobile-menu');
  const closeBtn    = document.querySelector('.mobile-menu__close');
  const mobileLinks = document.querySelectorAll('.mobile-menu__link, .mobile-menu__cta');

  const openMenu = () => {
    mobileMenu?.classList.add('open');
    document.body.style.overflow = 'hidden';
    toggle?.setAttribute('aria-expanded', 'true');
    toggle?.setAttribute('aria-label', 'Cerrar menú');
    mobileMenu?.querySelector('.mobile-menu__link')?.focus();
  };

  const closeMenu = () => {
    mobileMenu?.classList.remove('open');
    document.body.style.overflow = '';
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Abrir menú');
    toggle?.focus();
  };

  toggle?.addEventListener('click', openMenu);
  closeBtn?.addEventListener('click', closeMenu);
  mobileLinks.forEach(l => l.addEventListener('click', closeMenu));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu?.classList.contains('open')) closeMenu();
  });
}

// ── Animaciones scroll (IntersectionObserver) ─────────────
function initAnimations() {
  const els = document.querySelectorAll('.fade-up');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const siblings = [...entry.target.parentElement.querySelectorAll('.fade-up')];
      const idx = siblings.indexOf(entry.target);
      entry.target.style.transitionDelay = `${idx * 0.08}s`;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
}

// ── Precios (única fuente: storage.js) ─────────────────────
// Cualquier <strong data-price="dorm"> o data-price="private"> en el HTML
// se pinta acá. Así, si el precio cambia en storage.js, no hace falta
// tocar cada página a mano — y nunca se desincroniza el precio mostrado
// del precio que realmente se usa para calcular el total de la reserva.
function renderPrices() {
  const { prices } = getConfig();
  document.querySelectorAll('[data-price]').forEach(el => {
    const type = el.dataset.price;
    if (prices[type] != null) {
      el.textContent = `$${prices[type].toLocaleString('es-AR')} ARS`;
    }
  });
}

// ── Formulario de contacto (ubicacion.html) ───────────────
// Sin backend propio, la opción honesta y funcional es abrir el cliente
// de email del usuario con el mensaje ya redactado (mismo criterio que
// el botón de WhatsApp del wizard de reservas). Antes, el formulario
// mostraba "Mensaje enviado" sin mandar el mensaje a ningún lado.
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Validación nativa del navegador (los campos obligatorios tienen `required`)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const btn = document.getElementById('contact-submit');
    const msg = document.getElementById('contact-success');

    const name    = document.getElementById('contact-name')?.value.trim()    || '';
    const email   = document.getElementById('contact-email')?.value.trim()   || '';
    const subject = document.getElementById('contact-subject')?.value.trim() || 'Consulta desde la web';
    const message = document.getElementById('contact-message')?.value.trim() || '';

    const { contactEmail } = getConfig();
    const body = encodeURIComponent(
      `Nombre: ${name}\nEmail: ${email}\n\n${message}`
    );
    const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${body}`;

    btn.disabled = true;
    btn.textContent = 'Abriendo tu email…';

    window.location.href = mailtoUrl;

    setTimeout(() => {
      this.reset();
      btn.disabled = false;
      btn.style.display = 'none';
      if (msg) msg.style.display = 'block';
    }, 900);
  });
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initPartials();
  initAnimations();
  initReservation();
  initContactForm();
  renderPrices();
});
