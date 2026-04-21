const Stripe = require('stripe');
const { env } = require('../config/env');

const stripe = env.stripeSecretKey ? new Stripe(env.stripeSecretKey) : null;

async function createPaymentIntent({ amount, currency = 'mxn', metadata = {} }) {
  if (!stripe) {
    return {
      provider: 'mock',
      status: 'pending',
      amount,
      currency,
      metadata,
    };
  }

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount),
    currency,
    automatic_payment_methods: { enabled: true },
    metadata,
  });

  return {
    provider: 'stripe',
    status: intent.status,
    clientSecret: intent.client_secret,
    id: intent.id,
  };
}

module.exports = {
  createPaymentIntent,
};
