// server/db.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'manish_garage',
    port:     process.env.DB_PORT     || 3306,
    waitForConnections: true,
    connectionLimit:    10
});

module.exports = pool;
