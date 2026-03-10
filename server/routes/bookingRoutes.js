// server/routes/bookingRoutes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/bookingController');
const { authenticateToken } = require('../middleware/auth');
r.get('/services',               c.getServices);
r.post('/create',                authenticateToken, c.create);
r.get('/my',                     authenticateToken, c.myBookings);
r.put('/:id/cancel',             authenticateToken, c.cancel);
r.post('/:id/pay',               authenticateToken, c.createPayment);
r.post('/:id/verify-payment',    authenticateToken, c.verifyPayment);
module.exports = r;
