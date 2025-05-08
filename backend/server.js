require('dotenv').config(); // ⬅️ THIS MUST BE FIRST

const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { error } = require('console');
const socketIo = require('socket.io');
const router = express.Router();

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
        req.user = user;
        next();
    });
};

// const quickAccessRoutes = require('./routes/quickAccessRoutes'); // Include the new routes file

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// MySQL Connection
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error("❌ MySQL Connection Error:", err);
        process.exit(1);
    }
    console.log('✅ MySQL Connected...');
});



// Pass db to chatRoutes
const chatRoutes = require('./routes/chatRoutes');
chatRoutes.db = db; // inject db manually if needed
app.use('/api', chatRoutes);

// Mount pendingstudent routes
const pendingStudentRoutes = require('./routes/pendingstudent');
app.use('/', pendingStudentRoutes);

// Optional: Example base route
app.get('/', (req, res) => {
    res.send("CampusLink backend is running");
});


const nodemailer = require("nodemailer");
// You can use your Gmail or another SMTP
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "campuslinkp@gmail.com",        // 👉 your email
        pass: "lqwq sblp jlbk ofbb",           // 👉 app-specific password, not your login password
    }
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
    const { groupName, userIds } = req.body;

    if (!groupName) {
        return res.status(400).json({ message: "Group name is required" });
    }

    if (!Array.isArray(userIds) || userIds.length < 2) {
        return res.status(400).json({ message: "At least 2 members are required to create a group" });
    }

    db.query('INSERT INTO groups1 (name) VALUES (?)', [groupName], (err, result) => {
        if (err) return res.status(500).json({ message: "Error creating group" });

        const groupId = result.insertId;
        const tableName = `group_${groupId}_messages`;

        // Insert group members
        const memberValues = userIds.map(userId => [userId, groupId]);
        db.query('INSERT INTO group_members (user_id, group_id) VALUES ?', [memberValues], (err) => {
            if (err) {
                return res.status(500).json({ message: "Error adding members to group" });
            }

            // Create a new table for the group chat messages
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



app.post('/group/:groupId/message', (req, res) => {
    const { groupId } = req.params;
    const { userId, message } = req.body;

    const tableName = `group_${groupId}_messages`;
    db.query(`
        INSERT INTO ${tableName} (user_id, message) VALUES (?, ?)
    `, [userId, message], (err) => {
        if (err) return res.status(500).json({ message: "Error sending message" });
        res.json({ message: "Message sent successfully" });
    });
});

app.get('/group/:groupId/messages', (req, res) => {
    const { groupId } = req.params;
    const tableName = `group_${groupId}_messages`;

    db.query(`
        SELECT gm.message_id, gm.message, gm.timestamp, u.id as user_id, u.name 
        FROM ${tableName} gm
        JOIN users u ON gm.user_id = u.id
        ORDER BY gm.timestamp ASC
    `, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Error fetching messages" });
        }
        res.json(results);
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
app.post('/user/login', (req, res) => {
    const { email, password, role } = req.body;

    if (!['student', 'teacher', 'hr'].includes(role)) {
        return res.status(400).json({ message: "Invalid role specified" });
    }

    db.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, role], (err, results) => {
        if (err) return res.status(500).json({ message: "Server error" });
        if (results.length === 0) return res.status(401).json({ message: "Invalid credentials for specified role" });

        const user = results[0];

        if (user.password !== password) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            token,
            role: user.role,
            userId: user.id,
            redirect: `/${user.role}-dashboard.html`
        });
    });
});







// ✅ READ All Users with filtering support

app.get('/users', (req, res) => {
    const { role, stream, percentageMin, percentageMax } = req.query;

    let query = `
        SELECT u.id, u.name, u.email, u.role, sat.stream, sat.percentage
        FROM users u
        LEFT JOIN student_academic_table sat ON u.id = sat.student_id
        WHERE 1=1
    `;

    const params = [];

    if (role) {
        query += ' AND u.role = ?';
        params.push(role);
    }

    if (stream) {
        query += ' AND sat.stream = ?';
        params.push(stream);
    }

    if (percentageMin) {
        query += ' AND CAST(sat.percentage AS DECIMAL(5,2)) >= ?';
        params.push(percentageMin);
    }

    if (percentageMax) {
        query += ' AND CAST(sat.percentage AS DECIMAL(5,2)) <= ?';
        params.push(percentageMax);
    }

    db.query(query, params, (err, results) => {
        if (err) {
            console.error("Error fetching users with filters:", err);
            return res.status(500).json({ message: "Error fetching users" });
        }
        res.json(results);
    });
});

// GET user by id
app.get('/users/:id', (req, res) => {
    const { id } = req.params;
    db.query('SELECT id, name, email, role FROM users WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ message: "Error fetching user" });
        if (results.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(results[0]);
    });
});

// ✅ CREATE User
app.post('/users', (req, res) => {
    const { name, email, role, password } = req.body;
    db.query('INSERT INTO users (name, email, role, password) VALUES (?, ?, ?, ?)', [name, email, role, password], (err, result) => {
        if (err) return res.status(500).json({ message: "Error creating user" });
        res.json({ id: result.insertId, name, email, role, password });
    });
});

// UPDATE User - only name and password, exclude email and role
app.put('/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, password } = req.body;

    if (!name) {
        return res.status(400).json({ message: "Name is required" });
    }

    if (password && password.trim() !== '') {
        // Update name and password
        db.query('UPDATE users SET name = ?, password = ? WHERE id = ?', [name, password, id], (err) => {
            if (err) return res.status(500).json({ message: "Error updating user" });
            res.json({ message: "User updated", id });
        });
    } else {
        // Update only name
        db.query('UPDATE users SET name = ? WHERE id = ?', [name, id], (err) => {
            if (err) return res.status(500).json({ message: "Error updating user" });
            res.json({ message: "User updated", id });
        });
    }
});


// ✅ DELETE User
app.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    db.query('DELETE FROM users WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ message: "Error deleting user" });
        res.json({ message: "User deleted", id });
    });
});


