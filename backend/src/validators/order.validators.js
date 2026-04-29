const { z } = require('zod');
const { ORDER_STATUSES } = require('../config/constants');

const orderItemSchema = z.object({
  designId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  personalizationData: z.record(z.string(), z.unknown()).optional(),
});

const checkoutSchema = z.object({
  customerId: z.string().uuid().optional(),
  customer: z
    .object({
      fullName: z.string().trim().min(2),
      email: z.string().trim().email(),
      phone: z.string().trim().max(20).optional(),
      eventType: z.string().trim().max(80).optional(),
      preferredStyle: z.string().trim().max(120).optional(),
      notes: z.string().trim().max(500).optional(),
      consentGiven: z.boolean().default(true),
    })
    .optional(),
  items: z.array(orderItemSchema).min(1),
  shippingPrice: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().max(500).optional(),
  paymentToken: z.string().trim().min(1).optional(),
});

const orderStatusSchema = z.object({
  status: z.enum(Object.values(ORDER_STATUSES)),
  notes: z.string().trim().max(500).optional(),
});

const orderUpdateSchema = z.object({
  status: z.enum(Object.values(ORDER_STATUSES)).optional(),
  shippingAmount: z.coerce.number().nonnegative().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

module.exports = {
  checkoutSchema,
  orderStatusSchema,
  orderUpdateSchema,
};
