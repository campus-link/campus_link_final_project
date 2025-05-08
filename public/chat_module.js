// chat_module.js

const authToken = localStorage.getItem("authToken");
const userId = localStorage.getItem("userId");

let currentGroupId = null;

const groupListEl = document.getElementById("groupList");
const chatMessagesEl = document.getElementById("chatMessages");
const messageInputEl = document.getElementById("messageInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const currentGroupNameEl = document.getElementById("currentGroupName");

// Fetch groups for the user
async function fetchGroups() {
  try {
    const res = await fetch(`http://localhost:5000/groups/user/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const groups = await res.json();
    groupListEl.innerHTML = "";
    groups.forEach((group) => {
      const groupEl = document.createElement("a");
      groupEl.href = "#";
      groupEl.className = "list-group-item list-group-item-action border-0";
      groupEl.textContent = group.name;
      groupEl.addEventListener("click", () => {
        currentGroupId = group.id;
        currentGroupNameEl.textContent = group.name;
        fetchMessages(group.id);
      });
      groupListEl.appendChild(groupEl);
    });
  } catch (err) {
    console.error("Error loading groups:", err);
  }
}

// Fetch messages for the selected group
async function fetchMessages(groupId) {
  try {
    const res = await fetch(`http://localhost:5000/messages/${groupId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const messages = await res.json();
    renderMessages(messages);
  } catch (err) {
    console.error("Error loading messages:", err);
  }
}

// Render messages in chat
function renderMessages(messages) {
  chatMessagesEl.innerHTML = "";
  messages.forEach((msg) => {
    const msgDiv = document.createElement("div");
    msgDiv.className =
      msg.sender_id == userId
        ? "chat-message-right pb-4"
        : "chat-message-left pb-4";

    msgDiv.innerHTML = `
      <div>
        <img src="https://bootdey.com/img/Content/avatar/avatar1.png" class="rounded-circle mr-1" alt="${msg.sender_name}" width="40" height="40">
        <div class="text-muted small text-nowrap mt-2">${new Date(
          msg.created_at
        ).toLocaleTimeString()}</div>
      </div>
      <div class="flex-shrink-1 bg-light rounded py-2 px-3 ml-3">
        <div class="font-weight-bold mb-1">${msg.sender_name}</div>
        ${msg.content}
      </div>`;

    chatMessagesEl.appendChild(msgDiv);
  });
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

// Send new message
sendMessageBtn.addEventListener("click", async () => {
  const content = messageInputEl.value.trim();
  if (!content || !currentGroupId) return;

  try {
    const res = await fetch("http://localhost:5000/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        groupId: currentGroupId,
        senderId: userId,
        content,
      }),
    });

    const newMsg = await res.json();
    messageInputEl.value = "";
    fetchMessages(currentGroupId);
  } catch (err) {
    console.error("Failed to send message:", err);
  }
});

// On page load
if (userId && authToken) {
  fetchGroups();
} else {
  alert("Unauthorized. Please login again.");
  window.location.href = "login.html";
}