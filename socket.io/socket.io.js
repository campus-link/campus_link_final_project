async function loadGroupChat(groupId, groupName) {
    currentGroupId = groupId;
    document.getElementById('group-title').innerText = groupName;
  
    // Join group on socket
    socket.emit('joinGroup', groupName);
  
    try {
      const res = await fetch(`/messages/${groupId}`);
      const messages = await res.json();
      renderMessages(messages);
    } catch (err) {
      console.error('Error loading messages', err);
    }
  }

  function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message || !currentGroupId) return;
  
    const sender = localStorage.getItem("userName") || "You";
  
    socket.emit('message', {
      groupName: document.getElementById('group-title').innerText,
      sender,
      message
    });
  
    input.value = '';
  }

  
  socket.on('message', ({ sender, message }) => {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.innerHTML = `<strong>${sender}</strong>: ${message}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
  