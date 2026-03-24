/**
 * layout.js — Diseños Acuña
 * Inyecta el sidebar y el header superior en cualquier página.
 * Uso: <script src="../src/js/layout.js" data-active="dashboard"></script>
 *
 * El atributo data-active debe coincidir con el valor "data-page" de cada enlace
 * para marcar automáticamente el ítem activo del sidebar.
 */

(function () {
  // ── 1. Estilos del layout ────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --color-sidebar: #1a2232;
      --color-gold:    #c9a84c;
      --color-gold-light: #e8c56a;
    }
    body { font-family: 'DM Sans', sans-serif; }
    .font-display { font-family: 'Playfair Display', serif; }
    .bg-sidebar  { background-color: var(--color-sidebar); }
    .text-sidebar{ color: var(--color-sidebar); }
    .bg-gold     { background-color: var(--color-gold); }
    .text-gold   { color: var(--color-gold); }

    .sidebar-link { transition: background .2s, color .2s; }
    .sidebar-link:hover {
      background: rgba(201,168,76,.12);
      color: var(--color-gold-light);
    }
    .sidebar-link.active {
      background-color: var(--color-gold);
      color: var(--color-sidebar);
      font-weight: 600;
    }

    /* El contenido principal siempre queda a la derecha del sidebar */
    #layout-main { margin-left: 0; }
    @media (min-width: 768px) {
      #layout-main { margin-left: 16rem; /* 64 * 0.25rem = 16rem = w-64 */ }
      #layout-sidebar { transform: translateX(0) !important; }
      #layout-overlay  { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  // ── 2. Google Fonts (si aún no están cargadas) ───────────────────────────
  if (!document.querySelector('link[href*="Playfair+Display"]')) {
    const fonts = document.createElement("link");
    fonts.rel  = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap";
    document.head.appendChild(fonts);
  }

  // ── 3. Determinar la página activa ───────────────────────────────────────
  const scriptTag  = document.currentScript;
  const activePage = scriptTag ? (scriptTag.dataset.active || "") : "";

  // ── 4. Definición de los enlaces del sidebar ─────────────────────────────
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
      page: "configuracion", label: "Configuración", href: "configuracion.html",
      icon: `<circle cx="12" cy="12" r="3"/>
             <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>`,
    },
    {
      page: "seguridad", label: "Seguridad", href: "seguridad.html",
      icon: `<path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10a2 2 0 11-4 0 2 2 0 014 0z"/>`,
    },
  ];

  function buildIcon(paths) {
    return `<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">${paths}</svg>`;
  }

  function buildNavItems() {
    return navLinks.map(({ page, label, href, icon }) => {
      const isActive = page === activePage ? "active" : "";
      return `
        <a href="${href}" data-page="${page}"
           class="sidebar-link ${isActive} flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-300">
          ${buildIcon(icon)}
          ${label}
        </a>`;
    }).join("\n");
  }

  // ── 5. HTML del layout ───────────────────────────────────────────────────
  const layoutHTML = `
    <!-- Overlay móvil -->
    <div id="layout-overlay" class="fixed inset-0 bg-black/40 z-20 hidden" onclick="layoutToggleSidebar()"></div>

    <!-- SIDEBAR -->
    <aside id="layout-sidebar"
      class="bg-sidebar fixed top-0 left-0 h-full w-64 flex flex-col z-30 -translate-x-full md:translate-x-0 transition-transform duration-300">

      <div class="px-6 pt-8 pb-6 border-b border-white/10">
        <p class="text-gold font-display text-xl font-bold leading-tight">Diseños Acuña</p>
        <p class="text-gray-400 text-xs mt-1 tracking-wide">Panel de Administración</p>
      </div>

      <nav class="flex-1 px-4 py-6 space-y-1">
        ${buildNavItems()}
      </nav>

      <div class="px-4 pb-6 border-t border-white/10 pt-4">
        <a href="login.html"
          class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-400 hover:text-red-400">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
          Cerrar Sesión
        </a>
      </div>
    </aside>

    <!-- WRAPPER: todo el contenido de la página va dentro de #layout-main -->
    <div id="layout-main" class="min-h-screen flex flex-col">

      <!-- HEADER -->
      <header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <button class="md:hidden p-2 rounded-lg hover:bg-gray-100" onclick="layoutToggleSidebar()">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h1 id="layout-page-title" class="font-display text-2xl font-bold text-gray-900"></h1>
        <div class="flex items-center gap-3">
          <div class="text-right hidden sm:block">
            <p class="text-sm font-medium text-gray-800">Admin User</p>
            <p class="text-xs text-gray-400">admin@disenosacuna.com</p>
          </div>
          <div class="bg-gold text-sidebar w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
            A
          </div>
        </div>
      </header>

      <!-- SLOT: aquí se monta el <main> de cada página -->
    </div>
  `;

  // ── 6. Inyectar en el body ───────────────────────────────────────────────
  // Insertamos el layout ANTES de cualquier contenido ya existente en body.
  const wrapper = document.createElement("div");
  wrapper.innerHTML = layoutHTML;
  // Movemos los hijos existentes del body dentro de #layout-main (después del header)
  document.body.prepend(wrapper);

  // Mueve los nodos que existían en body (el <main> de la página) dentro del wrapper
  const layoutMain = document.getElementById("layout-main");
  // Recolectamos nodos que NO son el overlay, sidebar ni el wrapper recién insertado
  const existingNodes = Array.from(document.body.childNodes).filter(
    (n) => n !== wrapper
  );
  existingNodes.forEach((n) => layoutMain.appendChild(n));

  // ── 7. Título automático en el header ────────────────────────────────────
  const pageTitle = document.getElementById("layout-page-title");
  if (pageTitle) {
    const found = navLinks.find((l) => l.page === activePage);
    pageTitle.textContent = found ? found.label : document.title || "";
  }

  // ── 8. Lógica del sidebar responsive ────────────────────────────────────
  window.layoutToggleSidebar = function () {
    const sidebar = document.getElementById("layout-sidebar");
    const overlay = document.getElementById("layout-overlay");
    const isOpen  = !sidebar.classList.contains("-translate-x-full");
    if (isOpen) {
      sidebar.classList.add("-translate-x-full");
      overlay.classList.add("hidden");
    } else {
      sidebar.classList.remove("-translate-x-full");
      overlay.classList.remove("hidden");
    }
  };
})();