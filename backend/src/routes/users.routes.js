const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { USER_ROLES } = require('../config/constants');
const { userCreateSchema, userUpdateSchema } = require('../validators/user.validators');

const router = express.Router();

function isBooleanQuery(value) {
  return value === 'true' || value === 'false';
}

router.get('/', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR), async (req, res, next) => {
  try {
    const search = String(req.query.q ?? '').trim();
    const role = String(req.query.role ?? '').trim();
    const active = String(req.query.active ?? '').trim().toLowerCase();
    const values = [];
    const conditions = ['role <> $1'];
    values.push(USER_ROLES.CUSTOMER);

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length})`);
    }

    if ([USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR].includes(role)) {
      values.push(role);
      conditions.push(`role = $${values.length}`);
    }

    if (isBooleanQuery(active)) {
      values.push(active === 'true');
      conditions.push(`active = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT id, full_name, email, role, active, created_at, updated_at
       FROM users
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      values
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticateToken, requireRole(USER_ROLES.ADMIN), validate(userCreateSchema), async (req, res, next) => {
  try {
    const passwordHash = await bcrypt.hash(req.body.password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, active, customer_id)
       VALUES ($1, $2, $3, $4, $5, NULL)
       RETURNING id, full_name, email, role, active, created_at`,
      [req.body.fullName, req.body.email, passwordHash, req.body.role, req.body.active]
    );

    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.put('/:id', authenticateToken, requireRole(USER_ROLES.ADMIN), validate(userUpdateSchema), async (req, res, next) => {
  try {
    const current = await pool.query(
      `SELECT id, full_name, email, role, active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const existing = current.rows[0];
    if (existing.role === USER_ROLES.CUSTOMER) {
      return res.status(400).json({ message: 'Este endpoint solo administra usuarios internos' });
    }

    const nextRole = req.body.role ?? existing.role;
    const nextActive = req.body.active ?? existing.active;

    if (req.user.sub === existing.id && nextRole !== USER_ROLES.ADMIN) {
      return res.status(409).json({ message: 'No puedes cambiar tu propio rol de administrador' });
    }

    if (req.user.sub === existing.id && !nextActive) {
      return res.status(409).json({ message: 'No puedes desactivar tu propia cuenta' });
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           email = $2,
           role = $3,
           active = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, full_name, email, role, active, created_at, updated_at`,
      [req.body.fullName ?? existing.full_name, req.body.email ?? existing.email, nextRole, nextActive, existing.id]
    );

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', authenticateToken, requireRole(USER_ROLES.ADMIN), async (req, res, next) => {
  try {
    const current = await pool.query(
      `SELECT id, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const existing = current.rows[0];
    if (existing.role === USER_ROLES.CUSTOMER) {
      return res.status(400).json({ message: 'Este endpoint solo administra usuarios internos' });
    }

    if (req.user.sub === existing.id) {
      return res.status(409).json({ message: 'No puedes eliminar tu propia cuenta' });
    }

    const result = await pool.query(
      `DELETE FROM users
       WHERE id = $1
       RETURNING id, full_name, email, role`,
      [existing.id]
    );

    return res.status(200).json({ data: result.rows[0], message: 'Usuario eliminado correctamente' });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
