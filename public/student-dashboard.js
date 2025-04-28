document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-btn');
    const profileButton = document.getElementById('profile-btn');
    const groupsList = document.getElementById('groups-list');
    const chatBox = document.getElementById('chat-box');
    const chatTitle = document.getElementById('chat-title');
    const messageInput = document.getElementById('message-input');
    const sendMessageButton = document.getElementById('send-message-btn');

    const studentId = 27; // This should be dynamically set based on logged-in user

    // Fetch groups the student is part of
    fetch(`/student/groups/${studentId}`)
        .then(response => response.json())
        .then(groups => {
            if (groups.length > 0) {
                groups.forEach(group => {
                    const listItem = document.createElement('li');
                    listItem.textContent = group.name;
                    listItem.addEventListener('click', () => loadChat(group.id, group.name));
                    groupsList.appendChild(listItem);
                });
            } else {
                const noGroupsItem = document.createElement('li');
                noGroupsItem.textContent = 'No groups available';
                groupsList.appendChild(noGroupsItem);
            }
        })
        .catch(err => console.error('Error fetching groups:', err));

    // Load the chat for the selected group
    function loadChat(groupId, groupName) {
        chatTitle.textContent = `Chat for ${groupName}`;
        chatBox.innerHTML = ''; // Clear previous messages

        // Fetch messages for this group
        fetch(`/group/${groupId}/messages`)
            .then(response => response.json())
            .then(messages => {
                if (messages.length > 0) {
                    messages.forEach(message => {
                        const messageDiv = document.createElement('div');
                        messageDiv.textContent = `${message.user_name}: ${message.message}`;
                        chatBox.appendChild(messageDiv);
                    });
                } else {
                    const noMessagesItem = document.createElement('div');
                    noMessagesItem.textContent = 'No messages in this group yet.';
                    chatBox.appendChild(noMessagesItem);
                }
            })
            .catch(err => console.error('Error fetching messages:', err));
    }

    // Send a new message
    sendMessageButton.addEventListener('click', () => {
        const groupId = 1; // Replace with actual groupId based on selected group
        const message = messageInput.value.trim();

        if (message !== '') {
            fetch(`/group/${groupId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: studentId, message: message })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Message sent:', data);
                loadChat(groupId, chatTitle.textContent.split(' ')[2]); // Reload chat with latest messages
            })
            .catch(err => console.error('Error sending message:', err));
        }
    });

    // Logout functionality
    logoutButton.addEventListener('click', () => {
        // Implement logout logic here (e.g., clear session, cookies)
        window.location.href = '/login'; // Redirect to login page
    });

    // Profile functionality
    profileButton.addEventListener('click', () => {
        // Implement profile view logic here (e.g., navigate to profile page)
        window.location.href = '/profile'; // Redirect to profile page
    });
});
