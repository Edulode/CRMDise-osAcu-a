function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function calculateOrderTotals({ basePrice, personalizationPrice = 0, shippingPrice = 0, quantity = 1 }) {
  const safeQuantity = Math.max(1, toNumber(quantity, 1));
  const safeBasePrice = toNumber(basePrice);
  const safePersonalization = toNumber(personalizationPrice);
  const safeShipping = toNumber(shippingPrice);
  const unitPrice = safeBasePrice + safePersonalization;
  const subtotal = unitPrice * safeQuantity;
  const total = subtotal + safeShipping;

  return {
    quantity: safeQuantity,
    basePrice: safeBasePrice,
    personalizationPrice: safePersonalization,
    shippingPrice: safeShipping,
    unitPrice,
    subtotal,
    total,
  };
}

module.exports = {
  calculateOrderTotals,
};
