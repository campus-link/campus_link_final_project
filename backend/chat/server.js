require('dotenv').config(); // ⬅️ THIS MUST BE FIRST

const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const router = express.Router();
// const path = require('path');
const chatRoutes = require('./routes/chatRoutes');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const server = http.createServer(app);
const io = socketIo(server);

app.use('/api', chatRoutes);

console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});
const chatSocket = require('./chat/chatSocket');
chatSocket(io, db); 

// 🔼 After DB connection



db.connect(err => {
    if (err) {
        console.error("❌ MySQL Connection Error:", err);
        process.exit(1);
    }
    console.log('✅ MySQL Connected...');
});








// chat functionality start

db.query(`
    CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT,
        receiver_id INT,
        message TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
`, (err) => {
    if (err) {
        console.error("❌ Error creating messages table:", err);
    }
});

// homepage student registration starts
db.connect((err) => {
    if (err) throw err;
    console.log('MySQL Connected');
    // Create table if not exists
    db.query(`
        CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            batch VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            name VARCHAR(255),
            age INT
        )
    `, (err) => {
        if (err) throw err;
        console.log('Students table ready');
    });
});

app.post('/api/students', (req, res) => {
    const { batch, email, name, age } = req.body;
    const sql = 'INSERT INTO students (batch, email, name, age) VALUES (?, ?, ?, ?)';
    db.query(sql, [batch, email, name, age], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error saving student' });
        }
        res.status(200).json({ message: 'Student saved successfully' });
    });
});
// homepage student registration ends












