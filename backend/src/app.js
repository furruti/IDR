const express = require('express');
const healthRoutes = require('./routes/health.routes');
const { notFoundHandler, errorHandler } = require('./middleware/error-handler');

const app = express();

app.use(express.json());

app.use('/api/v1/health', healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
