window.APP_CONFIG = {
    stripePublishableKey: document.querySelector('meta[name="stripe-publishable-key"]')?.content?.trim() || '',
};