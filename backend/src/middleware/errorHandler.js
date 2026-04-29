const { HttpError } = require('../utils/httpError');

function errorHandler(error, _req, res, _next) {
  const requestId = _req?.requestId ?? null;

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null,
      requestId,
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      message: 'Ya existe un registro con esos datos únicos',
      requestId,
    });
  }

  console.error(JSON.stringify({
    type: 'error',
    requestId,
    message: error?.message || 'Error interno del servidor',
    stack: error?.stack || null,
  }));
  return res.status(500).json({
    message: 'Error interno del servidor',
    requestId,
  });
}

module.exports = {
  errorHandler,
};
