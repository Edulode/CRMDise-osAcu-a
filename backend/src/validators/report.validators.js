const { z } = require('zod');

const reportQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  format: z.enum(['json', 'csv', 'pdf']).default('json'),
});

module.exports = {
  reportQuerySchema,
};