// new functionality adding if it does not works we will delete this 


app.use(cors());
app.use(express.json()); // Parse JSON request body

// API to insert student into pending_students table
// app.post('/api/submit-student', (req, res) => {
//     const { name, email, password } = req.body;

//     if (!name || !email || !password) {
//         return res.status(400).json({ error: 'All fields are required' });
//     }

//     db.query(
//         'INSERT INTO pending_students (name, email, password) VALUES (?, ?, ?)',
//         [name, email, password],
//         (err) => {
//             if (err) {
//                 console.error('Error inserting data:', err);
//                 return res.status(500).json({ error: 'Database insertion failed' });
//             }
//             res.status(200).json({ message: 'Student registered successfully' });
//         }
//     );
// });


// Use the pending-students route
// const pendingStudentRoutes = require("./routes/pendingstudent");
app.use(pendingStudentRoutes);


//Route to Accept a Student (Move to users Table)
// app.post('/accept-student/:id', async (req, res) => {
//     const studentId = req.params.id;
//     try {
//         // Step 1: Get student data from pending_students
//         const [rows] = await db.promise().query("SELECT * FROM pending_students WHERE id = ?", [studentId]);
//         if (rows.length === 0) {
//             return res.status(404).json({ message: "Student not found" });
//         }

//         const student = rows[0];

//         // Step 2: Insert into users table
//         await db.promise().query(
//             "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
//             [student.name, student.email, student.password, 'student']
//         );

//         // Step 3: Delete from pending_students
//         await db.promise().query("DELETE FROM pending_students WHERE id = ?", [studentId]);

//         res.json({ message: "Student accepted successfully" });
//     } catch (err) {
//         console.error("Error accepting student:", err);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });

