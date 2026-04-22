const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { env } = require('../config/env');
const { USER_ROLES } = require('../config/constants');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginSchema, registerSchema } = require('../validators/auth.validators');

const router = express.Router();

function buildTokenPayload(user) {
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    customer_id: user.customer_id,
    created_at: user.created_at ?? null,
  };
}

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { fullName, email, password, phone, eventType, consent } = req.body;
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await withTransaction(async (client) => {
      const existingUser = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
      if (existingUser.rowCount > 0) {
        return { conflict: true };
      }

      const existingCustomer = await client.query('SELECT id FROM customers WHERE email = $1 LIMIT 1', [email]);
      let customerId = existingCustomer.rows[0]?.id;

      if (!customerId) {
        const customerInsert = await client.query(
          `INSERT INTO customers (full_name, email, phone, event_type, consent_given)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [fullName, email, phone ?? null, eventType ?? null, consent]
        );

        customerId = customerInsert.rows[0].id;
      }

      const userInsert = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, customer_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, full_name, email, role, customer_id, created_at`,
        [fullName, email, passwordHash, USER_ROLES.CUSTOMER, customerId]
      );

      return {
        conflict: false,
        user: userInsert.rows[0],
      };
    });

    if (result.conflict) {
      return res.status(409).json({ message: 'Ya existe una cuenta con ese correo' });
    }

    const token = jwt.sign(buildTokenPayload(result.user), env.jwtSecret, { expiresIn: env.jwtExpiresIn });

    return res.status(201).json({
      message: 'Registro completado',
      token,
      user: result.user,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT id, full_name, email, role, customer_id, created_at, password_hash
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(buildTokenPayload(user), env.jwtSecret, { expiresIn: env.jwtExpiresIn });

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        customer_id: user.customer_id,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  return res.status(200).json({ user: req.user });
});

module.exports = router;
