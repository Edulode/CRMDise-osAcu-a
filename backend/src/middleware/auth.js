const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { USER_ROLES } = require('../config/constants');
const { isAccessTokenRevoked } = require('../services/security.service');

function extractToken(authorization) {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

async function optionalAuth(req, _res, next) {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (await isAccessTokenRevoked(payload.jti)) {
      req.user = null;
      return next();
    }

    req.user = payload;
  } catch (_error) {
    req.user = null;
  }

  return next();
}

async function authenticateToken(req, res, next) {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (await isAccessTokenRevoked(payload.jti)) {
      return res.status(401).json({ message: 'Token revocado' });
    }

    req.user = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

function requireRole(...allowedRoles) {
  const allowed = new Set(allowedRoles.length ? allowedRoles : Object.values(USER_ROLES));

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Autenticación requerida' });
    }

    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ message: 'Acceso denegado para este rol' });
    }

    return next();
  };
}

/**
 * Middleware para validar que un usuario ownea una orden
 * Extrae el orderId del parámetro :id y verifica propiedad
 * - Admin/gerente/colaborador: acceso a cualquier orden
 * - Customer: solo acceso a órdenes propias (customer_id debe coincidir con JWT claim)
 *
 * Uso: router.get('/:id', authenticateToken, requireOwnershipOrder(pool), ...)
 */
function requireOwnershipOrder(pool) {
  return async (req, res, next) => {
    try {
      const orderId = req.params.id;
      const user = req.user;

      if (!orderId || !user) {
        return res.status(401).json({ message: 'Autenticación requerida' });
      }

          // Admin/gerente/colaborador pueden acceder a cualquier orden
      if (user.role !== USER_ROLES.CUSTOMER) {
        return next();
      }

      // Para CUSTOMER, validar que es dueño
      const customerId = user.customer_id;
      if (!customerId) {
        return res.status(403).json({ message: 'No tienes permiso para acceder a este recurso' });
      }

      const result = await pool.query(
        `SELECT id FROM orders WHERE id = $1 AND customer_id = $2 LIMIT 1`,
        [orderId, customerId]
      );

      if (result.rowCount === 0) {
        // No encontrado o no es propietario - retornar 404 para no revelar existencia
        return res.status(404).json({ message: 'Pedido no encontrado' });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requireOwnershipOrder,
};
