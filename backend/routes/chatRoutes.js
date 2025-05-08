const express = require('express');
const router = express.Router();
const { db, getUserGroupsFromDB } = require('../db'); // ✅ Fix here

// Now you can safely use db.query() or getUserGroupsFromDB()
router.get('/some-route', async (req, res) => {
  try {
    db.query('SELECT * FROM users', (err, results) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(results);
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ✅ Get messages for a group
router.get('/group/:group_id/messages', (req, res) => {
    const groupId = req.params.group_id;
    const userId = req.query.user_id;
    const userRole = req.query.user_role;

    if (!userId || !userRole) {
        return res.status(400).json({ error: 'user_id and user_role query parameters are required' });
    }

    let sql;
    let params;

    if (userRole === 'teacher') {
        // Teacher sees all messages in the group
        sql = `
            SELECT m.*, u.name as user_name
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.group_id = ?
            ORDER BY m.created_at ASC
        `;
        params = [groupId];
    } else if (userRole === 'student') {
        // Student sees public messages and private messages sent to them by teachers
        sql = `
            SELECT m.*, u.name as user_name
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.group_id = ?
            AND (
                m.is_private = 0
                OR (m.is_private = 1 AND m.recipient_user_id = ? AND u.role = 'teacher')
            )
            ORDER BY m.created_at ASC
        `;
        params = [groupId, userId];
    } else {
        // Other roles see all messages
        sql = `
            SELECT m.*, u.name as user_name
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.group_id = ?
            ORDER BY m.created_at ASC
        `;
        params = [groupId];
    }

    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ error: 'DB error', details: err.message });
        res.json(results);
    });
});

// ✅ Send a message to a group
// router.post('/group/:group_id/message', (req, res) => {
//     const groupId = req.params.group_id;
//     const { user_id, message } = req.body;

//     if (!user_id || !message) {
//         return res.status(400).json({ error: 'user_id and message are required' });
//     }

//     const sql = `INSERT INTO messages (group_id, user_id, message) VALUES (?, ?, ?)`;

//     db.query(sql, [groupId, user_id, message], (err, result) => {
//         if (err) return res.status(500).json({ error: 'DB error', details: err.message });
//         res.json({ id: result.insertId, group_id: groupId, user_id, message });
//     });
// });

// ✅ Send a message to a group - with membership check
router.post('/group/:group_id/message', (req, res) => {
    const groupId = req.params.group_id;
    const { user_id, message, is_private = 0, recipient_user_id = null } = req.body;

    if (!user_id || !message) {
        return res.status(400).json({ error: 'user_id and message are required' });
    }

    // Step 1: Check if the user is in the group
    const membershipSql = `
        SELECT * FROM group_members 
        WHERE group_id = ? AND user_id = ?
    `;

    db.query(membershipSql, [groupId, user_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'DB error', details: err.message });
        if (results.length === 0) {
            return res.status(403).json({ error: 'User is not a member of this group' });
        }

        // Step 2: Insert message with optional private flag and recipient
        const insertSql = `INSERT INTO messages (group_id, user_id, message, is_private, recipient_user_id) VALUES (?, ?, ?, ?, ?)`;
        db.query(insertSql, [groupId, user_id, message, is_private, recipient_user_id], (err, result) => {
            if (err) return res.status(500).json({ error: 'DB error', details: err.message });
            res.json({ id: result.insertId, group_id: groupId, user_id, message, is_private, recipient_user_id });
        });
    });
});




// ✅ Add a user to a group
router.post('/group/:group_id/user/:user_id', (req, res) => {
    const { group_id, user_id } = req.params;
    const checkSql = `SELECT * FROM group_members WHERE group_id = ? AND user_id = ?`;
    db.query(checkSql, [group_id, user_id], (err, results) => {
        if (err) return res.status(500).json({ error: 'DB error', details: err.message });
        if (results.length > 0) {
            return res.status(400).json({ message: 'User already in group' });
        }

        const insertSql = `INSERT INTO group_members (group_id, user_id) VALUES (?, ?)`;
        db.query(insertSql, [group_id, user_id], (err) => {
            if (err) return res.status(500).json({ error: 'DB error', details: err.message });
            res.json({ message: 'User added to group' });
        });
    });
});

//✅ Remove a user from a group
router.delete('/group/:group_id/user/:user_id', (req, res) => {
    const { group_id, user_id } = req.params;
    const sql = `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`;

    db.query(sql, [group_id, user_id], (err) => {
        if (err) return res.status(500).json({ error: 'DB error', details: err.message });
        res.json({ message: 'User removed from group' });
    });
});

// ✅ Delete a group
router.delete('/group/:group_id', (req, res) => {
    const groupId = req.params.group_id;

    // First delete members of this group to avoid foreign key constraint errors
    const deleteMembers = `DELETE FROM group_members WHERE group_id = ?`;
    db.query(deleteMembers, [groupId], (err) => {
        if (err) return res.status(500).json({ error: 'DB error (members)', details: err.message });

        const deleteGroup = `DELETE FROM groups1 WHERE id = ?`;
        db.query(deleteGroup, [groupId], (err) => {
            if (err) return res.status(500).json({ error: 'DB error (group)', details: err.message });
            res.json({ message: 'Group deleted successfully' });
        });
    });
});


// ✅ Create a new group
router.post('/group', (req, res) => {
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'Group name is required' });

    // Check if group already exists
    const checkSql = `SELECT id FROM groups1 WHERE name = ?`;
    db.query(checkSql, [name], (checkErr, checkResult) => {
        if (checkErr) return res.status(500).json({ error: 'DB check error', details: checkErr.message });

        if (checkResult.length > 0) {
            return res.status(409).json({ error: 'Group already exists' });
        }

        // Insert group if not found
        const insertSql = `INSERT INTO groups1 (name) VALUES (?)`;
        db.query(insertSql, [name], (insertErr, insertResult) => {
            if (insertErr) return res.status(500).json({ error: 'DB insert error', details: insertErr.message });

            res.json({ id: insertResult.insertId, name });
        });
    });
});


// ✅ Get groups of a specific user
router.get('/user/:user_id/groups', (req, res) => {
    const { user_id } = req.params;
    console.log('Fetching groups for user_id:', user_id);
    const sql = `
        SELECT g.id, g.name, g.created_at FROM groups1 g
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
    `;

    db.query(sql, [user_id], (err, results) => {
        if (err) {
            console.error('DB error:', err);
            return res.status(500).json({ error: 'DB error', details: err.message });
        }
        console.log('Query results:', results);
        res.json(results);
    });
});



router.get('/users/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT id, name, email, role FROM users WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('DB error:', err);
            return res.status(500).json({ error: 'DB error', details: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(results[0]);
    });
});

module.exports = router;
