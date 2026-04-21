const crypto = require('crypto');

function createPublicCode(prefix = 'DAC') {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const token = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${stamp}-${token}`;
}

function createUuid() {
  return crypto.randomUUID();
}

module.exports = {
  createPublicCode,
  createUuid,
};
