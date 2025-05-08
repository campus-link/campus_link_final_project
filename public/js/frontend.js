const baseURL = "http://localhost:5000"; // Replace with your actual backend URL

// Fetch groups for the logged-in user
export async function getUserGroups(userId) {
    try {
        const res = await fetch(`${baseURL}/groups/user/${userId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch groups');
        return data.groups || [];
    } catch (err) {
        console.error('Error fetching groups:', err.message);
        return [];
    }
}

// Fetch messages for a specific group
export async function getMessagesForGroup(groupId) {
    try {
        const response = await fetch(`${baseURL}/group/${groupId}/messages`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Failed to fetch messages.");
        }
        return data;
    } catch (error) {
        console.error("Error fetching messages:", error);
        alert("Error fetching messages.");
    }
}

// Send a message to a group
export async function sendMessageToGroup(groupId, userId, message) {
    try {
        const response = await fetch(`${baseURL}/group/${groupId}/message`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: userId,
                message: message
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Failed to send message.");
        }
        return data;
    } catch (error) {
        console.error("Error sending message:", error);
        alert("Error sending message.");
    }
}
