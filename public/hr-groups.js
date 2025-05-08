document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
        alert("Access denied. Please login as HR.");
        window.location.href = "login.html";
        return;
    }

    fetchGroups();
    fetchUsers();

    document.getElementById("groupForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        await createGroup();
    });

    document.getElementById("filterForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        await fetchUsers();
    });

    // Add event listener to role dropdown to filter users on change
    document.getElementById("filterRole").addEventListener("change", async () => {
        await fetchUsers();
    });

    // Add event listener to stream dropdown to filter users on change
    document.getElementById("filterStream").addEventListener("change", async () => {
        await fetchUsers();
    });

    // Chat functionality integration from user-groups.js

    const groupsCountContainer = document.getElementById('groupsCountContainer');
    const groupsList = document.getElementById('groupsList');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const sendButton = document.getElementById('sendButton');

    const userId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');

    if (!userId || !authToken) {
        groupsCountContainer.innerText = 'User not logged in. Please login first.';
        return;
    }

    // Fetch user info to display greeting (optional for hr-groups)
    // Could add greeting if desired

    let selectedGroupId = null;

    // Fetch and display user groups for chat
    async function fetchChatGroups() {
        try {
const response = await fetch(`https://campus-link-final-project.onrender.com/api/user/${userId}/groups`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch groups');
            const groups = await response.json();
            groupsCountContainer.innerText = `You are a member of ${groups.length} group(s).`;

            groupsList.innerHTML = '';
            if (groups.length > 0) {
                groups.forEach(group => {
                    const li = document.createElement('li');
                    li.textContent = group.name || `Group ID: ${group.id}`;
                    li.dataset.groupId = group.id;
                    li.style.cursor = 'pointer';
                    li.addEventListener('click', () => {
                        selectedGroupId = group.id;
                        loadMessages(selectedGroupId);
                        // Highlight selected group
                        Array.from(groupsList.children).forEach(child => child.classList.remove('active'));
                        li.classList.add('active');
                    });
                    groupsList.appendChild(li);
                });
            } else {
                const li = document.createElement('li');
                li.textContent = 'No groups found.';
                groupsList.appendChild(li);
            }
        } catch (error) {
            groupsCountContainer.innerText = 'Error loading groups. Please try again later.';
            console.error('Error fetching groups:', error);
        }
    }

    // Load messages for a group
    async function loadMessages(groupId) {
        messagesContainer.style.display = 'block';
        messageInput.style.display = 'inline-block';
        fileInput.style.display = 'inline-block';
        sendButton.style.display = 'inline-block';
        messagesContainer.innerHTML = 'Loading messages...';

        try {
const response = await fetch(`https://campus-link-final-project.onrender.com/group/${groupId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch messages');
            const messages = await response.json();

            // Get file messages from localStorage
            const fileMessagesKey = `fileMessages_${groupId}`;
            const fileMessagesJSON = localStorage.getItem(fileMessagesKey);
            const fileMessages = fileMessagesJSON ? JSON.parse(fileMessagesJSON) : [];

            // Combine backend messages and local file messages
            const combinedMessages = [...messages, ...fileMessages];

            displayMessages(combinedMessages);
        } catch (error) {
            messagesContainer.innerText = 'Error loading messages.';
            console.error('Error fetching messages:', error);
        }
    }

    // Display messages in the messages container
    function displayMessages(messages) {
        messagesContainer.innerHTML = '';
        if (messages.length === 0) {
            messagesContainer.innerText = 'No messages in this group.';
            return;
        }
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.classList.add('message');
            if (msg.user_id == userId || msg.userId == userId) {
                div.classList.add('own');
            } else {
                div.classList.add('other');
            }

            if (msg.fileName && msg.fileData) {
                // This is a file message
                const link = document.createElement('a');
                link.textContent = msg.fileName;
                link.href = msg.fileData;
                link.download = msg.fileName;
                link.classList.add('file-link');
                div.appendChild(document.createTextNode(`${msg.name || 'You'} sent a file: `));
                div.appendChild(link);
            } else {
                // Text message
                div.textContent = `${msg.name || 'You'}: ${msg.message}`;
            }
            messagesContainer.appendChild(div);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Send message event
    sendButton.addEventListener('click', async () => {
        if (!selectedGroupId) {
            alert('Please select a group first.');
            return;
        }

        const file = fileInput.files[0];
        const message = messageInput.value.trim();

        if (!message && !file) {
            return; // Nothing to send
        }

        if (file) {
            // Handle file upload locally
            const reader = new FileReader();
            reader.onload = function(e) {
                const fileData = e.target.result;
                const fileMessagesKey = `fileMessages_${selectedGroupId}`;
                const fileMessagesJSON = localStorage.getItem(fileMessagesKey);
                const fileMessages = fileMessagesJSON ? JSON.parse(fileMessagesJSON) : [];

                const newFileMessage = {
                    userId: userId,
                    name: 'You',
                    fileName: file.name,
                    fileData: fileData,
                    timestamp: new Date().toISOString()
                };

                fileMessages.push(newFileMessage);
                localStorage.setItem(fileMessagesKey, JSON.stringify(fileMessages));

                // Clear inputs
                fileInput.value = '';
                messageInput.value = '';

                loadMessages(selectedGroupId);
            };
            reader.readAsDataURL(file);
        } else {
            // Send text message to backend
            try {
const response = await fetch(`https://campus-link-final-project.onrender.com/group/${selectedGroupId}/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({
                        userId: userId,
                        message: message
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to send message');
                }

                messageInput.value = '';
                loadMessages(selectedGroupId);
            } catch (error) {
                alert('Error sending message. Please try again.');
                console.error('Error sending message:', error);
            }
        }
    });

    // Initialize chat groups
    fetchChatGroups();

});

