const { z } = require('zod');

function optionalNumber() {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    return Number(value);
  }, z.number().nonnegative().optional());
}

function paginationNumber(defaultValue, min, max) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    return Number(value);
  }, z.number().int().min(min).max(max));
}

const catalogQuerySchema = z.object({
  category: z.string().trim().optional(),
  maxPrice: optionalNumber(),
  q: z.string().trim().optional(),
  page: paginationNumber(1, 1, 100000),
  limit: paginationNumber(20, 1, 100),
});

module.exports = {
  catalogQuerySchema,
};
