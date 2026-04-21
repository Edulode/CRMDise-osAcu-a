const app = require('./app');
const { env } = require('./config/env');

function startServer() {
  return app.listen(env.port, () => {
    console.log(`Backend running on http://localhost:${env.port}`);
  });
}

module.exports = {
  app,
  startServer,
};
