// server/controllers/adminController.js
//const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const db     = require('../db');
const bcrypt = require('bcryptjs');
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await db.query('SELECT * FROM admin WHERE email=?', [email]);
        if (!rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        if (rows[0].password === 'PLACEHOLDER')
            return res.status(401).json({ success: false, message: 'Run: node server/reset-admin-password.js to set password.' });
        const ok = await bcrypt.compare(password, rows[0].password);
        if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        const token = jwt.sign({ id: rows[0].id, email: rows[0].email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token, admin: { id: rows[0].id, username: rows[0].username, email: rows[0].email } });
    } catch (e) { res.status(500).json({ success: false, message: 'Server error.' }); }
};

exports.logout = (req, res) => res.json({ success: true });

exports.dashboard = async (req, res) => {
    try {
        const [[{ total }]]      = await db.query('SELECT COUNT(*) as total FROM bookings');
        const [[{ pending }]]    = await db.query('SELECT COUNT(*) as pending FROM bookings WHERE status="Pending"');
        const [[{ progress }]]   = await db.query('SELECT COUNT(*) as progress FROM bookings WHERE status="In Progress"');
        const [[{ completed }]]  = await db.query('SELECT COUNT(*) as completed FROM bookings WHERE status="Completed"');
        const [[{ cancelled }]]  = await db.query('SELECT COUNT(*) as cancelled FROM bookings WHERE status="Cancelled"');
        const [[{ revenue }]]    = await db.query('SELECT COALESCE(SUM(bill_amount),0) as revenue FROM bookings WHERE status="Completed"');
        const [[{ paid }]]       = await db.query('SELECT COALESCE(SUM(bill_amount),0) as paid FROM bookings WHERE payment_status="Paid"');
        const [[{ users }]]      = await db.query('SELECT COUNT(*) as users FROM users');

        const [recent] = await db.query(
            'SELECT b.*, u.full_name, u.phone FROM bookings b JOIN users u ON b.user_id=u.id ORDER BY b.created_at DESC LIMIT 10');
        for (const b of recent) {
            const [s] = await db.query(
                'SELECT s.name FROM booking_services bs JOIN services s ON bs.service_id=s.id WHERE bs.booking_id=?', [b.id]);
            b.service_names = s.map(x => x.name).join(', ');
        }
        res.json({ success: true, stats: { total, pending, progress, completed, cancelled, revenue, paid, users }, recent });
    } catch (e) { res.status(500).json({ success: false, message: 'Dashboard error.' }); }
};

exports.allBookings = async (req, res) => {
    try {
        const { status, q } = req.query;
        let sql = 'SELECT b.*, u.full_name, u.phone FROM bookings b JOIN users u ON b.user_id=u.id WHERE 1=1';
        const params = [];
        if (status && status !== 'All') { sql += ' AND b.status=?'; params.push(status); }
        if (q) { sql += ' AND (u.full_name LIKE ? OR b.vehicle_plate LIKE ? OR u.phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
        sql += ' ORDER BY b.created_at DESC';
        const [rows] = await db.query(sql, params);
        for (const b of rows) {
            const [s] = await db.query(
                'SELECT bs.price_at_booking, s.name FROM booking_services bs JOIN services s ON bs.service_id=s.id WHERE bs.booking_id=?', [b.id]);
            b.services = s;
            b.service_names = s.map(x => x.name).join(', ');
            b.totalEstimate = s.reduce((sum, x) => sum + parseFloat(x.price_at_booking), 0);
        }
        res.json({ success: true, bookings: rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Failed.' }); }
};

exports.updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['Pending','In Progress','Completed','Cancelled'].includes(status))
            return res.status(400).json({ success: false, message: 'Invalid status.' });
        await db.query('UPDATE bookings SET status=? WHERE id=?', [status, req.params.id]);
        res.json({ success: true, message: 'Status updated.' });
    } catch (e) { res.status(500).json({ success: false, message: 'Failed.' }); }
};

exports.generateBill = async (req, res) => {
    try {
        const labour   = parseFloat(req.body.bill_labour) || 0;
        const parts    = parseFloat(req.body.bill_parts)  || 0;
        const sub      = labour + parts;
        const gst      = Math.round(sub * 0.18 * 100) / 100;
        const total    = Math.round((sub + gst) * 100) / 100;
        if (sub <= 0) return res.status(400).json({ success: false, message: 'Enter labour or parts amount.' });
        await db.query(
            `UPDATE bookings SET bill_labour=?,bill_parts=?,bill_gst=?,bill_amount=?,bill_notes=?,status='Completed' WHERE id=?`,
            [labour, parts, gst, total, req.body.bill_notes || null, req.params.id]);
        const [b] = await db.query('SELECT b.*, u.full_name, u.phone FROM bookings b JOIN users u ON b.user_id=u.id WHERE b.id=?', [req.params.id]);
        const [s] = await db.query('SELECT bs.*, sv.name as service_name FROM booking_services bs JOIN services sv ON bs.service_id=sv.id WHERE bs.booking_id=?', [req.params.id]);
        b[0].services = s;
        res.json({ success: true, booking: b[0] });
    } catch (e) { res.status(500).json({ success: false, message: 'Failed.' }); }
};

exports.deleteBooking = async (req, res) => {
    try {
        await db.query('DELETE FROM booking_services WHERE booking_id=?', [req.params.id]);
        await db.query('DELETE FROM bookings WHERE id=?', [req.params.id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: 'Failed.' }); }
};

exports.services = async (req, res) => {
    const [rows] = await db.query('SELECT * FROM services ORDER BY category, name');
    res.json({ success: true, services: rows });
};
