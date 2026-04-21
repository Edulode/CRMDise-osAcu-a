function notFound(_req, res) {
  return res.status(404).json({
    message: 'Ruta no encontrada',
  });
}

module.exports = {
  notFound,
};
