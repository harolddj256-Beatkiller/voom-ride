'use strict';
const express = require('express');
const cors = require('cors');
const authRoutes = require('./auth/routes');
const tripRoutes = require('./trips/routes');
const paymentRoutes = require('./payments/routes');
const receiptRoutes = require('./receipts/routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/trips', tripRoutes);
app.use('/payments', paymentRoutes);
app.use('/receipts', receiptRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
