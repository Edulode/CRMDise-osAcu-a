const express = require('express');
const multer = require('multer');
const { env } = require('../config/env');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { USER_ROLES } = require('../config/constants');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploadMaxFileSize,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      return callback(new Error('Solo se permiten imágenes'));
    }

    return callback(null, true);
  },
});

router.post('/images', authenticateToken, requireRole(USER_ROLES.ADMIN, USER_ROLES.EDITOR, USER_ROLES.COLLABORATOR, USER_ROLES.CUSTOMER), upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Debes enviar una imagen' });
  }

  return res.status(201).json({
    message: 'Imagen validada correctamente',
    file: {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

module.exports = router;
