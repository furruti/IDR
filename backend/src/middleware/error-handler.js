function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'not_found',
    message: 'Route not found',
  });
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const response = {
    error: statusCode === 500 ? 'internal_server_error' : 'request_error',
    message: statusCode === 500 ? 'Internal server error' : err.message,
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
