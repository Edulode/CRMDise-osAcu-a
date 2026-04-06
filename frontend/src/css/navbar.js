/**
 * navbar.js — Diseños Acuña
 * Inyecta la navbar superior en cualquier página pública.
 *
 * Uso: <script src="../src/js/navbar.js" defer></script>
 *
 * Sesión: guarda { nombre, email } en sessionStorage bajo la clave "da_user".
 *   - Si existe → muestra ícono de perfil con menú desplegable (Cerrar Sesión)
 *   - Si no      → muestra botón "Iniciar Sesión"
 *
 * Para iniciar sesión desde cuenta.html:
 *   sessionStorage.setItem("da_user", JSON.stringify({ nombre: "Ana", email: "ana@mail.com" }));
 *   window.location.href = "../landing/index.html";
 */

(function () {
  /* ═══════════════════════════════════════════════
     1. GOOGLE FONTS
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
    *, *::before, *::after { box-sizing: border-box; }

    :root {
      --nav-h:       70px;
      --gold:        #c9a84c;
      --gold-dark:   #a8872e;
      --nav-bg:      #ffffff;
      --nav-text:    #1a2232;
      --nav-muted:   #6b7280;
      --nav-border:  #e5e7eb;
      --mobile-bg:   #ffffff;
    }

    body {
      font-family: 'DM Sans', sans-serif;
      padding-top: var(--nav-h);
    }

    /* ── NAVBAR ── */
    #da-navbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: var(--nav-h);
      background: var(--nav-bg);
      border-bottom: 1px solid var(--nav-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2rem;
      z-index: 100;
      box-shadow: 0 1px 8px rgba(0,0,0,.06);
    }

    .da-nav-brand {
      font-family: 'Playfair Display', serif;
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--nav-text);
      text-decoration: none;
      white-space: nowrap;
    }

    .da-nav-links {
      display: flex;
      align-items: center;
      gap: 2rem;
      list-style: none;
      margin: 0; padding: 0;
    }
    .da-nav-links a {
      text-decoration: none;
      font-size: .9rem;
      color: var(--nav-muted);
      transition: color .2s;
      font-weight: 400;
    }
    .da-nav-links a:hover,
    .da-nav-links a.active { color: var(--nav-text); font-weight: 500; }

    .da-nav-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* ── CARRITO ── */
    .da-cart-btn {
      position: relative;
      background: none;
      border: none;
      cursor: pointer;
      padding: .4rem;
      color: var(--nav-text);
      display: flex;
      align-items: center;
      text-decoration: none;
    }
    .da-cart-btn svg { width: 1.4rem; height: 1.4rem; }
    .da-cart-badge {
      position: absolute;
      top: -2px; right: -4px;
      background: var(--gold);
      color: #fff;
      font-size: .65rem;
      font-weight: 700;
      width: 1.1rem; height: 1.1rem;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .da-cart-badge.hidden { display: none; }

    /* ── BOTÓN INICIAR SESIÓN ── */
    .da-btn-login {
      background: var(--gold);
      color: #fff;
      border: none;
      padding: .55rem 1.25rem;
      border-radius: .5rem;
      font-size: .875rem;
      font-weight: 600;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      transition: background .2s;
      white-space: nowrap;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .da-btn-login:hover { background: var(--gold-dark); }

    /* ── ICONO DE PERFIL + DROPDOWN ── */
    .da-profile-wrap {
      position: relative;
      display: none;
    }
    .da-profile-wrap.visible { display: block; }

    .da-profile-btn {
      background: none;
      border: 2px solid var(--gold);
      border-radius: 50%;
      width: 2.25rem; height: 2.25rem;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      color: var(--nav-text);
      transition: background .2s;
    }
    .da-profile-btn:hover { background: rgba(201,168,76,.12); }
    .da-profile-btn svg { width: 1.1rem; height: 1.1rem; }

    .da-profile-menu {
      position: absolute;
      top: calc(100% + .6rem);
      right: 0;
      background: #fff;
      border: 1px solid var(--nav-border);
      border-radius: .75rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.12);
      min-width: 200px;
      padding: .5rem;
      opacity: 0;
      pointer-events: none;
      transform: translateY(-6px);
      transition: opacity .2s, transform .2s;
    }
    .da-profile-menu.open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .da-profile-menu-header {
      padding: .6rem .75rem .5rem;
      border-bottom: 1px solid var(--nav-border);
      margin-bottom: .35rem;
    }
    .da-profile-menu-name {
      font-size: .875rem;
      font-weight: 600;
      color: var(--nav-text);
    }
    .da-profile-menu-email {
      font-size: .75rem;
      color: var(--nav-muted);
      margin-top: .1rem;
    }
    .da-profile-menu-item {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .6rem .75rem;
      border-radius: .5rem;
      font-size: .875rem;
      color: var(--nav-muted);
      cursor: pointer;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      font-family: 'DM Sans', sans-serif;
      transition: background .2s, color .2s;
      text-decoration: none;
    }
    .da-profile-menu-item:hover { background: #f9fafb; color: var(--nav-text); }
    .da-profile-menu-item.danger:hover { background: #fef2f2; color: #dc2626; }
    .da-profile-menu-item svg { width: .95rem; height: .95rem; flex-shrink: 0; }

    /* ── TOAST ── */
    #da-toast {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%) translateY(6px);
      background: #1a2232;
      color: #fff;
      font-size: .875rem;
      padding: .75rem 1.5rem;
      border-radius: 2rem;
      box-shadow: 0 4px 16px rgba(0,0,0,.2);
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      transition: opacity .3s, transform .3s;
      font-family: 'DM Sans', sans-serif;
      white-space: nowrap;
    }
    #da-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* ── HAMBURGER (móvil) ── */
    .da-hamburger {
      display: none;
      background: none;
      border: none;
      cursor: pointer;
      padding: .4rem;
      color: var(--nav-text);
    }
    .da-hamburger svg { width: 1.4rem; height: 1.4rem; }

    /* ── MENÚ MÓVIL ── */
    #da-mobile-menu {
      display: none;
      position: fixed;
      top: var(--nav-h);
      left: 0; right: 0;
      background: var(--mobile-bg);
      border-bottom: 1px solid var(--nav-border);
      z-index: 99;
      padding: 1rem 1.5rem 1.5rem;
      box-shadow: 0 8px 20px rgba(0,0,0,.1);
      flex-direction: column;
      gap: .25rem;
    }
    #da-mobile-menu.open { display: flex; }

    .da-mobile-link {
      text-decoration: none;
      font-size: .95rem;
      color: var(--nav-muted);
      padding: .7rem .5rem;
      border-radius: .5rem;
      transition: background .15s, color .15s;
      font-weight: 400;
    }
    .da-mobile-link:hover,
    .da-mobile-link.active {
      background: #f9fafb;
      color: var(--nav-text);
      font-weight: 500;
    }
    .da-mobile-divider {
      border: none;
      border-top: 1px solid var(--nav-border);
      margin: .5rem 0;
    }
    .da-mobile-btn-login {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--gold);
      color: #fff;
      border: none;
      padding: .7rem 1.25rem;
      border-radius: .5rem;
      font-size: .9rem;
      font-weight: 600;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif;
      transition: background .2s;
      text-decoration: none;
      margin-top: .25rem;
    }
    .da-mobile-btn-login:hover { background: var(--gold-dark); }

    .da-mobile-logout {
      display: flex;
      align-items: center;
      gap: .6rem;
      background: none;
      border: none;
      color: #dc2626;
      font-size: .9rem;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      padding: .7rem .5rem;
      border-radius: .5rem;
      width: 100%;
      transition: background .15s;
    }
    .da-mobile-logout:hover { background: #fef2f2; }
    .da-mobile-logout svg { width: .95rem; height: .95rem; }

    /* ── RESPONSIVE ── */
    @media (max-width: 767px) {
      .da-nav-links     { display: none; }
      .da-btn-login     { display: none; }
      .da-profile-wrap  { display: none !important; }
      .da-hamburger     { display: flex; }
      #da-navbar        { padding: 0 1.25rem; }
    }

    @media (min-width: 768px) {
      .da-hamburger    { display: none; }
      #da-mobile-menu  { display: none !important; }
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
    cart:   `<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>`,
    person: `<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
    logout: `<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>`,
    burger: `<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>`,
    close:  `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`,
  };

  /* ═══════════════════════════════════════════════
     4. LINKS DE NAVEGACIÓN
  ═══════════════════════════════════════════════ */
  const links = [
    { label: "Inicio",      href: "../landing/index.html" },
    { label: "Catálogo",    href: "../landing/catalogo.html" },
    { label: "Personaliza", href: "../landing/personaliza.html" },
    { label: "Nosotros",    href: "../landing/nosotros.html" },
    { label: "Contacto",    href: "../landing/contacto.html" },
  ];

  const currentFile = window.location.pathname.split("/").pop() || "index.html";
  function isActive(href) {
    return href.split("/").pop() === currentFile;
  }

  function buildDesktopLinks() {
    return links.map(l =>
      `<li><a href="${l.href}" class="da-nav-link${isActive(l.href) ? " active" : ""}">${l.label}</a></li>`
    ).join("");
  }

  function buildMobileLinks() {
    return links.map(l =>
      `<a href="${l.href}" class="da-mobile-link${isActive(l.href) ? " active" : ""}">${l.label}</a>`
    ).join("");
  }

  /* ═══════════════════════════════════════════════
     5. HTML DE LA NAVBAR
  ═══════════════════════════════════════════════ */
  const navHTML = `
    <nav id="da-navbar">
      <a href="../landing/index.html" class="da-nav-brand">Diseños Acuña</a>

      <ul class="da-nav-links">${buildDesktopLinks()}</ul>

      <div class="da-nav-right">

        <!-- Carrito → carrito.html -->
        <a href="../landing/carrito.html" class="da-cart-btn" id="da-cart-btn" aria-label="Carrito">
          ${svg(ICONS.cart)}
          <span class="da-cart-badge hidden" id="da-cart-badge">0</span>
        </a>

        <!-- Botón Iniciar Sesión (sin sesión activa) -->
        <a href="../landing/cuenta.html" class="da-btn-login" id="da-btn-login">Iniciar Sesión</a>

        <!-- Ícono perfil + dropdown (con sesión activa) -->
        <div class="da-profile-wrap" id="da-profile-wrap">
          <button class="da-profile-btn" id="da-profile-btn" aria-label="Mi perfil">
            ${svg(ICONS.person)}
          </button>
          <div class="da-profile-menu" id="da-profile-menu">
            <div class="da-profile-menu-header">
              <p class="da-profile-menu-name" id="da-profile-name">—</p>
              <p class="da-profile-menu-email" id="da-profile-email">—</p>
            </div>
            <button class="da-profile-menu-item danger" id="da-logout-btn">
              ${svg(ICONS.logout)}
              Cerrar Sesión
            </button>
          </div>
        </div>

        <!-- Hamburger (solo móvil) -->
        <button class="da-hamburger" id="da-hamburger" aria-label="Menú">
          ${svg(ICONS.burger)}
        </button>
      </div>
    </nav>

    <!-- Menú móvil desplegable -->
    <div id="da-mobile-menu">
      ${buildMobileLinks()}
      <hr class="da-mobile-divider">
      <div id="da-mobile-auth"></div>
    </div>

    <!-- Toast de notificación -->
    <div id="da-toast"></div>
  `;

  /* ═══════════════════════════════════════════════
     6. INYECTAR EN EL BODY
  ═══════════════════════════════════════════════ */
  const wrapper = document.createElement("div");
  wrapper.innerHTML = navHTML;
  document.body.prepend(wrapper);

  /* ═══════════════════════════════════════════════
     7. LÓGICA DE SESIÓN
  ═══════════════════════════════════════════════ */
  const SESSION_KEY = "da_user";

  function getUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  function renderAuth() {
    const user        = getUser();
    const btnLogin    = document.getElementById("da-btn-login");
    const profileWrap = document.getElementById("da-profile-wrap");
    const mobileAuth  = document.getElementById("da-mobile-auth");

    if (user) {
      btnLogin.style.display = "none";
      profileWrap.classList.add("visible");
      document.getElementById("da-profile-name").textContent  = user.nombre || "Usuario";
      document.getElementById("da-profile-email").textContent = user.email  || "";

      mobileAuth.innerHTML = `
        <p style="font-size:.8rem;color:#9ca3af;padding:.4rem .5rem 0;">
          Hola, <strong style="color:#1a2232">${user.nombre || "Usuario"}</strong>
        </p>
        <button class="da-mobile-logout" id="da-mobile-logout-btn">
          ${svg(ICONS.logout)} Cerrar Sesión
        </button>
      `;
      document.getElementById("da-mobile-logout-btn").addEventListener("click", logOut);
    } else {
      btnLogin.style.display = "";
      profileWrap.classList.remove("visible");
      mobileAuth.innerHTML = `<a href="../landing/cuenta.html" class="da-mobile-btn-login">Iniciar Sesión</a>`;
    }
  }

  function logOut() {
    sessionStorage.removeItem(SESSION_KEY);
    closeMobileMenu();
    closeProfileMenu();
    renderAuth();
    showToast("✓ Sesión cerrada correctamente");
  }

  /* ═══════════════════════════════════════════════
     8. DROPDOWN PERFIL
  ═══════════════════════════════════════════════ */
  function closeProfileMenu() {
    document.getElementById("da-profile-menu").classList.remove("open");
  }

  document.getElementById("da-profile-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("da-profile-menu").classList.toggle("open");
  });

  document.getElementById("da-logout-btn").addEventListener("click", logOut);

  document.addEventListener("click", (e) => {
    if (!document.getElementById("da-profile-wrap").contains(e.target)) {
      closeProfileMenu();
    }
  });

  /* ═══════════════════════════════════════════════
     9. MENÚ MÓVIL
  ═══════════════════════════════════════════════ */
  let mobileOpen = false;

  function closeMobileMenu() {
    mobileOpen = false;
    document.getElementById("da-mobile-menu").classList.remove("open");
    document.getElementById("da-hamburger").innerHTML = svg(ICONS.burger);
  }

  document.getElementById("da-hamburger").addEventListener("click", () => {
    mobileOpen = !mobileOpen;
    document.getElementById("da-mobile-menu").classList.toggle("open", mobileOpen);
    document.getElementById("da-hamburger").innerHTML = svg(mobileOpen ? ICONS.close : ICONS.burger);
  });

  /* ═══════════════════════════════════════════════
     10. CARRITO — API pública
     Llama window.daUpdateCart(n) desde cualquier página
     para actualizar el badge del carrito en la navbar.
     Ejemplo: window.daUpdateCart(3);
  ═══════════════════════════════════════════════ */
  window.daUpdateCart = function (count) {
    const badge = document.getElementById("da-cart-badge");
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
    sessionStorage.setItem("da_cart_count", count);
  };

  const savedCart = parseInt(sessionStorage.getItem("da_cart_count") || "0");
  if (savedCart > 0) window.daUpdateCart(savedCart);

  /* ═══════════════════════════════════════════════
     11. TOAST
  ═══════════════════════════════════════════════ */
  function showToast(msg, duration = 3000) {
    const toast = document.getElementById("da-toast");
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), duration);
  }
  window.daShowToast = showToast;

  /* ═══════════════════════════════════════════════
     12. INIT
  ═══════════════════════════════════════════════ */
  renderAuth();

})();