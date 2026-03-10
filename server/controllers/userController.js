// server/controllers/userController.js
const jwt = require('jsonwebtoken');
const db  = require('../db');

// Send OTP via Twilio (or log to console in dev)
async function sendSMS(phone, otp) {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from  = process.env.TWILIO_PHONE_NUMBER;

    if (!sid || !token || !sid.startsWith('AC') || !from || from.includes('XXXX')) {
        console.log(`\n📱 DEV OTP for ${phone}: ${otp}\n`);
        return { dev: true };
    }
    const twilio = require('twilio')(sid, token);
    const msg = await twilio.messages.create({
        body: `Manish Auto Garage OTP: ${otp}. Valid ${process.env.OTP_EXPIRY_MINUTES||10} mins. Do not share.`,
        from, to: phone
    });
    console.log(`✅ SMS sent to ${phone}, SID: ${msg.sid}`);
    return msg;
}

// Always produce +91XXXXXXXXXX
function fixPhone(raw) {
    const digits = String(raw).replace(/\D/g, '');
    return '+91' + digits.slice(-10);
}

// POST /api/users/send-otp
exports.sendOtp = async (req, res) => {
    try {
        const { phone, full_name, vehicle_type } = req.body;
        if (!phone) return res.status(400).json({ success: false, message: 'Phone required.' });

        const p = fixPhone(phone);
        if (p.length !== 13) return res.status(400).json({ success: false, message: 'Enter valid 10-digit number.' });

        const [existing] = await db.query('SELECT id FROM users WHERE phone=?', [p]);
        const isNew = existing.length === 0;
        if (isNew && !full_name) {
            return res.status(400).json({ success: false, message: 'Enter your name to register.', newUser: true });
        }

        const otp     = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES)||10) * 60000);

        await db.query('DELETE FROM otp_sessions WHERE phone=?', [p]);
        await db.query('INSERT INTO otp_sessions (phone,otp,expires_at) VALUES (?,?,?)', [p, otp, expires]);

        let dev = false;
        try {
            const r = await sendSMS(p, otp);
            if (r.dev) dev = true;
        } catch (smsErr) {
            await db.query('DELETE FROM otp_sessions WHERE phone=?', [p]);
            console.error('SMS Error:', smsErr.code, smsErr.message);
            return res.status(500).json({ success: false, message: `SMS failed: ${smsErr.message}` });
        }

        res.json({
            success: true,
            message: dev ? `DEV MODE — OTP: ${otp}` : 'OTP sent to your mobile',
            newUser: isNew,
            ...(process.env.NODE_ENV !== 'production' && { devOtp: otp })
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
};

// POST /api/users/verify-otp
exports.verifyOtp = async (req, res) => {
    try {
        const { phone, otp, full_name, vehicle_type } = req.body;
        const p = fixPhone(phone);

        const [rows] = await db.query(
            'SELECT * FROM otp_sessions WHERE phone=? AND used=0 AND expires_at>NOW() ORDER BY id DESC LIMIT 1', [p]
        );
        if (!rows.length) return res.status(400).json({ success: false, message: 'OTP expired. Request new one.' });
        if (rows[0].otp !== String(otp).trim()) return res.status(400).json({ success: false, message: 'Wrong OTP.' });

        await db.query('UPDATE otp_sessions SET used=1 WHERE id=?', [rows[0].id]);

        const [existing] = await db.query('SELECT * FROM users WHERE phone=?', [p]);
        let user;
        if (!existing.length) {
            if (!full_name) return res.status(400).json({ success: false, message: 'Name required.' });
            const [r] = await db.query(
                'INSERT INTO users (full_name,phone,vehicle_type) VALUES (?,?,?)',
                [full_name.trim(), p, vehicle_type || 'Motorcycle']
            );
            const [u] = await db.query('SELECT * FROM users WHERE id=?', [r.insertId]);
            user = u[0];
        } else {
            user = existing[0];
        }

        const token = jwt.sign({ id: user.id, phone: user.phone, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, message: 'Welcome to Manish Auto Garage!', token, user: { id: user.id, full_name: user.full_name, phone: user.phone, vehicle_type: user.vehicle_type } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Verification failed.' });
    }
};

exports.logout  = (req, res) => { res.json({ success: true }); };
exports.profile = async (req, res) => {
    const [rows] = await db.query('SELECT id,full_name,phone,vehicle_type,created_at FROM users WHERE id=?', [req.user.id]);
    rows.length ? res.json({ success: true, user: rows[0] }) : res.status(404).json({ success: false });
};
