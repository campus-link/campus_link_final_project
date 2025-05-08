const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const { db } = require('../db');



// ✅ Fetch all pending students
router.get("/pending-students", (req, res) => {
    const query = "SELECT * FROM pending_students";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error fetching pending students:", err);
            return res.status(500).json({ message: "Server error" });
        }
        res.json(results);
    });
});

module.exports = router;