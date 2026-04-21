/**
 * ═══════════════════════════════════════════════════
 * CHECKOUT - Integración con Stripe.js
 * Maneja formulario, validaciones y procesamiento de pagos
 * ═══════════════════════════════════════════════════
 */

const CHECKOUT = {
    // Configuración
    SHIPPING_OPTIONS: [
        { id: 'standard', name: 'Envío Estándar (5-7 días)', price: 50 },
        { id: 'express', name: 'Envío Express (2-3 días)', price: 150 },
        { id: 'same_day', name: 'Envío Mismo Día (CDMX)', price: 300, cities: ['CDMX'] },
    ],
    TAX_RATE: 0.16, // 16% ISR

    // Estado
    stripe: null,
    elements: null,
    cardElement: null,
    currentOrder: null,
    isProcessing: false,

    /**
     * Inicializar Stripe y formulario
     */
    async init() {
        console.log('🚀 Inicializando Checkout...');

        // Verificar autenticación
        if (!AUTH.isAuthenticated()) {
            window.location.href = '/landing/login.html?redirect=checkout.html';
            return;
        }

        // Cargar carrito desde sessión
        const cartData = this.getCartFromSession();
        if (!cartData || cartData.items.length === 0) {
            window.location.href = '/landing/carrito.html';
            return;
        }

        const publishableKey = this.getStripePublishableKey();
        if (!publishableKey) {
            this.showError('Falta configurar STRIPE_PUBLISHABLE_KEY para usar Stripe real.');
            return;
        }

        // Inicializar Stripe
        this.stripe = Stripe(publishableKey);
        this.elements = this.stripe.elements();
        this.cardElement = this.elements.create('card');
        this.cardElement.mount('#cardElement');

        // Event listeners
        this.cardElement.on('change', (event) => {
            const errorElement = document.getElementById('cardError');
            if (event.error) {
                errorElement.textContent = event.error.message;
            } else {
                errorElement.textContent = '';
            }
        });

        // Llenar formulario con datos del usuario
        this.populateFormWithUserData();

        // Renderizar opciones de envío
        this.renderShippingOptions();

        // Actualizar resumen
        this.updateOrderSummary(cartData);

        // Form submit
        document.getElementById('checkoutForm').addEventListener('submit', (e) => this.handleSubmit(e));

        // Cambio de envío
        document.querySelectorAll('input[name="shipping"]').forEach(input => {
            input.addEventListener('change', () => {
                const shipping = CHECKOUT.getSelectedShipping();
                CHECKOUT.updateOrderSummary(cartData);
            });
        });

        console.log('✅ Checkout inicializado');
    },

    getStripePublishableKey() {
        if (window.APP_CONFIG?.stripePublishableKey) {
            return window.APP_CONFIG.stripePublishableKey;
        }

        const metaKey = document.querySelector('meta[name="stripe-publishable-key"]')?.content?.trim();
        if (metaKey) {
            return metaKey;
        }

        return '';
    },

    /**
     * Obtener carrito de sessionStorage
     */
    getCartFromSession() {
        try {
            const cart = sessionStorage.getItem('_cart_data');
            if (cart) {
                return JSON.parse(cart);
            }

            const legacyCart = localStorage.getItem('da_carrito');
            if (legacyCart) {
                const items = JSON.parse(legacyCart).map((item) => ({
                    designId: item.designId || item.id,
                    quantity: item.quantity || item.cantidad || 1,
                    personalizationData: {
                        text: item.text || item.textoPersonalizado || '',
                        color: item.color || item.colorSeleccionado || '',
                    },
                    total: item.total || (Number(item.price || item.precio || 0) * Number(item.quantity || item.cantidad || 1)),
                }));

                return {
                    items,
                    subtotal: items.reduce((sum, item) => sum + item.total, 0),
                };
            }

            return null;
        } catch {
            return null;
        }
    },

    /**
     * Guardar carrito en sessionStorage (desde carrito.html)
     */
    saveCartToSession(cartData) {
        sessionStorage.setItem('_cart_data', JSON.stringify(cartData));
    },

    /**
     * Llenar formulario con datos del usuario autenticado
     */
    populateFormWithUserData() {
        const user = AUTH.getUser();
        if (user) {
            document.getElementById('fullName').value = user.full_name || '';
            document.getElementById('email').value = user.email || '';
        }
    },

    /**
     * Renderizar opciones de envío
     */
    renderShippingOptions() {
        const container = document.getElementById('shippingOptions');
        const selectedCity = document.getElementById('city').value;

        this.SHIPPING_OPTIONS.forEach((option, idx) => {
            // Validar disponibilidad por ciudad
            if (option.cities && !option.cities.includes(selectedCity)) {
                return;
            }

            const div = document.createElement('div');
            div.className = 'shipping-option';
            if (idx === 0) div.classList.add('selected');

            div.innerHTML = `
                <input type="radio" name="shipping" value="${option.id}" ${idx === 0 ? 'checked' : ''} data-price="${option.price}">
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${option.name}</div>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">$${option.price.toFixed(2)}</div>
                </div>
            `;

            div.addEventListener('click', () => {
                document.querySelectorAll('.shipping-option').forEach(el => el.classList.remove('selected'));
                div.classList.add('selected');
                div.querySelector('input').checked = true;
            });

            container.appendChild(div);
        });
    },

    /**
     * Obtener opción de envío seleccionada
     */
    getSelectedShipping() {
        const selected = document.querySelector('input[name="shipping"]:checked');
        if (!selected) return this.SHIPPING_OPTIONS[0];

        const option = this.SHIPPING_OPTIONS.find(o => o.id === selected.value);
        return option || this.SHIPPING_OPTIONS[0];
    },

    /**
     * Actuar cuando cambia la ciudad (validar envío)
     */
    onCityChange() {
        const currentShipping = this.getSelectedShipping();
        const newCity = document.getElementById('city').value;

        // Si envío actual no está disponible en nueva ciudad, cambiar
        if (currentShipping.cities && !currentShipping.cities.includes(newCity)) {
            document.getElementById('shippingOptions').innerHTML = '';
            this.renderShippingOptions();
        }
    },

    /**
     * Actualizar resumen de orden
     */
    updateOrderSummary(cartData) {
        if (!cartData) return;

        const itemCount = cartData.items.length;
        const subtotal = cartData.items.reduce((sum, item) => sum + item.total, 0);
        const shipping = this.getSelectedShipping();
        const shippingCost = shipping.price;
        const tax = (subtotal + shippingCost) * this.TAX_RATE;
        const total = subtotal + shippingCost + tax;

        document.getElementById('itemCount').textContent = itemCount;
        document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('shippingCost').textContent = `$${shippingCost.toFixed(2)}`;
        document.getElementById('taxCost').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('totalAmount').textContent = `$${total.toFixed(2)}`;

        this.currentOrderTotal = total;
        this.currentCartData = cartData;
    },

    /**
     * Validar formulario
     */
    validateForm() {
        const errors = {};

        // Validar email
        const email = document.getElementById('email').value;
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            errors.email = 'Email inválido';
        }

        // Validar código postal (México)
        const zipCode = document.getElementById('zipCode').value;
        if (!zipCode.match(/^[0-9]{5}$/)) {
            errors.zipCode = 'Código postal debe ser 5 dígitos';
        }

        // Mostrar errores
        document.querySelectorAll('[id$="Error"]').forEach(el => {
            el.textContent = '';
        });

        Object.keys(errors).forEach(field => {
            const errorEl = document.getElementById(`${field}Error`);
            if (errorEl) errorEl.textContent = errors[field];
        });

        return Object.keys(errors).length === 0;
    },

    /**
     * Manejar envío del formulario
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.isProcessing) return;

        if (!this.validateForm()) {
            this.showError('Por favor corrige los errores del formulario');
            return;
        }

        this.isProcessing = true;
        document.getElementById('submitBtn').disabled = true;
        document.getElementById('submitText').style.display = 'none';
        document.getElementById('submitSpinner').style.display = 'inline';

        try {
            // 1. Crear PaymentIntent en backend
            console.log('💳 Creando PaymentIntent...');
            const paymentIntentResult = await this.createPaymentIntent();

            if (!paymentIntentResult.clientSecret) {
                throw new Error('No se pudo crear PaymentIntent');
            }

            // 2. Confirmar pago con Stripe.js
            console.log('🔐 Confirmando pago con Stripe...');
            const { paymentIntent, error } = await this.stripe.confirmCardPayment(
                paymentIntentResult.clientSecret,
                {
                    payment_method: {
                        card: this.cardElement,
                        billing_details: {
                            name: document.getElementById('fullName').value,
                            email: document.getElementById('email').value,
                        },
                    },
                }
            );

            if (error) {
                throw new Error(error.message);
            }

            if (paymentIntent.status === 'succeeded') {
                console.log('✅ Pago exitoso');
                this.showSuccess(this.currentOrder);
            } else {
                throw new Error(`Estado de pago: ${paymentIntent.status}`);
            }

        } catch (error) {
            console.error('❌ Error en checkout:', error);
            this.showError(error.message);
        } finally {
            this.isProcessing = false;
            document.getElementById('submitBtn').disabled = false;
            document.getElementById('submitText').style.display = 'inline';
            document.getElementById('submitSpinner').style.display = 'none';
        }
    },

    /**
     * Crear PaymentIntent en backend
     */
    async createPaymentIntent() {
        const formData = {
            customer: {
                fullName: document.getElementById('fullName').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value || null,
                eventType: document.getElementById('eventType').value || null,
            },
            shippingAddress: {
                street: document.getElementById('address').value,
                city: document.getElementById('city').value,
                state: document.getElementById('state').value,
                zipCode: document.getElementById('zipCode').value,
                country: 'México',
            },
            items: this.currentCartData.items,
            shippingPrice: this.getSelectedShipping().price,
            shippingMethod: this.getSelectedShipping().id,
            notes: 'Pedido desde tienda online',
        };

        const response = await fetch(`${AUTH.API_BASE}/orders/checkout`, {
            method: 'POST',
            headers: AUTH.getHeaders(),
            body: JSON.stringify(formData),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al crear orden');
        }

        const result = await response.json();
        this.currentOrder = result.data;
        return result.data.paymentIntent;
    },

    /**
     * Mostrar error
     */
    showError(message) {
        const alertEl = document.getElementById('errorAlert');
        alertEl.textContent = message;
        alertEl.classList.add('show');
        window.scrollTo(0, 0);
    },

    /**
     * Mostrar éxito
     */
    showSuccess(orderData) {
        document.getElementById('checkoutForm').style.display = 'none';
        document.getElementById('successState').classList.add('show');
        document.getElementById('successOrderCode').textContent = orderData.order_code;

        // Limpiar sesión
        sessionStorage.removeItem('_cart_data');

        // Scroll al top
        window.scrollTo(0, 0);
    },
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => CHECKOUT.init());

// Cambio de ciudad
document.getElementById('city')?.addEventListener('change', () => CHECKOUT.onCityChange());
