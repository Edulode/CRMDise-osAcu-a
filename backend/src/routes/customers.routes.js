const express = require('express');
const { pool } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { USER_ROLES } = require('../config/constants');
const { customerCreateSchema, customerUpdateSchema } = require('../validators/customer.validators');

const router = express.Router();

router.get(
  '/',
  authenticateToken,
  requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR),
  async (req, res, next) => {
    try {
      const search = String(req.query.q ?? '').trim();
      const values = [];
      const conditions = ['1 = 1'];

      if (search) {
        values.push(`%${search}%`);
        conditions.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length})`);
      }

      const result = await pool.query(
        `SELECT id, full_name, email, phone, event_type, preferred_style, notes, consent_given, created_at
         FROM customers
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC`,
        values
      );

      return res.status(200).json({ data: result.rows });
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  '/',
  authenticateToken,
  requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR),
  validate(customerCreateSchema),
  async (req, res, next) => {
    try {
      const customer = await withTransaction(async (client) => {
        const result = await client.query(
          `INSERT INTO customers (full_name, email, phone, event_type, preferred_style, notes, consent_given)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, full_name, email, phone, event_type, preferred_style, notes, consent_given, created_at`,
          [
            req.body.fullName,
            req.body.email,
            req.body.phone ?? null,
            req.body.eventType ?? null,
            req.body.preferredStyle ?? null,
            req.body.notes ?? null,
            req.body.consentGiven,
          ]
        );

        return result.rows[0];
      });

      return res.status(201).json({ data: customer });
    } catch (error) {
      return next(error);
    }
  }
);

router.get('/:id', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, event_type, preferred_style, notes, consent_given, created_at, updated_at
       FROM customers
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), validate(customerUpdateSchema), async (req, res, next) => {
  try {
    const current = await pool.query('SELECT * FROM customers WHERE id = $1 LIMIT 1', [req.params.id]);
    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }

    const customer = await withTransaction(async (client) => {
      const data = current.rows[0];
      const updated = {
        fullName: req.body.fullName ?? data.full_name,
        email: req.body.email ?? data.email,
        phone: req.body.phone ?? data.phone,
        eventType: req.body.eventType ?? data.event_type,
        preferredStyle: req.body.preferredStyle ?? data.preferred_style,
        notes: req.body.notes ?? data.notes,
        consentGiven: req.body.consentGiven ?? data.consent_given,
      };

      const result = await client.query(
        `UPDATE customers
         SET full_name = $1, email = $2, phone = $3, event_type = $4, preferred_style = $5, notes = $6, consent_given = $7, updated_at = NOW()
         WHERE id = $8
         RETURNING id, full_name, email, phone, event_type, preferred_style, notes, consent_given, created_at, updated_at`,
        [updated.fullName, updated.email, updated.phone, updated.eventType, updated.preferredStyle, updated.notes, updated.consentGiven, req.params.id]
      );

      return result.rows[0];
    });

    return res.status(200).json({ data: customer });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
