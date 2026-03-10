// server/middleware/auth.js
const jwt = require('jsonwebtoken');

exports.authenticateToken = (req, res, next) => {
    const header = req.headers['authorization'];
    const token  = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Login required.' });
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Session expired. Please login again.' });
        req.user = user;
        next();
    });
};

exports.requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin')
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    next();
};
