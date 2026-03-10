// server/routes/adminRoutes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const auth = [authenticateToken, requireAdmin];
r.post('/login',                c.login);
r.post('/logout',               c.logout);
r.get('/dashboard',             ...auth, c.dashboard);
r.get('/bookings',              ...auth, c.allBookings);
r.put('/bookings/:id/status',   ...auth, c.updateStatus);
r.post('/bookings/:id/bill',    ...auth, c.generateBill);
r.delete('/bookings/:id',       ...auth, c.deleteBooking);
r.get('/services',              ...auth, c.services);
module.exports = r;
