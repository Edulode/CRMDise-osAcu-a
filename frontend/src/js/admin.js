/**
 * admin.js - Módulo General para Panel Admin
 * Contiene funciones compartidas, configuración y utilidades
 */

// Configuración
const ADMIN_CONFIG = {
    API_BASE: 'http://localhost:4000/api',
    TOAST_DURATION: 3000,
    DEBOUNCE_DELAY: 300,
};

// Estado Global del Admin
const AdminState = {
    currentUser: null,
    notifications: [],
    filters: {},
    
    init() {
        this.currentUser = AUTH?.getUser?.() || null;
    },
    
    isAdmin() {
        return this.currentUser?.role === 'admin';
    }
};

// Utilidades de Inicialización
const AdminInit = {
    // Verificar autenticación de admin
    checkAuth() {
        if (!AUTH || !AUTH.isAuthenticated()) {
            window.location.href = './login.html';
            return false;
        }
        
        const user = AUTH.getUser?.();
        if (user?.role !== 'admin' && user?.role !== 'editor' && user?.role !== 'collaborator') {
            window.location.href = './login.html';
            return false;
        }
        
        return true;
    },
    
    // Setup sidebar navigation
    setupNavigation() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                AUTH.logout?.();
                window.location.href = './login.html';
            });
        }
    },
    
    // Setup refresh button
    setupRefresh(callback) {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                refreshBtn.disabled = true;
                callback?.().finally(() => {
                    refreshBtn.disabled = false;
                });
            });
        }
    }
};

// Utilidades de API
const AdminAPI = {
    async fetch(endpoint, options = {}) {
        const url = `${ADMIN_CONFIG.API_BASE}${endpoint}`;
        const headers = {...AUTH.getHeaders(), 'Content-Type': 'application/json'};
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {...headers, ...options.headers}
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },
    
    // GET /api/orders
    async getOrders() {
        return this.fetch('/orders');
    },
    
    // GET /api/orders/:id
    async getOrder(id) {
        return this.fetch(`/orders/${id}`);
    },
    
    // PATCH /api/orders/:id/status
    async updateOrderStatus(id, status) {
        return this.fetch(`/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({status})
        });
    },
    
    // GET /api/designs
    async getDesigns() {
        return this.fetch('/designs');
    },
    
    // POST /api/designs
    async createDesign(data) {
        return this.fetch('/designs', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    // PUT /api/designs/:id
    async updateDesign(id, data) {
        return this.fetch(`/designs/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    // DELETE /api/designs/:id
    async deleteDesign(id) {
        return this.fetch(`/designs/${id}`, {method: 'DELETE'});
    },
    
    // GET /api/customers
    async getCustomers() {
        return this.fetch('/customers');
    },
    
    // GET /api/reports/summary
    async getReportsSummary() {
        return this.fetch('/reports/summary');
    }
};

// Utilidades de UI
const AdminUI = {
    // Toast notification
    toast(message, type = 'info', duration = ADMIN_CONFIG.TOAST_DURATION) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },
    
    // Format currency
    formatCurrency(amount) {
        return '$' + Number(amount).toLocaleString('es-MX', {minimumFractionDigits: 2});
    },
    
    // Format date
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },
    
    // Status badge HTML
    getStatusBadge(status) {
        const statusMap = {
            'pending': {label: 'Pendiente', class: 'status-pending'},
            'paid': {label: 'Pagado', class: 'status-paid'},
            'in_production': {label: 'Producción', class: 'status-production'},
            'shipped': {label: 'Enviado', class: 'status-shipped'},
            'completed': {label: 'Completado', class: 'status-completed'},
            'canceled': {label: 'Cancelado', class: 'status-pending'}
        };
        
        const info = statusMap[status] || {label: status, class: 'status-pending'};
        return `<span class="status-badge ${info.class}">${info.label}</span>`;
    }
};

// Debounce helper
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

// Inicializar al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
    AdminState.init();
    AdminInit.checkAuth();
    AdminInit.setupNavigation();
});

// Inyectar estilos de animación
if (!document.querySelector('style[data-admin-animations]')) {
    const style = document.createElement('style');
    style.setAttribute('data-admin-animations', 'true');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
