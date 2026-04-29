const express = require('express');

const router = express.Router();

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Diseños Acuña API',
    version: '1.0.0',
    description: 'Contrato formal de la API para autenticación, catálogo, pedidos, reportes y seguridad.',
  },
  servers: [{ url: '/api' }],
  paths: {
    '/auth/login': { post: { summary: 'Iniciar sesión' } },
    '/auth/register': { post: { summary: 'Crear cuenta de cliente' } },
    '/auth/refresh': { post: { summary: 'Rotar refresh token y emitir un nuevo access token' } },
    '/auth/logout': { post: { summary: 'Revocar sesión activa' } },
    '/auth/password-reset/request': { post: { summary: 'Solicitar recuperación de contraseña' } },
    '/auth/password-reset/confirm': { post: { summary: 'Confirmar recuperación de contraseña' } },
    '/auth/2fa/setup': { post: { summary: 'Generar secreto 2FA' } },
    '/auth/2fa/verify': { post: { summary: 'Verificar y activar 2FA' } },
    '/auth/me': { get: { summary: 'Obtener usuario autenticado' } },
    '/orders/checkout': { post: { summary: 'Crear pedido y preparar pago' } },
    '/orders/{id}/status': { patch: { summary: 'Actualizar estado del pedido' } },
    '/reports/sales': { get: { summary: 'Reporte de ventas' } },
    '/reports/inventory': { get: { summary: 'Reporte de inventario' } },
    '/reports/customers': { get: { summary: 'Reporte de clientes' } },
    '/users': {
      get: { summary: 'Listar usuarios staff (admin/gerente/colaborador)' },
      post: { summary: 'Crear usuario staff (admin)' }
    },
    '/users/{id}': {
      put: { summary: 'Actualizar usuario (admin)' },
      delete: { summary: 'Eliminar/desactivar usuario (admin)' }
    },
    '/webhooks/stripe': { post: { summary: 'Webhook de Stripe' } },
  },
};

router.get('/openapi.json', (_req, res) => {
  return res.status(200).json(spec);
});

router.get('/docs', (_req, res) => {
  return res.status(200).send(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>API Docs - Diseños Acuña</title>
        <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
        <style>body { margin: 0; background: #f5f4f0; }</style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
        <script>
          window.onload = () => {
            window.ui = SwaggerUIBundle({
              url: '/api/openapi.json',
              dom_id: '#swagger-ui',
              deepLinking: true,
              displayRequestDuration: true,
              persistAuthorization: true,
            });
          };
        </script>
      </body>
    </html>
  `);
});

module.exports = router;