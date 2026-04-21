/**
 * route-protection.js — Protección de rutas basada en autenticación
 * 
 * Uso en admin pages:
 *   <script src="../src/js/route-protection.js" data-require="admin"></script>
 * 
 * Uso en customer pages:
 *   <script src="../src/js/route-protection.js" data-require="customer"></script>
 */

(function() {
  // Obtener requisito de autenticación del atributo
  const requiredRole = document.currentScript?.dataset.require;
  
  // No hacer nada si no hay requisito especificado
  if (!requiredRole) return;

  // Esperar a que auth.js esté disponible
  function checkAuth() {
    if (typeof AUTH === 'undefined') {
      // Reintentar en 100ms
      setTimeout(checkAuth, 100);
      return;
    }

    // Validar autenticación y rol
    const isAuthenticated = AUTH.isAuthenticated();
    const user = AUTH.getUser();

    if (!isAuthenticated) {
      // No autenticado - redirigir a login
      const loginPage = requiredRole === 'admin' 
        ? './login.html' 
        : '../landing/login.html';
      window.location.href = loginPage;
      return;
    }

    if (requiredRole === 'admin' && user?.role !== 'admin') {
      // No es admin - redirigir a home
      window.location.href = '../landing/index.html';
      return;
    }

    // Autenticación válida
    console.log(`✓ Acceso autorizado para ${requiredRole}`);
  }

  // Ejecutar cuando el documento esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
  } else {
    checkAuth();
  }
})();
