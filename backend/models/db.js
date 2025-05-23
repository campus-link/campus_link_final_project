const mysql = require('mysql2');
require('dotenv').config();

// Create a connection to the database
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('❌ Database Connection Failed:', err);
        return;
    }
    console.log('✅ MySQL Connected Successfully...');
});

module.exports = db;
