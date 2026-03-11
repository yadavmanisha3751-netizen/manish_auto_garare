-- ============================================================
-- MANISH AUTO GARAGE — DATABASE
-- Run: node server/reset-admin-password.js  after import
-- ============================================================

CREATE DATABASE IF NOT EXISTS railway;
USE railway;

-- Admin table
CREATE TABLE IF NOT EXISTS admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users (phone OTP login — no email/password needed)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(15) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) DEFAULT 'Motorcycle',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTP sessions
CREATE TABLE IF NOT EXISTS otp_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(15) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone (phone)
);

-- Services
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    duration_minutes INT DEFAULT 30,
    category VARCHAR(50) DEFAULT 'General',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings (one booking = one vehicle + one date/time, many services)
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vehicle_type VARCHAR(50) DEFAULT 'Motorcycle',
    vehicle_make VARCHAR(100) NOT NULL,
    vehicle_model VARCHAR(100) NOT NULL,
    vehicle_year YEAR NOT NULL,
    vehicle_plate VARCHAR(50) NOT NULL,
    booking_date DATE NOT NULL,
    booking_time TIME NOT NULL,
    notes TEXT,
    status ENUM('Pending','In Progress','Completed','Cancelled') DEFAULT 'Pending',
    payment_status ENUM('Unpaid','Paid') DEFAULT 'Unpaid',
    payment_method VARCHAR(50) DEFAULT NULL,
    cashfree_order_id VARCHAR(100) DEFAULT NULL,
    cashfree_payment_id VARCHAR(100) DEFAULT NULL,
    bill_labour DECIMAL(10,2) DEFAULT NULL,
    bill_parts DECIMAL(10,2) DEFAULT NULL,
    bill_gst DECIMAL(10,2) DEFAULT NULL,
    bill_amount DECIMAL(10,2) DEFAULT NULL,
    bill_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Booking ↔ Services (many-to-many: one booking can have multiple services)
CREATE TABLE IF NOT EXISTS booking_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    service_id INT NOT NULL,
    price_at_booking DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- ── Admin seed (run reset-admin-password.js to set password) ──
INSERT INTO admin (username, email, password) VALUES
('manish', 'manish@manishautogarage.in', 'PLACEHOLDER');

-- ── Services seed (19 two-wheeler services, INR) ──
INSERT INTO services (name, description, price, duration_minutes, category) VALUES
('Engine Oil Change',          'Premium oil change with filter replacement',               350.00,  30, 'Engine'),
('Engine Tune-Up',             'Spark plug, air filter, carburettor full tune',            799.00,  90, 'Engine'),
('Carburettor Cleaning',       'Deep carb cleaning and jetting',                           450.00,  60, 'Engine'),
('Engine Overhaul',            'Full dismantling, gasket replacement, reassembly',        3500.00, 240, 'Engine'),
('Brake Shoe/Pad Replacement', 'Front and rear brake shoe or disc pad replacement',        350.00,  45, 'Brakes'),
('Brake Cable Replacement',    'New brake cable fitting with adjustment',                  150.00,  20, 'Brakes'),
('Tyre Change & Balancing',    'Remove, fit and balance tyre (tube extra if needed)',      150.00,  30, 'Tyres'),
('Puncture Repair',            'Tube or tubeless tyre puncture repair',                     80.00,  20, 'Tyres'),
('Wheel Alignment',            'Computerised wheel alignment for better mileage',          200.00,  30, 'Tyres'),
('Battery Replacement',        'New battery fitting with terminal cleaning',               200.00,  20, 'Electricals'),
('Headlight / Taillight Fix',  'Bulb replacement or wiring fault repair',                  150.00,  30, 'Electricals'),
('Self-Start Motor Repair',    'Starter motor cleaning or full repair',                    500.00,  60, 'Electricals'),
('Wiring Repair',              'Short circuit diagnosis and harness repair',               400.00,  60, 'Electricals'),
('Full Service (Basic)',        'Oil, chain lube, brake check, air pressure and wash',     599.00,  90, 'Service'),
('Full Service (Premium)',      'Basic + carb, spark plug, all filters and greasing',      999.00, 120, 'Service'),
('Chain Lubrication & Adjust', 'Clean, lube and adjust drive chain',                      100.00,  20, 'Service'),
('Clutch Cable Replacement',   'New clutch cable fitting with adjustment',                 150.00,  25, 'Service'),
('Suspension Service',         'Front fork oil change and rear shock absorber check',     600.00,  60, 'Service'),
('Silencer / Exhaust Repair',  'Exhaust pipe repair, welding or replacement',             400.00,  45, 'Service');

-- ── Sample users ──
INSERT INTO users (full_name, phone, vehicle_type) VALUES
('Rahul Sharma', '+919876543210', 'Motorcycle'),
('Priya Patil',  '+919823456789', 'Scooter');
