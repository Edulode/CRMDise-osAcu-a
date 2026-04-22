const { HttpError } = require('../utils/httpError');

function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null,
    });
  }

  if (error.code === '23505') {
    return res.status(409).json({
      message: 'Ya existe un registro con esos datos únicos',
    });
  }

  console.error(error);
  return res.status(500).json({
    message: 'Error interno del servidor',
  });
}

module.exports = {
  errorHandler,
};
