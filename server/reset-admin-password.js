// Run once after importing DB: node server/reset-admin-password.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const db     = require('./db');

(async () => {
    const hash = await bcrypt.hash('admin123', 10);
    const [r]  = await db.query(
        'UPDATE admin SET password=? WHERE email=?',
        [hash, 'manish@manishautogarage.in']
    );
    if (r.affectedRows > 0) {
        console.log('\n✅ Admin password set!');
        console.log('   Email   : manish@manishautogarage.in');
        console.log('   Password: admin123\n');
    } else {
        // Insert if not exists
        await db.query(
            'INSERT INTO admin (username,email,password) VALUES (?,?,?) ON DUPLICATE KEY UPDATE password=?',
            ['manish','manish@manishautogarage.in', hash, hash]
        );
        console.log('\n✅ Admin created!  Password: admin123\n');
    }
    process.exit(0);
})();
