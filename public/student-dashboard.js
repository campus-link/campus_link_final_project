document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-btn');
    const profileButton = document.getElementById('profile-btn');
    const groupsList = document.getElementById('groups-list');
    const chatBox = document.getElementById('chat-box');
    const chatTitle = document.getElementById('chat-title');
    const messageInput = document.getElementById('message-input');
    const sendMessageButton = document.getElementById('send-message-btn');

    const studentId = 27; // 🔄 Replace with dynamic value from session or backend
    let currentGroupId = null;
    let currentGroupName = '';

    // 🔄 Fetch the groups the student is part of
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

    // ✅ Load chat for selected group
    function loadChat(groupId, groupName) {
        currentGroupId = groupId;
        currentGroupName = groupName;
        chatTitle.textContent = `Chat for ${groupName}`;
        chatBox.innerHTML = ''; // Clear old messages

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

    // ✅ Send a new message
    sendMessageButton.addEventListener('click', () => {
        const message = messageInput.value.trim();

        if (!currentGroupId) {
            alert('Please select a group before sending a message.');
            return;
        }

        if (message !== '') {
            fetch(`/group/${currentGroupId}/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: studentId,
                    message: message
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Message sent:', data);
                messageInput.value = '';
                loadChat(currentGroupId, currentGroupName); // Refresh chat
            })
            .catch(err => console.error('Error sending message:', err));
        }
    });

    // ✅ Logout functionality
    logoutButton.addEventListener('click', () => {
        // Example: Clear session/cookie here if needed
        window.location.href = '/login'; // Redirect to login page
    });

    // ✅ Profile navigation
    profileButton.addEventListener('click', () => {
        window.location.href = '/profile'; // Redirect to profile page
    });
});
