/**
 * ═══════════════════════════════════════════════════
 * SISTEMA CENTRALIZADO DE AUTENTICACIÓN
 * Maneja JWT, persistencia, headers y validación de sesión
 * ═══════════════════════════════════════════════════
 */

const AUTH = {
    API_BASE: 'http://localhost:4000/api',
    TOKEN_KEY: 'da_token',
    USER_KEY: 'da_user',
    
    /**
     * Guardar token en localStorage
     */
    setToken(token) {
        if (!token) {
            localStorage.removeItem(this.TOKEN_KEY);
            return;
        }
        localStorage.setItem(this.TOKEN_KEY, token);
    },

    /**
     * Recuperar token JWT actual
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY) || null;
    },

    /**
     * Guardar datos del usuario
     */
    setUser(user) {
        if (!user) {
            localStorage.removeItem(this.USER_KEY);
            return;
        }
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    /**
     * Recuperar datos del usuario autenticado
     */
    getUser() {
        try {
            return JSON.parse(localStorage.getItem(this.USER_KEY)) || null;
        } catch {
            return null;
        }
    },

    normalizeUser(user) {
        if (!user) {
            return null;
        }

        return {
            id: user.id ?? null,
            full_name: user.full_name ?? user.fullName ?? user.name ?? 'Usuario',
            email: user.email ?? '',
            role: user.role ?? 'customer',
            customer_id: user.customer_id ?? user.customerId ?? null,
            created_at: user.created_at ?? null,
        };
    },

    /**
     * Verificar si usuario está autenticado
     */
    isAuthenticated() {
        return !!this.getToken() && !!this.getUser();
    },

    /**
     * Obtener rol del usuario
     */
    getRole() {
        const user = this.getUser();
        return user?.role || null;
    },

    /**
     * Construir headers con autorización
     */
    getHeaders() {
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    /**
     * Petición autenticada genérica
     */
    async fetchAuth(endpoint, options = {}) {
        const url = `${this.API_BASE}${endpoint}`;
        const config = {
            ...options,
            headers: this.getHeaders(),
        };

        const response = await fetch(url, config);
        
        // Si retorna 401, significa token expirado o inválido
        if (response.status === 401) {
            this.logout();
            window.location.href = '/landing/login.html';
            return null;
        }

        return response;
    },

    /**
     * REGISTRO - POST /auth/register
     */
    async register(email, password, fullName, phone = null) {
        const payload = {
            email,
            password,
            fullName,
            consent: true,
        };

        // El backend espera string u omisión (null causa Validation error).
        if (typeof phone === 'string' && phone.trim()) {
            payload.phone = phone.trim();
        }

        const response = await fetch(`${this.API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al registrarse');
        }

        const result = await response.json();
        
        // Guardar token y usuario
        this.setToken(result.token);
        this.setUser(this.normalizeUser(result.user));

        return result;
    },

    /**
     * LOGIN - POST /auth/login
     */
    async login(email, password) {
        const response = await fetch(`${this.API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Credenciales incorrectas');
        }

        const result = await response.json();
        
        // Guardar token y usuario
        this.setToken(result.token);
        this.setUser(this.normalizeUser(result.user));

        return result;
    },

    /**
     * LOGOUT - Limpiar sesión
     */
    logout() {
        this.setToken(null);
        this.setUser(null);
        localStorage.removeItem('da_carrito');
        sessionStorage.clear();
    },

    /**
     * Protejer ruta privada
     * Si no hay autenticación, redirige a login
     */
    ensureAuthenticated(requiredRole = null) {
        if (!this.isAuthenticated()) {
            window.location.href = '/landing/login.html';
            return false;
        }

        if (requiredRole) {
            const userRole = this.getRole();
            if (userRole !== requiredRole) {
                window.location.href = '/landing/index.html';
                return false;
            }
        }

        return true;
    },

    /**
     * Proteger ruta si ya está autenticado
     * (para no permitir acceder a login/register si ya está logueado)
     */
    ensureNotAuthenticated() {
        if (this.isAuthenticated()) {
            const user = this.getUser();
            // Determinar a dónde redirigir según el rol
            if (user?.role === 'admin' || user?.role === 'employee') {
                window.location.href = '/panelAdmin/index.html';
            } else {
                window.location.href = '/landing/index.html';
            }
            return false;
        }
        return true;
    },

    /**
     * Decodificar payload de JWT (sin verificar firma)
     * Útil para obtener información del token
     */
    decodeToken(token) {
        try {
            const part = token.split('.')[1];
            const decoded = atob(part);
            return JSON.parse(decoded);
        } catch {
            return null;
        }
    },

    /**
     * Verificar si token está próximo a expirar
     */
    isTokenExpiringSoon(bufferMinutes = 5) {
        const token = this.getToken();
        if (!token) return true;

        const payload = this.decodeToken(token);
        if (!payload?.exp) return true;

        const now = Math.floor(Date.now() / 1000);
        const bufferSeconds = bufferMinutes * 60;
        
        return payload.exp - now < bufferSeconds;
    },
};

// Exportar para uso en módulos (si aplica)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AUTH;
}