async function createGroup() {
    const groupName = document.getElementById("groupName").value.trim();
    const groupMembersSelect = document.getElementById("groupMembers");
    const selectedOptions = Array.from(groupMembersSelect.selectedOptions);
    const userIds = selectedOptions.map(option => option.value);

    if (!groupName) {
        alert("Group name is required.");
        return;
    }

    if (userIds.length < 2) {
        alert("Please select at least 2 members for the group.");
        return;
    }

    const token = localStorage.getItem("adminToken");

    try {
const res = await fetch("https://campus-link-final-project.onrender.com/admin/create-group", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ groupName: groupName, userIds: userIds }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        alert("Group created successfully.");
        document.getElementById("groupForm").reset();
        fetchGroups();
    } catch (err) {
        alert("Failed to create group: " + err.message);
    }
}

async function fetchGroups() {
    // For now, just log groups. Can be extended to display groups if needed.
    const token = localStorage.getItem("adminToken");
    try {
const res = await fetch("https://campus-link-final-project.onrender.com/groups", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error("Failed to fetch groups");
        const groups = await res.json();
        console.log("Groups:", groups);
    } catch (err) {
        console.error("Error fetching groups:", err.message);
    }
}

async function fetchUsers() {
    const token = localStorage.getItem("adminToken");
    const role = document.getElementById("filterRole").value;
    const stream = document.getElementById("filterStream").value;
    const percentageMin = document.getElementById("filterPercentageMin").value;
    const percentageMax = document.getElementById("filterPercentageMax").value;

    // Build query params
    const params = new URLSearchParams();
    if (role) params.append("role", role);
    if (stream) params.append("stream", stream);
    if (percentageMin) params.append("percentageMin", percentageMin);
    if (percentageMax) params.append("percentageMax", percentageMax);

    try {
const res = await fetch(`https://campus-link-final-project.onrender.com/users?${params.toString()}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error("Failed to fetch users");
        const users = await res.json();

        // Fetch academic details for each user to get stream and percentage
const academicRes = await fetch('https://campus-link-final-project.onrender.com/student-academic-table', {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        if (!academicRes.ok) throw new Error("Failed to fetch academic details");
        const academicDetails = await academicRes.json();

        // Map academic details by student_id for quick lookup
        const academicMap = {};
        academicDetails.forEach(ad => {
            academicMap[ad.student_id] = ad;
        });

        // Merge academic details into users
        const usersWithAcademic = users.map(user => {
            if (user.role === 'student' && academicMap[user.id]) {
                return {
                    ...user,
                    stream: academicMap[user.id].stream,
                    percentage: academicMap[user.id].percentage
                };
            }
            return user;
        });

        renderUsersTable(usersWithAcademic);
    } catch (err) {
        alert("Error fetching users: " + err.message);
    }
}

// Populate stream dropdown from student_academic_table
async function populateStreamDropdown() {
    const token = localStorage.getItem("adminToken");
    try {
        const res = await fetch('http://localhost:5000/student-academic-table', {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error("Failed to fetch academic details");
        const academicDetails = await res.json();

        // Extract distinct streams
        const streamsSet = new Set();
        academicDetails.forEach(ad => {
            if (ad.stream) streamsSet.add(ad.stream);
        });

        const streamDropdown = document.getElementById("filterStream");
        // Clear existing options except the first "All Streams"
        while (streamDropdown.options.length > 1) {
            streamDropdown.remove(1);
        }

        // Add distinct streams as options
        streamsSet.forEach(stream => {
            const option = document.createElement("option");
            option.value = stream;
            option.textContent = stream;
            streamDropdown.appendChild(option);
        });
    } catch (err) {
        console.error("Error populating stream dropdown:", err);
    }
}

// Call populateStreamDropdown on page load
document.addEventListener("DOMContentLoaded", () => {
    populateStreamDropdown();
});

function renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = "";

    users.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.stream || ""}</td>
            <td>${user.percentage || ""}</td>
        `;
        tbody.appendChild(tr);
    });
}
