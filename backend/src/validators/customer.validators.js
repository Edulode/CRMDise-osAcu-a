const { z } = require('zod');

const customerCreateSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  eventType: z.string().trim().max(80).optional(),
  preferredStyle: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  consentGiven: z.boolean().default(true),
});

const customerUpdateSchema = customerCreateSchema.partial();

module.exports = {
  customerCreateSchema,
  customerUpdateSchema,
};
