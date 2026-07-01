require('dotenv').config();

const app = require('./app');

const port = Number(process.env.PORT) || 3002;
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`idr-backend listening on ${host}:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down idr-backend`);
  server.close((error) => {
    if (error) {
      console.error('Error during shutdown', error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