// Real-time messaging with Socket.io
io.on('connection', (socket) => {
    console.log('a user connected');

    // Listen for incoming messages
    socket.on('sendMessage', (data) => {
        const { senderId, receiverId, message } = data;

        // Insert the message into the database
        db.query('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)', [senderId, receiverId, message], (err) => {
            if (err) {
                console.error('❌ Error inserting message:', err);
            }

            // Emit the message to the receiver
            io.emit('receiveMessage', data);
        });
    });

    // Listen for disconnections
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

// Fetch chat history from the database
app.get('/api/chatHistory', (req, res) => {
    const { senderId, receiverId } = req.query;

    db.query('SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)', 
    [senderId, receiverId, receiverId, senderId], (err, results) => {
        if (err) {
            console.error('❌ Error fetching chat history:', err);
            return res.status(500).json({ message: 'Error fetching chat history' });
        }
        res.json(results);  // Send back the chat history
    });
});


// chat functionality over

//admin group creation start
app.post('/admin/create-group', (req, res) => {
    const { groupName } = req.body;
    db.query('INSERT INTO groups1 (name) VALUES (?)', [groupName], (err, result) => {
        if (err) return res.status(500).json({ message: "Error creating group" });

        const groupId = result.insertId;
        const tableName = `group_${groupId}_messages`;

        // Create a new table for the group
        db.query(`
            CREATE TABLE ${tableName} (
                message_id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                message TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) return res.status(500).json({ message: "Error creating group chat table" });
            res.json({ message: "Group created successfully", groupId });
        });
    });
});

app.delete('/admin/delete-group/:id', (req, res) => {
    const groupId = req.params.id;
  
    // Your logic to delete the group
    // Example:
    const sql = "DELETE FROM groups WHERE id = ?";
    connection.query(sql, [groupId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error deleting group' });
      }
      res.json({ message: 'Group deleted successfully' });
    });
  });
  
  


app.post('/admin/add-user-to-group', (req, res) => {
    const { userId, groupId } = req.body;

    db.query('INSERT INTO group_members (user_id, group_id) VALUES (?, ?)', [userId, groupId], (err) => {
        if (err) {
            console.error("❌ MySQL Insert Error:", err); // 👈 Add this for debugging
            return res.status(500).json({ message: "Error adding user to group", error: err.message });
        }
        res.json({ message: "User added to group successfully" });
    });
});

app.get('/admin/group-members/:groupId', async (req, res) => {
    const groupId = req.params.groupId;
    try {
        const [rows] = await db.promise().execute(`
            SELECT u.id, u.name, u.role 
            FROM users u
            JOIN group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = ?
        `, [groupId]);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch group members" });
    }
});
app.post('/admin/assign-user-to-group', async (req, res) => {
    const { groupId, userId } = req.body;

    if (!groupId || !userId) {
        return res.status(400).json({ message: "Missing groupId or userId" });
    }

    try {
        // Log input data for debugging
        console.log(`Assigning user ${userId} to group ${groupId}`);

        // Check if the user is already assigned to the group
        const result = await db.execute(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );

        // Access _rows from the result
        const rows = result._rows; // Fix: Access rows correctly

        // Log the rows to see the result structure
        console.log('Rows from query:', rows);

        // If the user is already in the group
        if (rows && rows.length > 0) {
            return res.json({ message: "User is already in this group" });
        }

        // If not, insert the user into the group
        await db.execute(
            'INSERT INTO group_members (group_id, user_id) VALUES (?, ?)',
            [groupId, userId]
        );

        res.json({ message: "User successfully assigned to group" });
    } catch (err) {
        console.error('Error assigning user to group:', err);
        res.status(500).json({ message: "Failed to assign user to group", error: err.message });
    }
});
app.post('/admin/remove-user-from-group', async (req, res) => {
    const { userId, groupId } = req.body;

    if (!userId || !groupId) {
        return res.status(400).json({ message: "Missing userId or groupId" });
    }

    try {
        await db.promise().execute(
            'DELETE FROM group_members WHERE user_id = ? AND group_id = ?',
            [userId, groupId]
        );

        res.json({ message: "User successfully removed from group" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to remove user from group" });
    }
});

// Fetch all groups
app.get('/admin/groups', (req, res) => {
    db.query('SELECT * FROM groups1 ORDER BY created_at DESC', (err, results) => {
      if (err) return res.status(500).json({ message: "Error fetching groups" });
      res.json(results);
    });
  });

  //message send

  router.get('/teacher/groups/:teacherId', async (req, res) => {
    const { teacherId } = req.params;

    try {
        // First, check if user is actually a teacher
        const [userCheck] = await db.execute('SELECT role FROM users WHERE id = ?', [teacherId]);

        if (userCheck.length === 0 || userCheck[0].role !== 'Teacher') {
            return res.status(400).json({ error: 'User is not a teacher' });
        }

        // Now, fetch groups assigned to the teacher
        const [groups] = await db.execute(
            `SELECT g.id, g.name
             FROM groups1 g
             JOIN group_members gm ON g.id = gm.group_id
             WHERE gm.user_id = ?`,
            [teacherId]
        );

        res.json(groups);
    } catch (error) {
        console.error('Error fetching teacher groups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


  router.post('/group/:groupId/message', async (req, res) => {
    const { groupId } = req.params;
    const { userId, message } = req.body;

    if (!groupId || !userId || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO messages (group_id, user_id, message, timestamp) VALUES (?, ?, ?, NOW())',
            [groupId, userId, message]
        );

        res.json({ success: true, message: 'Message sent', messageId: result.insertId });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Fetch all messages for a specific group
router.get('/group/:groupId/messages', async (req, res) => {
    const { groupId } = req.params;

    try {
        const [messages] = await db.execute(
            `SELECT m.id, m.message, m.timestamp, u.name as user_name
             FROM messages m
             JOIN users u ON m.user_id = u.id
             WHERE m.group_id = ?
             ORDER BY m.timestamp ASC`,
            [groupId]
        );

        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;

  
  

//admin group creation over

// ✅ Admin Login
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;

    db.query('SELECT * FROM admins WHERE username = ?', [username], async (err, results) => {
        if (err) return res.status(500).json({ message: "Server error" });
        if (results.length === 0) return res.status(401).json({ message: "Invalid credentials" });

        const admin = results[0];

        try {
            const isMatch = await bcrypt.compare(password, admin.password);
            if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

            const token = jwt.sign({ username: admin.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.json({ token });
        } catch (error) {
            console.error("❌ bcrypt error:", error);
            res.status(500).json({ message: "Error comparing password" });
        }
    });
});

// ✅ Token Verification
app.post("/admin/verify", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        res.json({ message: "Authorized", user: decoded.username });
    });
});


// student dashboard group fetching starts

app.get('/student/groups/:studentId', (req, res) => {
    const studentId = req.params.studentId;

    const query = `
        SELECT g.id, g.name
        FROM groups1 g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?
    `;

    db.query(query, [studentId], (err, results) => {
        if (err) {
            console.error('Error fetching groups:', err); // Log the actual error for debugging
            return res.status(500).json({ message: 'Error fetching groups' });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'No groups found for this user' });
        }

        res.json(results);
    });
});

// student dashboard group fetching ends

//teacher dashboard group fetching starts

// Assuming you're using Express.js and a MySQL database

// Route to get groups for a teacher
app.get('/teacher/groups/:teacherId', (req, res) => {
    const teacherId = req.params.teacherId;

    const query = `
        SELECT g.id, g.name
        FROM groups g
        INNER JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_id = ?;
    `;

    console.log(`Fetching groups for teacher ID ${teacherId}`);

    db.query(query, [teacherId], (err, results) => {
        if (err) {
            console.error('Error fetching groups:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }

        res.json(results);
    });
});


//teacher dashboard group fetching ends


//user logins
app.post('/student/login', (req, res) => {
    // check against student table or 'users' with role='student'
});

app.post('/teacher/login', (req, res) => {
    // same logic for teacher
});

app.post('/hr/login', (req, res) => {
    // same logic for hr
});


//user logins

// ✅ CREATE User

// Role-based login validation
// Assuming Express and MySQL are set up
router.post("/login", async (req, res) => {
    const { email, password, role } = req.body;

    try {
        const [rows] = await db.execute("SELECT * FROM users WHERE email = ? AND role = ?", [email, role]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        const user = rows[0];

        // Optional: Add proper password hash comparison
        if (user.password !== password) {
            return res.status(401).json({ success: false, message: "Incorrect password" });
        }

        // Create token (optional, shown here for completeness)
        const token = "dummy-token"; // Replace with actual JWT if needed

        // Determine redirect URL by role
        let redirect = "/student-dashboard.html";
        if (role === "teacher") redirect = "/teacher-dashboard.html";
        if (role === "hr") redirect = "/hr-dashboard.html";

        // Final response
        res.json({
            success: true,
            token,
            role: user.role,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            },
            redirect
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});






// ✅ READ All Users
app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) return res.status(500).json({ message: "Error fetching users" });
        res.json(results);
    });
});

// ✅ UPDATE User
app.post('/users', (req, res) => {
    const { name, email, role, password } = req.body;
    db.query('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)', [name, email, role, password], (err, result) => {
        if (err) return res.status(500).json({ message: "Error creating user" });
        res.json({ id: result.insertId, name, email, role, password });
    });
});

app.put('/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, role, password } = req.body;
    db.query('UPDATE users SET name = ?, email = ?, role = ?, password = ? WHERE id = ?', [name, email, role, password, id], (err) => {
        if (err) return res.status(500).json({ message: "Error updating user" });
        res.json({ message: "User updated", id });
    });
});


// ✅ DELETE User
app.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM users WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ message: "Error deleting user" });
        res.json({ message: "User deleted", id });
    });
});


// ✅ Server Listen
app.listen(5000, () => {
    console.log('🚀 Server running on port 5000');
});
