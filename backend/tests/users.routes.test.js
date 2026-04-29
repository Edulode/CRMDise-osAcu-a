const test = require('node:test');
const assert = require('node:assert/strict');

const { app } = require('../src/server');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test.skip('users routes - list (requires admin)', async () => {
  // Placeholder: add integration tests for /api/users endpoints
});

test.skip('users routes - create/update/delete (admin only)', async () => {
  // Placeholder: add integration tests for admin actions
});

// NOTE: these tests are skipped by default to avoid failing CI until fixtures are added.
