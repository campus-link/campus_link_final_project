// db.js
require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Error:", err);
    return;
  }
  console.log("✅ MySQL connected successfully!");
});

// Optional helper
async function getUserGroupsFromDB(userId) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM groups WHERE user_id = ?';
    db.query(query, [userId], (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

module.exports = {
  db,
  getUserGroupsFromDB
};
