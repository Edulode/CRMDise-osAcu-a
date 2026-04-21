const express = require('express');
const { pool } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function resolveCategoryId(client, categoryId) {
  if (categoryId) {
    const result = await client.query('SELECT id FROM categories WHERE id = $1 LIMIT 1', [categoryId]);
    if (result.rowCount > 0) {
      return result.rows[0].id;
    }
  }

  const fallback = await client.query('SELECT id FROM categories WHERE active = true ORDER BY created_at ASC LIMIT 1');
  if (fallback.rowCount === 0) {
    const error = new Error('No hay categorías disponibles para asignar al diseño');
    error.statusCode = 400;
    throw error;
  }

  return fallback.rows[0].id;
}

router.get('/', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.slug, d.description, d.base_price, d.personalization_price,
              d.image_url, d.preview_url, d.active, d.featured,
              c.id AS category_id, c.name AS category_name,
              COALESCE(i.stock, 0) AS stock, COALESCE(i.reserved, 0) AS reserved
       FROM designs d
       INNER JOIN categories c ON c.id = d.category_id
       LEFT JOIN inventory i ON i.design_id = d.id
       ORDER BY d.created_at DESC`
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR), async (req, res, next) => {
  try {
    const payload = req.body || {};
    if (!payload.name || Number(payload.base_price ?? payload.price ?? 0) < 0) {
      return res.status(400).json({ message: 'name y price/base_price son obligatorios' });
    }

    const created = await withTransaction(async (client) => {
      const categoryId = await resolveCategoryId(client, payload.category_id || payload.categoryId || null);
      const basePrice = Number(payload.base_price ?? payload.price ?? 0);
      const personalizationPrice = Number(payload.personalization_price ?? 0);
      const stock = Number(payload.stock ?? 0);
      const slugBase = slugify(payload.slug || payload.name) || `design-${Date.now()}`;

      const insertDesign = await client.query(
        `INSERT INTO designs (
            category_id, name, slug, description, base_price, personalization_price,
            image_url, preview_url, tags, featured, active
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id, name, slug, description, base_price, personalization_price,
                   image_url, preview_url, active, featured, category_id`,
        [
          categoryId,
          payload.name,
          `${slugBase}-${Date.now()}`,
          payload.description ?? null,
          basePrice,
          personalizationPrice,
          payload.image_url ?? payload.imageUrl ?? null,
          payload.preview_url ?? payload.previewUrl ?? null,
          Array.isArray(payload.tags) ? payload.tags : [],
          Boolean(payload.featured),
          payload.active === undefined ? true : Boolean(payload.active),
        ]
      );

      await client.query(
        `INSERT INTO inventory (design_id, stock, reserved, updated_at)
         VALUES ($1, $2, 0, NOW())
         ON CONFLICT (design_id)
         DO UPDATE SET stock = EXCLUDED.stock, updated_at = NOW()`,
        [insertDesign.rows[0].id, Math.max(0, stock)]
      );

      return insertDesign.rows[0];
    });

    return res.status(201).json({ data: created });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR), async (req, res, next) => {
  try {
    const payload = req.body || {};

    const updated = await withTransaction(async (client) => {
      const existing = await client.query('SELECT id, category_id FROM designs WHERE id = $1 LIMIT 1', [req.params.id]);
      if (existing.rowCount === 0) {
        const error = new Error('Diseño no encontrado');
        error.statusCode = 404;
        throw error;
      }

      const categoryId = await resolveCategoryId(client, payload.category_id || payload.categoryId || existing.rows[0].category_id);
      const basePrice = payload.base_price !== undefined || payload.price !== undefined
        ? Number(payload.base_price ?? payload.price)
        : null;
      const personalizationPrice = payload.personalization_price !== undefined
        ? Number(payload.personalization_price)
        : null;

      const result = await client.query(
        `UPDATE designs
         SET category_id = $1,
             name = COALESCE($2, name),
             description = COALESCE($3, description),
             base_price = COALESCE($4, base_price),
             personalization_price = COALESCE($5, personalization_price),
             image_url = COALESCE($6, image_url),
             preview_url = COALESCE($7, preview_url),
             featured = COALESCE($8, featured),
             active = COALESCE($9, active),
             updated_at = NOW()
         WHERE id = $10
         RETURNING id, name, slug, description, base_price, personalization_price,
                   image_url, preview_url, active, featured, category_id`,
        [
          categoryId,
          payload.name ?? null,
          payload.description ?? null,
          basePrice,
          personalizationPrice,
          payload.image_url ?? payload.imageUrl ?? null,
          payload.preview_url ?? payload.previewUrl ?? null,
          payload.featured,
          payload.active,
          req.params.id,
        ]
      );

      if (payload.stock !== undefined) {
        await client.query(
          `INSERT INTO inventory (design_id, stock, reserved, updated_at)
           VALUES ($1, $2, 0, NOW())
           ON CONFLICT (design_id)
           DO UPDATE SET stock = $2, updated_at = NOW()`,
          [req.params.id, Math.max(0, Number(payload.stock) || 0)]
        );
      }

      return result.rows[0];
    });

    return res.status(200).json({ data: updated });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', authenticateToken, requireRole(USER_ROLES.ADMIN), async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE designs
       SET active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Diseño no encontrado' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;