const sgMail = require('@sendgrid/mail');
const Twilio = require('twilio');
const { env } = require('../config/env');

let twilioClient = null;

if (env.twilioAccountSid && env.twilioAuthToken) {
  twilioClient = Twilio(env.twilioAccountSid, env.twilioAuthToken);
}

function isEmailEnabled() {
  return Boolean(env.sendgridApiKey && env.sendgridFromEmail);
}

async function sendEmail(message) {
  if (!isEmailEnabled()) {
    console.log('⚠️  Email disabled - skipping:', message.subject);
    return { skipped: true };
  }

  try {
    sgMail.setApiKey(env.sendgridApiKey);
    await sgMail.send({
      from: env.sendgridFromEmail,
      ...message,
    });
    console.log('✅ Email enviado:', message.subject);
    return { skipped: false };
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════

function getOrderConfirmationTemplate(orderCode, customerName, total) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'DM Sans', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a2232, #2d3a4f); color: #fff; padding: 30px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
          .order-code { background: #c9a84c; color: #1a2232; padding: 15px; border-radius: 5px; font-weight: bold; text-align: center; font-size: 20px; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #c9a84c; }
          .total { font-size: 24px; font-weight: bold; color: #c9a84c; text-align: right; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          a { color: #c9a84c; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Pedido Confirmado!</h1>
            <p style="margin: 10px 0 0 0;">Diseños Acuña</p>
          </div>
          <div class="content">
            <p>Hola <strong>${customerName}</strong>,</p>
            <p>Agradecemos tu compra. Tu pedido ha sido registrado correctamente y pronto recibiremos tu pago para procesarlo.</p>
            
            <div class="order-code">${orderCode}</div>
            
            <div class="details">
              <h3 style="margin-top: 0; color: #c9a84c;">Resumen del Pedido</h3>
              <p><strong>Código de Orden:</strong> ${orderCode}</p>
              <p><strong>Cliente:</strong> ${customerName}</p>
            </div>
            
            <div class="total">Total a Pagar: $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</div>
            
            <p>Próximos pasos:</p>
            <ol>
              <li>Complete el pago en el enlace que compartimos</li>
              <li>Recibirá confirmación cuando el pago sea procesado</li>
              <li>Nuestro equipo comenzará con la producción de su diseño</li>
              <li>Le notificaremos cuando esté listo para envío</li>
            </ol>
            
            <p>¿Tiene preguntas? Contáctenos en <a href="mailto:info@disenosacuna.com">info@disenosacuna.com</a></p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Diseños Acuña. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getPaymentConfirmedTemplate(orderCode, customerName, total) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'DM Sans', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #15803d, #22c55e); color: #fff; padding: 30px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
          .order-code { background: #22c55e; color: #fff; padding: 15px; border-radius: 5px; font-weight: bold; text-align: center; font-size: 20px; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #22c55e; }
          .total { font-size: 24px; font-weight: bold; color: #22c55e; text-align: right; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ ¡Pago Confirmado!</h1>
            <p style="margin: 10px 0 0 0;">Diseños Acuña</p>
          </div>
          <div class="content">
            <p>Hola <strong>${customerName}</strong>,</p>
            <p>¡Excelente! Tu pago ha sido procesado correctamente. Nuestro equipo ha comenzado con la producción de tu diseño.</p>
            
            <div class="order-code">${orderCode}</div>
            
            <div class="details">
              <h3 style="margin-top: 0; color: #22c55e;">Detalles del Pago</h3>
              <p><strong>Código de Orden:</strong> ${orderCode}</p>
              <p><strong>Monto Pagado:</strong> $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <p><strong>Estado:</strong> <strong style="color: #22c55e;">Confirmado</strong></p>
            </div>
            
            <p><strong>¿Qué sigue?</strong></p>
            <ul>
              <li>Tu diseño está en la cola de producción</li>
              <li>Te enviaremos actualizaciones a medida que avance</li>
              <li>Una vez finalizado, procederemos con el envío</li>
            </ul>
            
            <p>Gracias por confiar en Diseños Acuña.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Diseños Acuña. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getShipmentNotificationTemplate(orderCode, customerName, trackingNumber, carrier) {
  const safeTracking = trackingNumber || 'Pendiente de asignar';
  const safeCarrier = carrier || 'Transportista por definir';
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'DM Sans', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0369a1, #0ea5e9); color: #fff; padding: 30px; border-radius: 8px 8px 0 0; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
          .tracking { background: #0ea5e9; color: #fff; padding: 15px; border-radius: 5px; font-weight: bold; font-size: 18px; margin: 20px 0; }
          .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0ea5e9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          a { color: #0ea5e9; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Tu Pedido Ha Sido Enviado!</h1>
            <p style="margin: 10px 0 0 0;">Diseños Acuña</p>
          </div>
          <div class="content">
            <p>Hola <strong>${customerName}</strong>,</p>
            <p>¡Tu pedido está en camino! Tu paquete ha sido entregado al transportista y puede rastrearlo usando los datos abajo.</p>
            
            <div class="details">
              <h3 style="margin-top: 0; color: #0ea5e9;">Información de Envío</h3>
              <p><strong>Código de Orden:</strong> ${orderCode}</p>
              <p><strong>Transportista:</strong> ${safeCarrier}</p>
              <div class="tracking" style="text-align: center;">
                Rastreo: ${safeTracking}
              </div>
            </div>
            
            <p>Ingresa a la página del transportista para obtener detalles de tu envío y horario de entrega estimado.</p>
            
            <p>¡Gracias por tu compra!</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Diseños Acuña. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function getOrderStatusUpdateTemplate(orderCode, customerName, statusLabel) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'DM Sans', 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a2232, #2d3a4f); color: #fff; padding: 30px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f7f4; padding: 30px; border-radius: 0 0 8px 8px; }
          .status-box { background: #fff; padding: 16px; border-radius: 6px; border-left: 4px solid #c9a84c; margin: 16px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;font-size:26px;">Actualización de pedido</h1>
            <p style="margin: 10px 0 0 0;">Diseños Acuña</p>
          </div>
          <div class="content">
            <p>Hola <strong>${customerName}</strong>,</p>
            <p>Tu pedido ha cambiado de estado.</p>
            <div class="status-box">
              <p style="margin:0;"><strong>Pedido:</strong> ${orderCode}</p>
              <p style="margin:8px 0 0;"><strong>Nuevo estado:</strong> ${statusLabel}</p>
            </div>
            <p>Si tienes dudas, responde a este correo y te apoyamos.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Diseños Acuña. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// ═══════════════════════════════════════════════════════════
// EMAIL SENDING FUNCTIONS
// ═══════════════════════════════════════════════════════════

async function sendOrderConfirmationEmail({ to, orderCode, customerName, total }) {
  return sendEmail({
    to,
    subject: `✓ Confirmación de pedido ${orderCode}`,
    html: getOrderConfirmationTemplate(orderCode, customerName, total),
  });
}

async function sendPaymentConfirmedEmail({ to, orderCode, customerName, total }) {
  return sendEmail({
    to,
    subject: `✓ Pago confirmado - Pedido ${orderCode}`,
    html: getPaymentConfirmedTemplate(orderCode, customerName, total),
  });
}

async function sendShipmentNotificationEmail({ to, orderCode, customerName, trackingNumber, carrier }) {
  return sendEmail({
    to,
    subject: `📦 Tu pedido ${orderCode} ha sido enviado`,
    html: getShipmentNotificationTemplate(orderCode, customerName, trackingNumber, carrier),
  });
}

async function sendOrderStatusUpdateEmail({ to, orderCode, customerName, statusLabel }) {
  return sendEmail({
    to,
    subject: `Actualización de estado - Pedido ${orderCode}`,
    html: getOrderStatusUpdateTemplate(orderCode, customerName, statusLabel),
  });
}

async function sendSms({ to, body }) {
  if (!twilioClient || !env.twilioFromNumber) {
    console.log('⚠️  SMS disabled - skipping');
    return { skipped: true };
  }

  try {
    await twilioClient.messages.create({
      from: env.twilioFromNumber,
      to,
      body,
    });
    console.log('✅ SMS enviado a:', to);
    return { skipped: false };
  } catch (error) {
    console.error('❌ Error al enviar SMS:', error);
    throw error;
  }
}

module.exports = {
  isEmailEnabled,
  sendEmail,
  sendOrderConfirmationEmail,
  sendPaymentConfirmedEmail,
  sendShipmentNotificationEmail,
  sendOrderStatusUpdateEmail,
  sendSms,
};
