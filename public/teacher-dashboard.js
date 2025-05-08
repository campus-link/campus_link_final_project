document.addEventListener('DOMContentLoaded', async () => {
    const groupsCountContainer = document.getElementById('groupsCountContainer');
    const groupsList = document.getElementById('groupsList');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const sendButton = document.getElementById('sendButton');
    const greetingContainer = document.getElementById('greetingContainer');

    const profileButton = document.getElementById('profileButton');
    const logoutButton = document.getElementById('logoutButton');

    const userId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');

    if (!userId || !authToken) {
        groupsCountContainer.innerText = 'User not logged in. Please login first.';
        return;
    }

    let loggedInUserRole = null;
    // Fetch user info to display greeting and role
    try {
        const response = await fetch(`http://localhost:5000/users/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user info');
        const user = await response.json();
        console.log("Fetched user info:", user);
        greetingContainer.innerText = `Hey ${user.name}`;
        loggedInUserRole = user.role || null;
        console.log("Logged in user role:", loggedInUserRole);
    } catch (error) {
        greetingContainer.innerText = 'Hey User';
        console.error('Error fetching user info:', error);
    }

    profileButton.addEventListener('click', () => {
        window.location.href = 'profile.html';
    });

    logoutButton.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'multi-login.html';
    });

    let selectedGroupId = null;

    // Fetch and display user groups
    try {
        const response = await fetch(`http://localhost:5000/api/user/${userId}/groups`);
        if (!response.ok) throw new Error('Failed to fetch groups');
        const groups = await response.json();
        groupsCountContainer.innerText = `You are a member of ${groups.length} group(s).`;

        groupsList.innerHTML = '';
        if (groups.length > 0) {
            groups.forEach(group => {
                const li = document.createElement('li');
                li.textContent = group.name || `Group ID: ${group.id}`;
                li.dataset.groupId = group.id;
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

    // Load messages for a group
    async function loadMessages(groupId) {
        messagesContainer.style.display = 'block';
        messageInput.style.display = 'inline-block';
        fileInput.style.display = 'inline-block';
        sendButton.style.display = 'inline-block';
        messagesContainer.innerHTML = 'Loading messages...';

        try {
            const response = await fetch(`http://localhost:5000/group/${groupId}/messages?user_id=${userId}&user_role=${loggedInUserRole}`);
            if (!response.ok) throw new Error('Failed to fetch messages');
            const messages = await response.json();
            console.log("Messages fetched for group", groupId, ":", messages);

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
            console.log("Full message object:", msg);
            console.log("Message keys:", Object.keys(msg));
            console.log("msg.user_name:", msg.user_name);
            console.log("msg.name:", msg.name);
            const div = document.createElement('div');
            div.classList.add('message');
            if (msg.user_id == userId || msg.userId == userId) {
                div.classList.add('own');
            } else {
                div.classList.add('other');
            }

            try {
                const fileData = JSON.parse(msg.message);
                if (fileData.fileName && fileData.fileUrl) {
                    // This is a file message
                    const link = document.createElement('a');
                    link.textContent = fileData.fileName;
                    link.href = fileData.fileUrl;
                    link.download = fileData.fileName;
                    link.classList.add('file-link');
                    const senderLabel = (loggedInUserRole === 'teacher') ? (msg.user_name || msg.name || `User ID ${msg.user_id || 'Unknown'}`) : `User ID ${msg.user_id || 'Unknown'}`;
                    div.appendChild(document.createTextNode(`${senderLabel} sent a file: `));
                    div.appendChild(link);
                } else {
                    const senderLabel = (loggedInUserRole === 'teacher') ? (msg.user_name || msg.name || `User ID ${msg.user_id || 'Unknown'}`) : `User ID ${msg.user_id || 'Unknown'}`;
                    div.textContent = `${senderLabel}: ${msg.message}`;
                }
            } catch (e) {
                // Not a JSON file message, treat as text
                const senderLabel = (loggedInUserRole === 'teacher') ? (msg.user_name || msg.name || `User ID ${msg.user_id || 'Unknown'}`) : `User ID ${msg.user_id || 'Unknown'}`;
                div.textContent = `${senderLabel}: ${msg.message}`;
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
            // Upload file to backend
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', userId);

            try {
                const response = await fetch(`http://localhost:5000/group/${selectedGroupId}/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Failed to upload file');
                }

                // Clear inputs
                fileInput.value = '';
                messageInput.value = '';

                loadMessages(selectedGroupId);
            } catch (error) {
                alert('Error uploading file. Please try again.');
                console.error('Error uploading file:', error);
            }
        } else {
            // Send text message to backend
            try {
                const response = await fetch(`http://localhost:5000/group/${selectedGroupId}/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
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
});
