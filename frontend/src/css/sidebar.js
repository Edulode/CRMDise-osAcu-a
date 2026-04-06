/**
 * sidebar.js — Diseños Acuña
 * Inyecta el sidebar y el header superior en cualquier página.
 * Uso: <script src="../src/js/sidebar.js" data-active="dashboard" defer></script>
 *
 * NOTA: Usa CSS puro (no clases Tailwind) para que funcione sin compilación.
 */

(function () {
  // ── 1. Google Fonts ──────────────────────────────────────────────────────
  if (!document.querySelector('link[href*="Playfair+Display"]')) {
    const fonts = document.createElement("link");
    fonts.rel  = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
    document.head.appendChild(fonts);
  }

  // ── 2. Estilos completos en CSS puro ────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --sidebar-bg:    #1a2232;
      --sidebar-w:     16rem;
      --gold:          #c9a84c;
      --gold-light:    #e8c56a;
      --gold-hover-bg: rgba(201,168,76,.12);
      --header-h:      65px;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      background: #f3f4f6;
      min-height: 100vh;
    }

    /* ── OVERLAY ── */
    #da-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.45);
      z-index: 20;
    }
    #da-overlay.open { display: block; }

    /* ── SIDEBAR ── */
    #da-sidebar {
      position: fixed;
      top: 0; left: 0;
      height: 100%;
      width: var(--sidebar-w);
      background: var(--sidebar-bg);
      display: flex;
      flex-direction: column;
      z-index: 30;
      transform: translateX(-100%);
      transition: transform .3s ease;
    }
    #da-sidebar.open { transform: translateX(0); }

    /* desktop: siempre visible */
    @media (min-width: 768px) {
      #da-sidebar { transform: translateX(0) !important; }
      #da-overlay  { display: none !important; }
    }

    /* Sidebar: cabecera */
    .da-sidebar-brand {
      padding: 2rem 1.5rem 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,.1);
    }
    .da-sidebar-brand-title {
      font-family: 'Playfair Display', serif;
      color: var(--gold);
      font-size: 1.2rem;
      font-weight: 700;
      line-height: 1.2;
    }
    .da-sidebar-brand-sub {
      color: #9ca3af;
      font-size: .7rem;
      margin-top: .25rem;
      letter-spacing: .05em;
    }

    /* Sidebar: nav */
    .da-nav {
      flex: 1;
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      gap: .25rem;
      overflow-y: auto;
    }
    .da-nav-link {
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .75rem 1rem;
      border-radius: .75rem;
      text-decoration: none;
      font-size: .875rem;
      color: #d1d5db;
      transition: background .2s, color .2s;
    }
    .da-nav-link:hover {
      background: var(--gold-hover-bg);
      color: var(--gold-light);
    }
    .da-nav-link.active {
      background: var(--gold);
      color: var(--sidebar-bg);
      font-weight: 600;
    }
    .da-nav-link svg {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
    }

    /* Sidebar: footer / logout */
    .da-sidebar-footer {
      padding: 1rem;
      border-top: 1px solid rgba(255,255,255,.1);
    }
    .da-logout {
      display: flex;
      align-items: center;
      gap: .75rem;
      padding: .75rem 1rem;
      border-radius: .75rem;
      text-decoration: none;
      font-size: .875rem;
      color: #9ca3af;
      transition: background .2s, color .2s;
    }
    .da-logout:hover { color: #f87171; background: rgba(248,113,113,.08); }
    .da-logout svg { width: 1rem; height: 1rem; flex-shrink: 0; }

    /* ── MAIN WRAPPER ── */
    #da-main {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      margin-left: 0;
      transition: margin-left .3s ease;
    }
    @media (min-width: 768px) {
      #da-main { margin-left: var(--sidebar-w); }
    }

    /* ── HEADER ── */
    #da-header {
      background: #fff;
      border-bottom: 1px solid #e5e7eb;
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 10;
      height: var(--header-h);
    }
    .da-hamburger {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: .5rem;
      border: none;
      background: transparent;
      border-radius: .5rem;
      cursor: pointer;
      transition: background .2s;
    }
    .da-hamburger:hover { background: #f3f4f6; }
    .da-hamburger svg { width: 1.25rem; height: 1.25rem; }
    @media (min-width: 768px) {
      .da-hamburger { display: none; }
    }

    .da-header-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
    }

    .da-header-user {
      display: flex;
      align-items: center;
      gap: .75rem;
    }
    .da-header-user-info {
      text-align: right;
      display: none;
    }
    @media (min-width: 640px) {
      .da-header-user-info { display: block; }
    }
    .da-header-user-name {
      font-size: .875rem;
      font-weight: 500;
      color: #1f2937;
    }
    .da-header-user-email {
      font-size: .75rem;
      color: #9ca3af;
    }
    .da-avatar {
      background: var(--gold);
      color: var(--sidebar-bg);
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: .875rem;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  // ── 3. Página activa ─────────────────────────────────────────────────────
  const scriptTag  = document.currentScript;
  const activePage = scriptTag ? (scriptTag.dataset.active || "") : "";

  // ── 4. Definición de enlaces ─────────────────────────────────────────────
  const navLinks = [
    {
      page: "dashboard", label: "Dashboard", href: "index.html",
      icon: `<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
             <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>`,
    },
    {
      page: "pedidos", label: "Pedidos", href: "pedidos.html",
      icon: `<path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>`,
    },
    {
      page: "clientes", label: "Clientes", href: "clientes.html",
      icon: `<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
             <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>`,
    },
    {
      page: "disenos", label: "Diseños", href: "disenos.html",
      icon: `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>`,
    },
    {
      page: "reportes", label: "Reportes", href: "reportes.html",
      icon: `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
             <line x1="6" y1="20" x2="6" y2="14"/>`,
    },
    {
      page: "seguridad", label: "Seguridad", href: "seguridad.html",
      icon: `<path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10a2 2 0 11-4 0 2 2 0 014 0z"/>`,
    },
  ];

  function svg(paths) {
    return `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${paths}</svg>`;
  }

  function buildNav() {
    return navLinks.map(({ page, label, href, icon }) => `
      <a href="${href}" data-page="${page}" class="da-nav-link${page === activePage ? " active" : ""}">
        ${svg(icon)}
        ${label}
      </a>`).join("");
  }

  // ── 5. HTML del layout ───────────────────────────────────────────────────
  const layoutHTML = `
    <div id="da-overlay"></div>

    <aside id="da-sidebar">
      <div class="da-sidebar-brand">
        <p class="da-sidebar-brand-title">Diseños Acuña</p>
        <p class="da-sidebar-brand-sub">Panel de Administración</p>
      </div>
      <nav class="da-nav">${buildNav()}</nav>
      <div class="da-sidebar-footer">
        <a href="login.html" class="da-logout">
          ${svg(`<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>`)}
          Cerrar Sesión
        </a>
      </div>
    </aside>

    <div id="da-main">
      <header id="da-header">
        <button class="da-hamburger" onclick="daToggleSidebar()" aria-label="Menú">
          ${svg(`<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>`)}
        </button>
        <h1 class="da-header-title" id="da-page-title"></h1>
        <div class="da-header-user">
          <div class="da-header-user-info">
            <p class="da-header-user-name">Admin User</p>
            <p class="da-header-user-email">admin@disenosacuna.com</p>
          </div>
          <div class="da-avatar">A</div>
        </div>
      </header>
    </div>
  `;

  // ── 6. Inyectar en body ──────────────────────────────────────────────────
  const wrapper = document.createElement("div");
  wrapper.innerHTML = layoutHTML;
  document.body.prepend(wrapper);

  // Mueve el contenido original de la página dentro de #da-main
  const daMain = document.getElementById("da-main");
  Array.from(document.body.childNodes)
    .filter(n => n !== wrapper)
    .forEach(n => daMain.appendChild(n));

  // ── 7. Título automático ─────────────────────────────────────────────────
  const titleEl = document.getElementById("da-page-title");
  if (titleEl) {
    const found = navLinks.find(l => l.page === activePage);
    titleEl.textContent = found ? found.label : document.title || "";
  }

  // ── 8. Toggle sidebar (móvil) ────────────────────────────────────────────
  window.daToggleSidebar = function () {
    const sidebar = document.getElementById("da-sidebar");
    const overlay = document.getElementById("da-overlay");
    const isOpen  = sidebar.classList.contains("open");
    sidebar.classList.toggle("open", !isOpen);
    overlay.classList.toggle("open",  !isOpen);
  };

  document.getElementById("da-overlay").addEventListener("click", () => {
    window.daToggleSidebar();
  });
})();