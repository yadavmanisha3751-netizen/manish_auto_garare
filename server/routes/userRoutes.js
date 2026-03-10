// server/routes/userRoutes.js
const express = require('express');
const r = express.Router();
const c = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
r.post('/send-otp',   c.sendOtp);
r.post('/verify-otp', c.verifyOtp);
r.post('/logout',     c.logout);
r.get('/profile',     authenticateToken, c.profile);
module.exports = r;