//Route to Reject a Student (Delete from pending_students)
// app.delete('/reject-student/:id', async (req, res) => {
//     const studentId = req.params.id;
//     try {
//         await db.promise().query("DELETE FROM pending_students WHERE id = ?", [studentId]);
//         res.json({ message: "Student rejected and deleted successfully" });
//     } catch (err) {
//         console.error("Error rejecting student:", err);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });
// code for pending student approval and rejection with nodemailer start

// API to insert student into pending_students table

app.post('/api/submit-student', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        // Use existing db connection instead of creating new one
        await db.promise().execute(
            'INSERT INTO pending_students (name, email, password) VALUES (?, ?, ?)',
            [name, email, password]
        );

        // Send Pending Registration Email
        const mailOptions = {
            from: '"CampusLink Admin" <your-email@gmail.com>',
            to: email,
            subject: "CampusLink Registration Received",
            html: `
          <p>Hi ${name},</p>
          <p>Your registration request has been received and is currently <strong>pending approval</strong>.</p>
          <p>You’ll receive another email once it is reviewed by our team.</p>
          <br>
          <p>Thanks,<br/>CampusLink Team</p>
        `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('Failed to send pending email:', err);
                // You may choose to respond with success even if email fails
            } else {
                console.log('Pending email sent:', info.response);
            }
        });

        res.status(200).json({ message: 'Student registered successfully' });
    } catch (error) {
        console.error('Error inserting data:', error);
        res.status(500).json({ error: 'Database insertion failed' });
    }
});




// Use the pending-students route
// const pendingStudentRoutes = require("./routes/pendingstudent");
app.use(pendingStudentRoutes);



//Route to Accept a Student (Move to users Table)
app.post('/accept-student/:id', async (req, res) => {
    const studentId = req.params.id;
    try {
        console.log("Fetching student by ID:", studentId);
        const [rows] = await db.promise().query("SELECT * FROM pending_students WHERE id = ?", [studentId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }

        const student = rows[0];
        console.log("Student found:", student);

        console.log("Inserting into users table...");
        await db.promise().query(
            "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
            [student.name, student.email, student.password, 'student']
        );

        console.log("Deleting from pending_students...");
        await db.promise().query("DELETE FROM pending_students WHERE id = ?", [studentId]);

        console.log("Preparing to send email...");

        const mailOptions = {
            from: '"CampusLink Admin" <your-email@gmail.com>',
            to: student.email,
            subject: "CampusLink - Registration Accepted 🎉",
            html: `
                <p>Hi ${student.name},</p>
                <p>Your registration has been <strong>approved</strong>!</p>
                <p>You can now log in using the credentials below:</p>
                <ul>
                    <li><strong>Email:</strong> ${student.email}</li>
                    <li><strong>Password:</strong> ${student.password}</li>
                </ul>
                <p>Welcome aboard!</p>
                <br>
                <p>Regards,<br/>CampusLink Team</p>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("Error sending email:", error);
            } else {
                console.log("Email sent:", info.response);
            }
        });

        res.json({ message: "Student accepted and email sent successfully" });

    } catch (err) {
        console.error("🔥 Error in accept-student route:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});





//Route to Reject a Student (Delete from pending_students)

app.delete('/reject-student/:id', async (req, res) => {
    const studentId = req.params.id;

    try {
        // Fetch the student's email and name before deletion
        const [rows] = await db.promise().query(
            "SELECT name, email FROM pending_students WHERE id = ?",
            [studentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }

        const { name, email } = rows[0];

        // Delete the student
        await db.promise().query("DELETE FROM pending_students WHERE id = ?", [studentId]);

        // Send rejection email
        const mailOptions = {
            from: '"CampusLink Admin" <your-email@gmail.com>',
            to: email,
            subject: "CampusLink Registration Rejected",
            html: `
        <p>Hi ${name},</p>
        <p>We regret to inform you that your registration request has been <strong>rejected</strong> by the admin.</p>
        <p>If you believe this was a mistake or would like to try again, please contact support or reapply.</p>
        <br>
        <p>Regards,<br/>CampusLink Team</p>
      `
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error("Failed to send rejection email:", err);
            } else {
                console.log("Rejection email sent:", info.response);
            }
        });

        res.json({ message: "Student rejected and deleted successfully" });
    } catch (err) {
        console.error("Error rejecting student:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});





//nodemailer setup



// code for pending student approval and rejection with nodemailer end



//////////////////////////////

// function authenticateToken(req, res, next) {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];
//     if (!token) return res.status(401).json({ message: 'Unauthorized: No token provided' });

//     jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
//         if (err) return res.status(403).json({ message: 'Forbidden: Invalid token' });
//         req.user = user;
//         next();
//     });

 // Create student_academic_table if not exists
db.query(`
    CREATE TABLE IF NOT EXISTS student_academic_table (
        roll_number VARCHAR(255) PRIMARY KEY,
        student_id INT NOT NULL,
        stream VARCHAR(255),
        percentage VARCHAR(255),
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
`, (err) => {
    if (err) {
        console.error("❌ Error creating student_academic_table:", err);
    } else {
        console.log("✅ student_academic_table ensured");
    }
});

// Get all student academic details with student info
app.get('/student-academic-table', authenticateToken, (req, res) => {
    const query = `
        SELECT sat.roll_number, sat.student_id, sat.stream, sat.percentage, u.name, u.email
        FROM student_academic_table sat
        JOIN users u ON sat.student_id = u.id
        WHERE u.role = 'student'
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ message: "Error fetching student academic details" });
        res.json(results);
    });
});

