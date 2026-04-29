/**
 * ═══════════════════════════════════════════════════
 * SISTEMA CENTRALIZADO DE AUTENTICACIÓN
 * Maneja JWT, persistencia, headers y validación de sesión
 * ═══════════════════════════════════════════════════
 */

const AUTH = {
    API_BASE: '/api',
    TOKEN_KEY: 'da_token',
    REFRESH_TOKEN_KEY: 'da_refresh_token',
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

    setRefreshToken(token) {
        if (!token) {
            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
            return;
        }
        localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
    },

    /**
     * Recuperar token JWT actual
     */
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY) || null;
    },

    getRefreshToken() {
        return localStorage.getItem(this.REFRESH_TOKEN_KEY) || null;
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

    clearSession() {
        const localKeys = [];
        const sessionKeys = [];

        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (key) {
                localKeys.push(key);
            }
        }

        for (let index = 0; index < sessionStorage.length; index += 1) {
            const key = sessionStorage.key(index);
            if (key) {
                sessionKeys.push(key);
            }
        }

        localKeys.forEach((key) => {
            if (key.startsWith('da_') || key === this.TOKEN_KEY || key === this.REFRESH_TOKEN_KEY || key === this.USER_KEY) {
                localStorage.removeItem(key);
            }
        });

        sessionKeys.forEach((key) => {
            if (key.startsWith('da_') || key === '_cart_data') {
                sessionStorage.removeItem(key);
            }
        });

        localStorage.removeItem('da_carrito');
    },

    isTokenExpired() {
        const token = this.getToken();
        if (!token) {
            return false;
        }

        const payload = this.decodeToken(token);
        if (!payload?.exp) {
            return true;
        }

        const now = Math.floor(Date.now() / 1000);
        return payload.exp <= now;
    },

    getLoginRedirectPath(preferredPath = null) {
        if (preferredPath && typeof preferredPath === 'string') {
            return preferredPath;
        }

        const currentPath = window.location.pathname || '';
        if (currentPath.includes('/panelAdmin/')) {
            return '/panelAdmin/login.html';
        }

        return '/landing/login.html';
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

        if (response.status === 401 && this.getRefreshToken()) {
            const renewed = await this.refreshSession();
            if (renewed) {
                const retry = await fetch(url, {
                    ...options,
                    headers: this.getHeaders(),
                });

                if (retry.status !== 401) {
                    return retry;
                }
            }
        }

        // Si retorna 401, significa token expirado, inválido o sesión revocada
        if (response.status === 401) {
            this.logout();
            return null;
        }

        return response;
    },

    async refreshSession() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            return false;
        }

        try {
            const response = await fetch(`${this.API_BASE}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            this.setToken(result.token);
            this.setRefreshToken(result.refreshToken);
            this.setUser(this.normalizeUser(result.user));
            return true;
        } catch {
            return false;
        }
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
        this.setRefreshToken(result.refreshToken);
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
        this.setRefreshToken(result.refreshToken);
        this.setUser(this.normalizeUser(result.user));

        return result;
    },

    /**
     * LOGOUT - Limpiar sesión
     */
    logout(preferredPath = null) {
        const refreshToken = this.getRefreshToken();
        const accessToken = this.getToken();

        if (accessToken) {
            fetch(`${this.API_BASE}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ refreshToken }),
            }).catch(() => null);
        }

        this.clearSession();

        const targetPath = this.getLoginRedirectPath(preferredPath);
        const currentPath = window.location.pathname || '';
        if (currentPath !== targetPath) {
            window.location.href = targetPath;
        }
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
            if (user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'colaborador') {
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
            const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
            const decoded = atob(padded);
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
