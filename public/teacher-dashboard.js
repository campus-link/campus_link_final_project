document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-btn');
    const profileButton = document.getElementById('profile-btn');
    const groupsList = document.getElementById('groups-list');
    const chatBox = document.getElementById('chat-box');
    const chatTitle = document.getElementById('chat-title');
    const messageInput = document.getElementById('message-input');
    const sendMessageButton = document.getElementById('send-message-btn');

    const teacherId = 27; // Replace with dynamic teacherId after login
    let currentGroupId = null; // NEW: Store the currently selected group ID

    // Fetch groups the teacher is part of
    fetch(`/teacher/groups/${teacherId}`)
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
        currentGroupId = groupId; // ✅ Set currentGroupId when a group is clicked
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
        const message = messageInput.value.trim();

        if (message !== '' && currentGroupId !== null) {
            fetch(`/group/${currentGroupId}/message`, { // ✅ Send message to currently selected group
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: teacherId, message: message })
            })
            .then(response => response.json())
            .then(data => {
                console.log('Message sent:', data);
                loadChat(currentGroupId, chatTitle.textContent.split('Chat for ')[1]); // Reload chat
                messageInput.value = ''; // Clear the input after sending
            })
            .catch(err => console.error('Error sending message:', err));
        }
    });

    // Logout functionality
    logoutButton.addEventListener('click', () => {
        window.location.href = '/login';
    });

    // Profile functionality
    profileButton.addEventListener('click', () => {
        window.location.href = '/profile';
    });
});