// Get academic details by student_id
app.get('/student-academic-table/:student_id', authenticateToken, (req, res) => {
    const { student_id } = req.params;
    const query = `
        SELECT roll_number, student_id, stream, percentage
        FROM student_academic_table
        WHERE student_id = ?
    `;
    db.query(query, [student_id], (err, results) => {
        if (err) return res.status(500).json({ message: "Error fetching academic details" });
        if (results.length === 0) return res.status(404).json({ message: "Academic details not found" });
        res.json(results[0]);
    });
});

app.post('/student-academic-table', authenticateToken, (req, res) => {
    const { originalRollNumber, roll_number, student_id, stream, percentage } = req.body;
    if (!roll_number || !student_id) {
        return res.status(400).json({ message: "roll_number and student_id are required" });
    }

    if (originalRollNumber && originalRollNumber !== roll_number) {
        // If roll_number changed, delete old record and insert new
        db.query('DELETE FROM student_academic_table WHERE roll_number = ?', [originalRollNumber], (err) => {
            if (err) return res.status(500).json({ message: "Error updating academic details" });

            const insertQuery = `
                INSERT INTO student_academic_table (roll_number, student_id, stream, percentage)
                VALUES (?, ?, ?, ?)
            `;
            db.query(insertQuery, [roll_number, student_id, stream, percentage], (err) => {
                if (err) return res.status(500).json({ message: "Error saving academic details" });
                res.json({ message: "Academic details updated" });
            });
        });
    } else {
        // Upsert logic: insert or update if exists
        const query = `
            INSERT INTO student_academic_table (roll_number, student_id, stream, percentage)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                student_id = VALUES(student_id),
                stream = VALUES(stream),
                percentage = VALUES(percentage)
        `;
        db.query(query, [roll_number, student_id, stream, percentage], (err) => {
            if (err) return res.status(500).json({ message: "Error saving academic details" });
            res.json({ message: "Academic details saved" });
        });
    }
});

// Delete academic details by roll_number
app.delete('/student-academic-table/:roll_number', authenticateToken, (req, res) => {
    const { roll_number } = req.params;
    db.query('DELETE FROM student_academic_table WHERE roll_number = ?', [roll_number], (err) => {
        if (err) return res.status(500).json({ message: "Error deleting academic details" });
        res.json({ message: "Academic details deleted" });
    });
});


// ✅ Server Listen
app.listen(5000, () => {
    console.log('🚀 Server running on port 5000');
});
