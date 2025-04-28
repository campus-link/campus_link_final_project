document.addEventListener("DOMContentLoaded", () => {
    fetchGroups();
    fetchUsers();
  
    // Handle group creation
    document.getElementById("createGroupForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const groupName = document.getElementById("groupName").value;
  
      fetch('/admin/create-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groupName }),
      })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
        document.getElementById("groupName").value = "";
        fetchGroups();
      })
      .catch(err => {
        console.error(err);
        alert("Error creating group");
      });
    });
  
    // Handle assigning user to group
    document.getElementById("assignUserForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const groupId = document.getElementById("selectGroup").value;
      const userId = document.getElementById("selectUser").value;
  
      fetch('/admin/assign-user-to-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, userId }),
      })
        .then(res => res.json())
        .then(data => {
          alert(data.message || "User successfully assigned to the group!");
          document.getElementById("selectUser").value = "";
          loadGroupMembers(groupId);
        });
    });
  
    // Load group members when selected
    document.getElementById("selectGroup").addEventListener("change", (e) => {
      loadGroupMembers(e.target.value);
    });
  });
  
  // Fetch all users for dropdown
  function fetchUsers() {
    fetch('/users')
      .then(res => res.json())
      .then(users => {
        const userSelect = document.getElementById("selectUser");
        userSelect.innerHTML = `<option value="">Select a user</option>`;
        users.forEach(user => {
          userSelect.innerHTML += `<option value="${user.id}">${user.name} (${user.role})</option>`;
        });
      });
  }
  
  // Fetch and display existing groups
  function fetchGroups() {
    fetch('/admin/groups')
      .then(res => res.json())
      .then(groups => {
        const select = document.getElementById("selectGroup");
        select.innerHTML = `<option value="">Select a group</option>`;
        const container = document.getElementById("groupList");
        container.innerHTML = "";
  
        groups.forEach(group => {
          select.innerHTML += `<option value="${group.id}">${group.name}</option>`;
  
          const groupItem = document.createElement("div");
          groupItem.className = "border p-3 mb-2 d-flex justify-content-between align-items-center";
  
          groupItem.innerHTML = `
            <strong>${group.name}</strong>
            <div class="btn-group">
              <button class="btn btn-sm btn-info" onclick="viewGroupDetails(${group.id})">View Details</button>
              <button class="btn btn-sm btn-danger" onclick="deleteGroup(${group.id}, '${group.name}')">Delete</button>
            </div>
          `;
  
          container.appendChild(groupItem);
        });
  
        if (groups.length === 0) {
          container.innerHTML = "<p>No groups found.</p>";
        }
      });
  }
  
  // Delete a group
  function deleteGroup(groupId, groupName) {
    if (!confirm(`Are you sure you want to delete group "${groupName}"?`)) return;
  
    fetch(`/admin/delete-group/${groupId}`, {
      method: 'DELETE',
    })
    .then(res => res.json())
    .then(data => {
      alert(data.message);
      fetchGroups();
    })
    .catch(err => {
      console.error(err);
      alert("Error deleting group");
    });
  }
  
  // View group member details
  function viewGroupDetails(groupId) {
    fetch(`/admin/group-members/${groupId}`)
      .then(res => res.json())
      .then(members => {
        if (members.length === 0) {
          alert("This group has no members.");
        } else {
          const memberDetails = members
            .map(member => `• ${member.name} (${member.role})`)
            .join("\n");
          alert(`Group Members:\n\n${memberDetails}`);
        }
      })
      .catch(err => {
        console.error(err);
        alert("Error fetching group details.");
      });
  }
  
  // Show users in a group
  function loadGroupMembers(groupId) {
    if (!groupId) return;
    fetch(`/admin/group-members/${groupId}`)
      .then(res => res.json())
      .then(members => {
        const list = document.getElementById("groupMembersList");
        list.innerHTML = "";
  
        if (members.length === 0) {
          list.innerHTML = "<li class='list-group-item'>No members in this group.</li>";
          return;
        }
  
        members.forEach(member => {
          const item = document.createElement("li");
          item.className = "list-group-item d-flex justify-content-between align-items-center";
  
          item.innerHTML = `
            ${member.name} (${member.role})
            <button class="btn btn-sm btn-outline-danger" onclick="removeUserFromGroup(${member.id}, ${groupId})">Remove</button>
          `;
  
          list.appendChild(item);
        });
      });
  }
  
  // Remove user from group
  function removeUserFromGroup(userId, groupId) {
    fetch('/admin/remove-user-from-group', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, groupId }),
    })
      .then(res => res.json())
      .then(data => {
        alert(data.message);
        loadGroupMembers(groupId);
      });
  }
  