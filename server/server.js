// server/server.js
require('dotenv').config();
//require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express      = require('express');
const session      = require('express-session');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'mag_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Serve all HTML/CSS/JS files
app.use(express.static(path.join(__dirname, '..')));

// API routes
app.use('/api/users',    require('./routes/userRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/admin',    require('./routes/adminRoutes'));

// Page routes
app.get('/',                (req, res) => res.sendFile(path.join(__dirname, '../index.html')));
app.get('/login',           (req, res) => res.sendFile(path.join(__dirname, '../login.html')));
app.get('/booking',         (req, res) => res.sendFile(path.join(__dirname, '../booking.html')));
app.get('/dashboard',       (req, res) => res.sendFile(path.join(__dirname, '../dashboard.html')));
app.get('/confirmation',    (req, res) => res.sendFile(path.join(__dirname, '../confirmation.html')));
app.get('/admin',           (req, res) => res.sendFile(path.join(__dirname, '../admin/login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, '../admin/dashboard.html')));
app.get('/admin/bookings',  (req, res) => res.sendFile(path.join(__dirname, '../admin/bookings.html')));

app.use((req, res) => res.status(404).send('<h2>404 - Page not found</h2><a href="/">Go Home</a>'));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success: false, message: 'Server error.' }); });

app.listen(PORT, () => {
    console.log('\n🏍️  Manish Auto Garage Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅  Running at : http://localhost:${PORT}`);
    console.log(`👤  User login : http://localhost:${PORT}/login`);
    console.log(`🔧  Admin      : http://localhost:${PORT}/admin`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

module.exports = app;
