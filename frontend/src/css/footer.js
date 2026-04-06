/**
 * footer.js — Diseños Acuña
 * Inyecta el footer en cualquier página pública.
 *
 * Uso: <script src="../src/css/footer.js" defer></script>
 */

(function () {
  /* ═══════════════════════════════════════════════
     1. GOOGLE FONTS (si no están cargadas ya)
  ═══════════════════════════════════════════════ */
  if (!document.querySelector('link[href*="Playfair+Display"]')) {
    const fonts = document.createElement("link");
    fonts.rel  = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
    document.head.appendChild(fonts);
  }

  /* ═══════════════════════════════════════════════
     2. ESTILOS (CSS puro)
  ═══════════════════════════════════════════════ */
  const style = document.createElement("style");
  style.textContent = `
    /* ── FOOTER ── */
    #da-footer {
      background: #1a2232;
      color: #d1d5db;
      font-family: 'DM Sans', sans-serif;
      padding: 3.5rem 2rem 0;
      margin-top: auto;
    }

    /* Grid principal: 4 columnas en desktop */
    .da-footer-grid {
      display: grid;
      grid-template-columns: 1.6fr 1fr 1fr 1fr;
      gap: 2.5rem;
      max-width: 1200px;
      margin: 0 auto;
      padding-bottom: 3rem;
    }

    /* ── COLUMNA MARCA ── */
    .da-footer-brand-title {
      font-family: 'Playfair Display', serif;
      color: #c9a84c;
      font-size: 1.4rem;
      font-weight: 700;
      margin-bottom: .75rem;
    }
    .da-footer-brand-desc {
      font-size: .85rem;
      color: #9ca3af;
      line-height: 1.7;
      max-width: 260px;
    }

    /* ── CABECERAS DE COLUMNA ── */
    .da-footer-col-title {
      font-size: .95rem;
      font-weight: 600;
      color: #f9fafb;
      margin-bottom: 1.1rem;
      letter-spacing: .02em;
    }

    /* ── COLUMNA CONTACTO ── */
    .da-footer-contact-list {
      list-style: none;
      padding: 0; margin: 0;
      display: flex;
      flex-direction: column;
      gap: .65rem;
    }
    .da-footer-contact-list li {
      display: flex;
      align-items: flex-start;
      gap: .6rem;
      font-size: .85rem;
      color: #9ca3af;
      line-height: 1.5;
    }
    .da-footer-contact-list li svg {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
      margin-top: .1rem;
      color: #c9a84c;
    }

    /* ── COLUMNA ENLACES ── */
    .da-footer-links {
      list-style: none;
      padding: 0; margin: 0;
      display: flex;
      flex-direction: column;
      gap: .55rem;
    }
    .da-footer-links a {
      font-size: .85rem;
      color: #9ca3af;
      text-decoration: none;
      transition: color .2s;
    }
    .da-footer-links a:hover { color: #c9a84c; }

    /* ── COLUMNA REDES ── */
    .da-footer-socials {
      display: flex;
      gap: .75rem;
    }
    .da-social-btn {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: .6rem;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.05);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #d1d5db;
      text-decoration: none;
      transition: background .2s, color .2s, border-color .2s;
    }
    .da-social-btn:hover {
      background: rgba(201,168,76,.15);
      border-color: #c9a84c;
      color: #c9a84c;
    }
    .da-social-btn svg {
      width: 1.1rem;
      height: 1.1rem;
    }

    /* ── BARRA INFERIOR ── */
    .da-footer-bottom {
      border-top: 1px solid rgba(255,255,255,.08);
      padding: 1.25rem 2rem;
      text-align: center;
      max-width: 1200px;
      margin: 0 auto;
    }
    .da-footer-bottom p {
      font-size: .8rem;
      color: #6b7280;
    }

    /* ── RESPONSIVE: tablet / móvil ── */
    @media (max-width: 900px) {
      .da-footer-grid {
        grid-template-columns: 1fr 1fr;
        gap: 2rem;
      }
    }

    @media (max-width: 560px) {
      #da-footer { padding: 2.5rem 1.5rem 0; }
      .da-footer-grid {
        grid-template-columns: 1fr;
        gap: 1.75rem;
        padding-bottom: 2rem;
      }
      .da-footer-brand-desc { max-width: 100%; }
      .da-footer-bottom { padding: 1rem 1.5rem; }
    }
  `;
  document.head.appendChild(style);

  /* ═══════════════════════════════════════════════
     3. HELPERS SVG
  ═══════════════════════════════════════════════ */
  function svg(paths) {
    return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${paths}</svg>`;
  }

  const ICONS = {
    phone:    `<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.18 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.29 6.29l1.28-1.28a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>`,
    mail:     `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
    location: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>`,
    facebook: `<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>`,
    instagram:`<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>`,
    twitter:  `<path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>`,
  };

  /* ═══════════════════════════════════════════════
     4. HTML DEL FOOTER
  ═══════════════════════════════════════════════ */
  const footerHTML = `
    <footer id="da-footer">
      <div class="da-footer-grid">

        <!-- Columna 1: Marca -->
        <div>
          <p class="da-footer-brand-title">Diseños Acuña</p>
          <p class="da-footer-brand-desc">
            Invitaciones personalizadas para tus momentos más especiales.
            Creamos diseños únicos que reflejan tu estilo.
          </p>
        </div>

        <!-- Columna 2: Contacto -->
        <div>
          <p class="da-footer-col-title">Contacto</p>
          <ul class="da-footer-contact-list">
            <li>${svg(ICONS.phone)}    +52 (55) 1234-5678</li>
            <li>${svg(ICONS.mail)}     info@disenosacuna.com</li>
            <li>${svg(ICONS.location)} Ciudad de México, México</li>
          </ul>
        </div>

        <!-- Columna 3: Enlaces -->
        <div>
          <p class="da-footer-col-title">Enlaces</p>
          <ul class="da-footer-links">
            <li><a href="../landing/catalogo.html">Catálogo</a></li>
            <li><a href="../landing/personaliza.html">Personaliza</a></li>
            <li><a href="../landing/nosotros.html">Nosotros</a></li>
            <li><a href="../landing/contacto.html">Contacto</a></li>
            <li><a href="../landing/privacidad.html">Aviso de Privacidad</a></li>
          </ul>
        </div>

        <!-- Columna 4: Redes sociales -->
        <div>
          <p class="da-footer-col-title">Síguenos</p>
          <div class="da-footer-socials">
            <a href="#" class="da-social-btn" aria-label="Facebook">
              ${svg(ICONS.facebook)}
            </a>
            <a href="#" class="da-social-btn" aria-label="Instagram">
              ${svg(ICONS.instagram)}
            </a>
            <a href="#" class="da-social-btn" aria-label="Twitter / X">
              ${svg(ICONS.twitter)}
            </a>
          </div>
        </div>

      </div>

      <!-- Barra copyright -->
      <div class="da-footer-bottom">
        <p>© ${new Date().getFullYear()} Diseños Acuña. Todos los derechos reservados.</p>
      </div>
    </footer>
  `;

  /* ═══════════════════════════════════════════════
     5. INYECTAR AL FINAL DEL BODY
  ═══════════════════════════════════════════════ */
  document.body.insertAdjacentHTML("beforeend", footerHTML);

})();s