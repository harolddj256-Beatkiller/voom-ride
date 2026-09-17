'use strict';
const { HttpError } = require('../errors');

function notFound(req, res) {
  res.status(404).json({ error: 'Unknown endpoint.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { notFound, errorHandler };
