const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { withTransaction } = require('../db/transaction');
const { env } = require('../config/env');
const { USER_ROLES } = require('../config/constants');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  twoFactorVerifySchema,
} = require('../validators/auth.validators');
const { sendEmail, isEmailEnabled } = require('../services/notification.service');
const {
  issueSessionTokens,
  revokeAccessToken,
  revokeRefreshToken,
  rotateRefreshToken,
  createPasswordResetToken,
  consumePasswordResetToken,
} = require('../services/security.service');
const { generateSecret, verifyTotp, buildOtpAuthUri } = require('../utils/totp');

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

async function loadUserWithMfaByEmail(email) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.role, u.customer_id, u.created_at, u.password_hash, u.active,
            COALESCE(m.enabled, false) AS mfa_enabled,
            m.secret AS mfa_secret
     FROM users u
     LEFT JOIN user_mfa m ON m.user_id = u.id
     WHERE u.email = $1
     LIMIT 1`,
    [email]
  );

  return result.rows[0] || null;
}

async function issueAuthResponse(client, user, req) {
  const session = await issueSessionTokens(client, user, {
    userAgent: req.headers['user-agent'] ?? null,
    ipAddress: getClientIp(req),
  });

  return {
    token: session.accessToken,
    refreshToken: session.refreshToken,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      customer_id: user.customer_id,
      created_at: user.created_at,
    },
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

    const response = await withTransaction(async (client) => {
      return issueAuthResponse(client, result.user, req);
    });

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
      ...response,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password, twoFactorCode } = req.body;
    const user = await loadUserWithMfaByEmail(email);

    if (!user || !user.active) {
      await logSecurityEvent({
        email,
        action: 'login',
        status: 'failed',
        req,
        metadata: { reason: 'user_not_found' },
      });
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

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

    if (user.mfa_enabled) {
      if (!twoFactorCode || !verifyTotp(user.mfa_secret, twoFactorCode)) {
        await logSecurityEvent({
          userId: user.id,
          email: user.email,
          action: 'login_2fa',
          status: 'failed',
          req,
          metadata: { reason: 'invalid_totp' },
        });

        return res.status(401).json({ message: 'Código 2FA inválido o requerido', mfaRequired: true });
      }
    }

    const resultPayload = await withTransaction(async (client) => {
      const payload = await issueAuthResponse(client, user, req);
      return payload;
    });

    await logSecurityEvent({
      userId: user.id,
      email: user.email,
      action: 'login',
      status: 'success',
      req,
      metadata: { role: user.role },
    });

    return res.status(200).json(resultPayload);
  } catch (error) {
    return next(error);
  }
});

router.post('/refresh', validate(refreshTokenSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const session = await rotateRefreshToken(refreshToken, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: getClientIp(req),
    });

    return res.status(200).json({
      token: session.accessToken,
      refreshToken: session.refreshToken,
      user: {
        id: session.user.id,
        full_name: session.user.full_name,
        email: session.user.email,
        role: session.user.role,
        customer_id: session.user.customer_id,
        created_at: session.user.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    await revokeAccessToken({ jti: req.user.jti, userId: req.user.sub, expiresAt: req.user.exp, reason: 'logout' });
    if (refreshToken) {
      await revokeRefreshToken(refreshToken, 'logout');
    }

    return res.status(200).json({ message: 'Sesión cerrada correctamente' });
  } catch (error) {
    return next(error);
  }
});

router.post('/password-reset/request', validate(passwordResetRequestSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await pool.query(
      `SELECT id, full_name, email
       FROM users
       WHERE email = $1 AND active = TRUE
       LIMIT 1`,
      [email]
    );

    if (result.rowCount > 0) {
      const user = result.rows[0];
      const token = await createPasswordResetToken(pool, user.id);
      const resetUrl = `${req.headers.origin || 'http://localhost:8080'}/landing/reset-password.html?token=${encodeURIComponent(token.rawToken)}`;

      await sendEmail({
        to: user.email,
        subject: 'Recuperación de contraseña - Diseños Acuña',
        html: `
          <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
            <h2>Recuperación de contraseña</h2>
            <p>Hola ${user.full_name},</p>
            <p>Solicitaste restablecer tu contraseña. Usa el siguiente enlace:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>Este enlace expirará en 1 hora.</p>
          </div>
        `,
      }).catch(() => null);
    }

    return res.status(200).json({ message: 'Si el correo existe, se enviaron instrucciones de recuperación' });
  } catch (error) {
    return next(error);
  }
});

router.post('/password-reset/confirm', validate(passwordResetConfirmSchema), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const userId = await consumePasswordResetToken(token);
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, userId]
    );

    await pool.query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = NOW(), revocation_reason = 'password_reset'
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    return res.status(200).json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    return next(error);
  }
});

router.post('/2fa/setup', authenticateToken, async (req, res, next) => {
  try {
    const userResult = await pool.query(
      `SELECT id, full_name, email
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.sub]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const secret = generateSecret();
    await pool.query(
      `INSERT INTO user_mfa (user_id, secret, enabled, updated_at)
       VALUES ($1, $2, FALSE, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET secret = EXCLUDED.secret, enabled = FALSE, verified_at = NULL, updated_at = NOW()`,
      [req.user.sub, secret]
    );

    return res.status(200).json({
      data: {
        secret,
        otpauthUri: buildOtpAuthUri({ issuer: 'Disenos Acuna', accountName: userResult.rows[0].email, secret }),
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/2fa/verify', authenticateToken, validate(twoFactorVerifySchema), async (req, res, next) => {
  try {
    const { code } = req.body;
    const result = await pool.query(
      `SELECT secret, enabled
       FROM user_mfa
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.sub]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: 'No hay configuración 2FA pendiente' });
    }

    if (!verifyTotp(result.rows[0].secret, code)) {
      return res.status(400).json({ message: 'Código 2FA inválido' });
    }

    await pool.query(
      `UPDATE user_mfa
       SET enabled = TRUE, verified_at = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [req.user.sub]
    );

    return res.status(200).json({ message: '2FA habilitado correctamente' });
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
  const missing = [];
  if (!env.sendgridApiKey) {
    missing.push('SENDGRID_API_KEY');
  }
  if (!env.sendgridFromEmail) {
    missing.push('SENDGRID_FROM_EMAIL');
  }

  return res.status(200).json({
    data: {
      emailEnabled: isEmailEnabled(),
      fromEmail: env.sendgridFromEmail || null,
      provider: 'sendgrid',
      missing,
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
