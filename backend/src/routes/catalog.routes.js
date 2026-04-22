const express = require('express');
const { pool } = require('../db/pool');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { catalogQuerySchema } = require('../validators/catalog.validators');

const router = express.Router();

router.get('/categories', optionalAuth, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, description, active
       FROM categories
       WHERE active = true
       ORDER BY name ASC`
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/designs', optionalAuth, validate(catalogQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { category, maxPrice, q, page, limit } = req.query;
    const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;
    const safeMaxPrice = Number.isFinite(Number(maxPrice)) ? Number(maxPrice) : null;
    const values = [];
    const conditions = ['d.active = true'];

    if (category) {
      values.push(category);
      conditions.push(`c.slug = $${values.length}`);
    }

    if (safeMaxPrice !== null) {
      values.push(safeMaxPrice);
      conditions.push(`d.base_price <= $${values.length}`);
    }

    if (q) {
      values.push(`%${q}%`);
      conditions.push(`(d.name ILIKE $${values.length} OR d.description ILIKE $${values.length})`);
    }

    const offset = (safePage - 1) * safeLimit;
    values.push(safeLimit, offset);

    const query = `
      SELECT d.id, d.name, d.slug, d.description, d.base_price, d.personalization_price, d.image_url,
             d.preview_url, d.tags, c.name AS category_name, c.slug AS category_slug, i.stock, i.reserved
      FROM designs d
      INNER JOIN categories c ON c.id = d.category_id
      LEFT JOIN inventory i ON i.design_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY d.featured DESC, d.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;

    const result = await pool.query(query, values);

    return res.status(200).json({
      data: result.rows,
      pagination: {
        page: safePage,
        limit: safeLimit,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/designs/:id', optionalAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.slug, d.description, d.base_price, d.personalization_price, d.image_url,
              d.preview_url, d.tags, d.metadata, c.name AS category_name, c.slug AS category_slug
       FROM designs d
       INNER JOIN categories c ON c.id = d.category_id
       WHERE d.id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Diseño no encontrado' });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/suggestions', optionalAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      return res.status(200).json({ data: [] });
    }

    const result = await pool.query(
      `SELECT id, name, slug, preview_url
       FROM designs
       WHERE active = true AND name ILIKE $1
       ORDER BY featured DESC, name ASC
       LIMIT 10`,
      [`%${q}%`]
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
