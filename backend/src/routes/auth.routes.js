const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { env } = require('../config/env');
const { USER_ROLES } = require('../config/constants');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { loginSchema, registerSchema, changePasswordSchema } = require('../validators/auth.validators');
const { sendEmail, isEmailEnabled } = require('../services/notification.service');

const router = express.Router();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || null;
}

async function logSecurityEvent({ userId = null, email = null, action, status, req, metadata = {} }) {
  try {
    await pool.query(
      `INSERT INTO security_audit_logs (user_id, email, action, status, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        email,
        action,
        status,
        getClientIp(req),
        req.headers['user-agent'] ?? null,
        metadata,
      ]
    );
  } catch (_error) {
    // If audit logging fails, do not block auth flow.
  }
}

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

    await logSecurityEvent({
      userId: result.user.id,
      email: result.user.email,
      action: 'register',
      status: 'success',
      req,
      metadata: { role: result.user.role },
    });

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
      await logSecurityEvent({
        email,
        action: 'login',
        status: 'failed',
        req,
        metadata: { reason: 'user_not_found' },
      });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      await logSecurityEvent({
        userId: user.id,
        email: user.email,
        action: 'login',
        status: 'failed',
        req,
        metadata: { reason: 'invalid_password' },
      });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(buildTokenPayload(user), env.jwtSecret, { expiresIn: env.jwtExpiresIn });

    await logSecurityEvent({
      userId: user.id,
      email: user.email,
      action: 'login',
      status: 'success',
      req,
      metadata: { role: user.role },
    });

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

router.post('/change-password', authenticateToken, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await pool.query(
      `SELECT id, password_hash
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.sub]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);

    if (!passwordMatches) {
      await logSecurityEvent({
        userId: req.user.sub,
        email: req.user.email,
        action: 'change_password',
        status: 'failed',
        req,
        metadata: { reason: 'invalid_current_password' },
      });
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({ message: 'La nueva contraseña debe ser diferente a la actual' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, req.user.sub]
    );

    await logSecurityEvent({
      userId: req.user.sub,
      email: req.user.email,
      action: 'change_password',
      status: 'success',
      req,
    });

    return res.status(200).json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    return next(error);
  }
});

router.get('/activity', authenticateToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM (
         SELECT h.created_at,
                'order_status'::text AS kind,
                CONCAT('Pedido ', o.order_code, ': ', COALESCE(h.from_status::text, 'inicio'), ' -> ', h.to_status::text) AS title,
                COALESCE(NULLIF(h.notes, ''), 'Cambio de estado registrado') AS description
         FROM order_status_history h
         INNER JOIN orders o ON o.id = h.order_id
         WHERE h.changed_by = $1

         UNION ALL

         SELECT s.created_at,
                'security'::text AS kind,
                CASE
                  WHEN s.action = 'login' AND s.status = 'success' THEN 'Inicio de sesion exitoso'
                  WHEN s.action = 'login' AND s.status = 'failed' THEN 'Intento de inicio de sesion fallido'
                  WHEN s.action = 'change_password' AND s.status = 'success' THEN 'Contrasena actualizada'
                  WHEN s.action = 'change_password' AND s.status = 'failed' THEN 'Intento fallido de cambio de contrasena'
                  WHEN s.action = 'register' AND s.status = 'success' THEN 'Registro de cuenta'
                  ELSE CONCAT('Evento de seguridad: ', s.action)
                END AS title,
                CONCAT(
                  'Estado: ', s.status,
                  CASE
                    WHEN s.metadata ? 'reason' THEN CONCAT(' · Motivo: ', s.metadata->>'reason')
                    ELSE ''
                  END
                ) AS description
         FROM security_audit_logs s
         WHERE s.user_id = $1
       ) merged
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.sub]
    );

    return res.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/notifications/status', authenticateToken, requireRole(USER_ROLES.ADMIN), async (_req, res) => {
  return res.status(200).json({
    data: {
      emailEnabled: isEmailEnabled(),
      fromEmail: env.sendgridFromEmail || null,
      provider: 'sendgrid',
    },
  });
});

router.post('/notifications/test', authenticateToken, requireRole(USER_ROLES.ADMIN), async (req, res, next) => {
  try {
    const targetEmail = String(req.body?.to || req.user.email || '').trim().toLowerCase();

    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({ message: 'Debes proporcionar un correo de destino válido' });
    }

    const result = await sendEmail({
      to: targetEmail,
      subject: 'Prueba de correo - Diseños Acuña',
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
          <h2 style="margin-bottom: 8px;">Correo de prueba</h2>
          <p>Este mensaje confirma que la configuración de correo está funcionando.</p>
          <p><strong>Enviado por:</strong> Panel Administrador</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</p>
        </div>
      `,
    });

    if (result?.skipped) {
      return res.status(200).json({
        message: 'Correo omitido: configuración de SendGrid no disponible',
        data: { skipped: true },
      });
    }

    return res.status(200).json({
      message: `Correo de prueba enviado a ${targetEmail}`,
      data: { skipped: false },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
