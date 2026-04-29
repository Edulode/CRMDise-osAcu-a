const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const { env } = require('../config/env');

const ACCESS_TOKEN_LIFETIME_SECONDS = 7 * 24 * 60 * 60;
const REFRESH_TOKEN_LIFETIME_DAYS = 30;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAccessToken(user) {
  const jti = crypto.randomUUID();
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    customer_id: user.customer_id,
    created_at: user.created_at ?? null,
    jti,
  };

  return {
    token: jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn }),
    jti,
  };
}

function createRefreshToken(userId) {
  return {
    rawToken: crypto.randomBytes(48).toString('hex'),
    jti: crypto.randomUUID(),
    userId,
  };
}

async function storeRefreshToken(client, { userId, rawToken, jti, userAgent = null, ipAddress = null }) {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000);
  await client.query(
    `INSERT INTO auth_refresh_tokens (user_id, token_hash, jti, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, hashToken(rawToken), jti, expiresAt, userAgent, ipAddress]
  );

  return { expiresAt };
}

async function lookupRefreshToken(rawToken) {
  const result = await pool.query(
    `SELECT id, user_id, jti, expires_at, revoked_at
     FROM auth_refresh_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [hashToken(rawToken)]
  );

  return result.rows[0] || null;
}

async function revokeRefreshToken(rawToken, reason = 'logout') {
  if (!rawToken) {
    return false;
  }

  const tokenRow = await lookupRefreshToken(rawToken);
  if (!tokenRow) {
    return false;
  }

  await pool.query(
    `UPDATE auth_refresh_tokens
     SET revoked_at = NOW(), revocation_reason = COALESCE(revocation_reason, $2)
     WHERE id = $1`,
    [tokenRow.id, reason]
  );

  return true;
}

async function revokeAccessToken({ jti, userId, expiresAt, reason = 'logout' }) {
  if (!jti) {
    return false;
  }

  const expiration = expiresAt ? new Date(expiresAt * 1000) : new Date(Date.now() + ACCESS_TOKEN_LIFETIME_SECONDS * 1000);
  await pool.query(
    `INSERT INTO auth_token_revocations (user_id, jti, token_type, expires_at, reason)
     VALUES ($1, $2, 'access', $3, $4)
     ON CONFLICT (jti) DO NOTHING`,
    [userId ?? null, jti, expiration, reason]
  );

  return true;
}

async function isAccessTokenRevoked(jti) {
  if (!jti) {
    return false;
  }

  const result = await pool.query(
    `SELECT 1
     FROM auth_token_revocations
     WHERE jti = $1 AND token_type = 'access' AND revoked_at IS NOT NULL
     LIMIT 1`,
    [jti]
  );

  return result.rowCount > 0;
}

async function rotateRefreshToken(rawToken, { userAgent = null, ipAddress = null } = {}) {
  const existing = await lookupRefreshToken(rawToken);
  if (!existing || existing.revoked_at || new Date(existing.expires_at) < new Date()) {
    const error = new Error('Refresh token inválido o expirado');
    error.statusCode = 401;
    throw error;
  }

  const userResult = await pool.query(
    `SELECT id, full_name, email, role, customer_id, created_at, active
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [existing.user_id]
  );

  if (userResult.rowCount === 0 || !userResult.rows[0].active) {
    const error = new Error('Usuario no disponible');
    error.statusCode = 401;
    throw error;
  }

  const user = userResult.rows[0];
  const access = createAccessToken(user);
  const refresh = createRefreshToken(user.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE auth_refresh_tokens
       SET revoked_at = NOW(), revocation_reason = COALESCE(revocation_reason, 'rotated')
       WHERE id = $1`,
      [existing.id]
    );

    await storeRefreshToken(client, {
      userId: user.id,
      rawToken: refresh.rawToken,
      jti: refresh.jti,
      userAgent,
      ipAddress,
    });

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    user,
    accessToken: access.token,
    accessJti: access.jti,
    refreshToken: refresh.rawToken,
  };
}

async function issueSessionTokens(client, user, { userAgent = null, ipAddress = null } = {}) {
  const access = createAccessToken(user);
  const refresh = createRefreshToken(user.id);

  await storeRefreshToken(client, {
    userId: user.id,
    rawToken: refresh.rawToken,
    jti: refresh.jti,
    userAgent,
    ipAddress,
  });

  return {
    accessToken: access.token,
    accessJti: access.jti,
    refreshToken: refresh.rawToken,
  };
}

async function createPasswordResetToken(client, userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await client.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashToken(rawToken), expiresAt]
  );
  return { rawToken, expiresAt };
}

async function consumePasswordResetToken(rawToken) {
  const result = await pool.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [hashToken(rawToken)]
  );

  const record = result.rows[0];
  if (!record || record.used_at || new Date(record.expires_at) < new Date()) {
    const error = new Error('Token de recuperación inválido o expirado');
    error.statusCode = 400;
    throw error;
  }

  await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE id = $1`,
    [record.id]
  );

  return record.user_id;
}

module.exports = {
  createAccessToken,
  issueSessionTokens,
  isAccessTokenRevoked,
  revokeAccessToken,
  revokeRefreshToken,
  rotateRefreshToken,
  createPasswordResetToken,
  consumePasswordResetToken,
};