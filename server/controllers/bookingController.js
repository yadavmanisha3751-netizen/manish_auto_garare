// server/controllers/bookingController.js
const db   = require('../db');
const axios = require('axios');
const crypto = require('crypto');

// ── Cashfree helpers ──────────────────────────────────────
function cfHeaders() {
    return {
        'x-client-id':     process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        'x-api-version':   '2023-08-01',
        'Content-Type':    'application/json'
    };
}
function cfBase() { return process.env.CASHFREE_BASE_URL || 'https://sandbox.cashfree.com'; }
function cfConfigured() {
    const id = process.env.CASHFREE_APP_ID;
    return id && !id.includes('your_');
}

// GET /api/bookings/services
exports.getServices = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM services ORDER BY category, name');
        res.json({ success: true, services: rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Failed to load services.' }); }
};

// POST /api/bookings/create  (service_ids = array)
exports.create = async (req, res) => {
    try {
        const { service_ids, vehicle_type, vehicle_make, vehicle_model,
                vehicle_year, vehicle_plate, booking_date, booking_time, notes } = req.body;

        if (!service_ids || !service_ids.length)
            return res.status(400).json({ success: false, message: 'Select at least one service.' });
        if (!vehicle_make || !vehicle_model || !vehicle_year || !vehicle_plate || !booking_date || !booking_time)
            return res.status(400).json({ success: false, message: 'All vehicle and date fields are required.' });

        const ids = Array.isArray(service_ids) ? service_ids : [service_ids];
        const ph  = ids.map(() => '?').join(',');
        const [svcs] = await db.query(`SELECT * FROM services WHERE id IN (${ph})`, ids);
        if (!svcs.length) return res.status(400).json({ success: false, message: 'Invalid services.' });

        const [bRes] = await db.query(
            `INSERT INTO bookings (user_id, vehicle_type, vehicle_make, vehicle_model, vehicle_year,
             vehicle_plate, booking_date, booking_time, notes, status, payment_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Unpaid')`,
            [req.user.id, vehicle_type || 'Motorcycle', vehicle_make, vehicle_model,
             vehicle_year, vehicle_plate.toUpperCase(), booking_date, booking_time, notes || null]
        );
        const bookingId = bRes.insertId;

        for (const s of svcs) {
            await db.query('INSERT INTO booking_services (booking_id,service_id,price_at_booking) VALUES (?,?,?)',
                [bookingId, s.id, s.price]);
        }

        const total = svcs.reduce((sum, s) => sum + parseFloat(s.price), 0);
        res.status(201).json({ success: true, message: 'Booking confirmed!', bookingId, totalEstimate: total });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Booking failed: ' + e.message });
    }
};

// GET /api/bookings/my
exports.myBookings = async (req, res) => {
    try {
        const [bookings] = await db.query(
            'SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
        for (const b of bookings) {
            const [svcs] = await db.query(
                `SELECT bs.price_at_booking, s.name as service_name, s.category
                 FROM booking_services bs JOIN services s ON bs.service_id=s.id
                 WHERE bs.booking_id=?`, [b.id]);
            b.services     = svcs;
            b.totalEstimate = svcs.reduce((sum, s) => sum + parseFloat(s.price_at_booking), 0);
        }
        res.json({ success: true, bookings });
    } catch (e) { res.status(500).json({ success: false, message: 'Failed.' }); }
};

// POST /api/bookings/:id/pay  — create Cashfree order
exports.createPayment = async (req, res) => {
    try {
        const [bRows] = await db.query(
            'SELECT b.*, u.full_name, u.phone FROM bookings b JOIN users u ON b.user_id=u.id WHERE b.id=? AND b.user_id=?',
            [req.params.id, req.user.id]);
        if (!bRows.length) return res.status(404).json({ success: false, message: 'Booking not found.' });
        const b = bRows[0];

        // Amount = final bill if generated, else sum of services
        let amount = b.bill_amount;
        if (!amount) {
            const [[{ total }]] = await db.query('SELECT SUM(price_at_booking) as total FROM booking_services WHERE booking_id=?', [b.id]);
            amount = total;
        }
        amount = parseFloat(amount);

        if (!cfConfigured()) {
            // Dev mode — skip real payment
            return res.json({ success: true, devMode: true, amount, bookingId: b.id,
                customerName: b.full_name, customerPhone: b.phone });
        }

        const orderId = `MAG-${b.id}-${Date.now()}`;
        const payload = {
            order_id:     orderId,
            order_amount: amount,
            order_currency: 'INR',
            customer_details: {
                customer_id:    `user_${b.user_id}`,
                customer_name:  b.full_name,
                customer_phone: b.phone.replace('+91', '')
            },
            order_meta: {
                return_url: `http://localhost:${process.env.PORT||3000}/payment-return?bookingId=${b.id}&orderId=${orderId}`
            }
        };

        const resp = await axios.post(`${cfBase()}/pg/orders`, payload, { headers: cfHeaders() });
        await db.query('UPDATE bookings SET cashfree_order_id=? WHERE id=?', [orderId, b.id]);

        res.json({ success: true, paymentSessionId: resp.data.payment_session_id,
            orderId, amount, bookingId: b.id });
    } catch (e) {
        console.error('Cashfree create order error:', e.response?.data || e.message);
        res.status(500).json({ success: false, message: 'Payment setup failed: ' + (e.response?.data?.message || e.message) });
    }
};

// POST /api/bookings/:id/verify-payment
exports.verifyPayment = async (req, res) => {
    try {
        const { orderId, paymentId } = req.body;
        const [bRows] = await db.query('SELECT * FROM bookings WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
        if (!bRows.length) return res.status(404).json({ success: false, message: 'Not found.' });

        if (!cfConfigured() || req.body.devMode) {
            await db.query(
                `UPDATE bookings SET payment_status='Paid', payment_method='Online',
                 cashfree_payment_id='DEV_PAY_${Date.now()}' WHERE id=?`, [req.params.id]);
            return res.json({ success: true, message: 'Payment recorded (dev mode).' });
        }

        // Verify with Cashfree
        const resp = await axios.get(`${cfBase()}/pg/orders/${orderId}/payments`, { headers: cfHeaders() });
        const payments = resp.data;
        const success  = payments.find(p => p.payment_status === 'SUCCESS');
        if (!success) return res.status(400).json({ success: false, message: 'Payment not completed.' });

        await db.query(
            `UPDATE bookings SET payment_status='Paid', payment_method='Online',
             cashfree_order_id=?, cashfree_payment_id=? WHERE id=?`,
            [orderId, success.cf_payment_id, req.params.id]);
        res.json({ success: true, message: 'Payment verified!' });
    } catch (e) {
        console.error('Verify payment error:', e.response?.data || e.message);
        res.status(500).json({ success: false, message: 'Verification failed.' });
    }
};

// PUT /api/bookings/:id/cancel
exports.cancel = async (req, res) => {
    try {
        const [b] = await db.query('SELECT * FROM bookings WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
        if (!b.length) return res.status(404).json({ success: false, message: 'Not found.' });
        if (b[0].status !== 'Pending') return res.status(400).json({ success: false, message: 'Only pending bookings can be cancelled.' });
        await db.query('UPDATE bookings SET status="Cancelled" WHERE id=?', [req.params.id]);
        res.json({ success: true, message: 'Booking cancelled.' });
    } catch (e) { res.status(500).json({ success: false, message: 'Failed.' }); }
};
