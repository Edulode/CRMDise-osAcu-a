const USER_ROLES = Object.freeze({
  ADMIN: 'admin',
  EDITOR: 'editor',
  COLLABORATOR: 'collaborator',
  CUSTOMER: 'customer',
});

const ORDER_STATUSES = Object.freeze({
  PENDING: 'pending',
  PAID: 'paid',
  IN_PRODUCTION: 'in_production',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
});

const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  REFUNDED: 'refunded',
});

module.exports = {
  USER_ROLES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
};
