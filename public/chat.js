$(document).ready(function() {
  const socket = io();

  // Fetch user groups when the page loads (replace `userId` with the actual logged-in user id)
  const userId = 24; // Replace with actual user ID
  $.get(`/api/user/${userId}/groups`, function(response) {
      if (response.success) {
          const groups = response.groups;
          groups.forEach(group => {
              $('#groupList').append(`<button class="btn btn-info" onclick="loadGroupMessages(${group.id})">${group.name}</button>`);
          });
      } else {
          console.error('Failed to load groups');
      }
  });

  // Load messages for a specific group
  window.loadGroupMessages = function(groupId) {
      $.get(`/api/group/${groupId}/messages`, function(response) {
          if (response.success) {
              $('#messagesList').empty();
              response.messages.forEach(message => {
                  $('#messagesList').append(`<p><strong>${message.sender_id}</strong>: ${message.message}</p>`);
              });
          } else {
              console.error('Failed to load messages');
          }
      });

      // Enable the Send Message button for that group
      $('#sendMessageBtn').off('click').on('click', function() {
          const message = $('#messageInput').val();
          const userId = 24; // Replace with actual user ID
          $.post(`/api/group/${groupId}/message`, { user_id: userId, message: message }, function(response) {
              if (response.success) {
                  socket.emit('sendMessage', { senderId: userId, receiverId: groupId, message: message });
                  $('#messageInput').val('');
              } else {
                  console.error('Failed to send message');
              }
          });
      });
  };

  // Listen for new messages from Socket.io
  socket.on('receiveMessage', function(data) {
      $('#messagesList').append(`<p><strong>${data.senderId}</strong>: ${data.message}</p>`);
  });
});
