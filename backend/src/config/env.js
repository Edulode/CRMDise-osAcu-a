const dotenv = require('dotenv');

dotenv.config();

function readString(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function readNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const env = {
  nodeEnv: readString('NODE_ENV', 'development'),
  port: readNumber('PORT', 4000),
  corsOrigin: readString('CORS_ORIGIN', '*'),
  databaseUrl: readString('DATABASE_URL', ''),
  dbHost: readString('DB_HOST', 'localhost'),
  dbPort: readNumber('DB_PORT', 5432),
  dbUser: readString('DB_USER', 'postgres'),
  dbPassword: readString('DB_PASSWORD', 'postgres'),
  dbName: readString('DB_NAME', 'crm_disacuna'),
  jwtSecret: readString('JWT_SECRET', 'change-me-in-production'),
  jwtExpiresIn: readString('JWT_EXPIRES_IN', '7d'),
  stripeSecretKey: readString('STRIPE_SECRET_KEY', ''),
  stripeWebhookSecret: readString('STRIPE_WEBHOOK_SECRET', ''),
  sendgridApiKey: readString('SENDGRID_API_KEY', ''),
  sendgridFromEmail: readString('SENDGRID_FROM_EMAIL', ''),
  twilioAccountSid: readString('TWILIO_ACCOUNT_SID', ''),
  twilioAuthToken: readString('TWILIO_AUTH_TOKEN', ''),
  twilioFromNumber: readString('TWILIO_FROM_NUMBER', ''),
  uploadMaxFileSize: readNumber('UPLOAD_MAX_FILE_SIZE', 15 * 1024 * 1024),
};

module.exports = {
  env,
};
