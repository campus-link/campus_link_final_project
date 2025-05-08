document.addEventListener('DOMContentLoaded', async () => {
    const profileForm = document.getElementById('profileForm');
    const messageDiv = document.getElementById('message');
    const backButton = document.getElementById('backButton');
    const editBtn = document.getElementById('editBtn');
    const submitBtn = document.getElementById('submitBtn');

    const userId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');

    if (!userId || !authToken) {
        messageDiv.innerText = 'User not logged in. Please login first.';
        profileForm.style.display = 'none';
        editBtn.style.display = 'none';
        return;
    }

    // Load existing user data
    try {
const response = await fetch(`https://campus-link-final-project.onrender.com/users/${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user profile');
        }
        const user = await response.json();

        document.getElementById('name').value = user.name || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('role').value = user.role || '';
        // Password field left blank for security reasons, user can enter new password to change
        document.getElementById('password').value = '';
    } catch (error) {
        messageDiv.innerText = 'Error loading profile.';
        console.error(error);
    }

    // Enable editable fields except email
    function setEditable(editable) {
        document.getElementById('name').disabled = !editable;
        document.getElementById('password').disabled = !editable;
        submitBtn.disabled = !editable;
    }

    // Initially fields are disabled except email
    setEditable(false);

    editBtn.addEventListener('click', () => {
        setEditable(true);
        editBtn.disabled = true;
    });

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        messageDiv.innerText = '';
        submitBtn.disabled = true;

        const formData = {
            name: document.getElementById('name').value.trim()
        };

        const passwordValue = document.getElementById('password').value;
        if (passwordValue && passwordValue.trim() !== '') {
            formData.password = passwordValue;
        }

        try {
            const response = await fetch(`http://localhost:5000/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }

            messageDiv.style.color = 'green';
            messageDiv.innerText = 'Profile updated successfully!';
            // Optionally clear password field
            document.getElementById('password').value = '';
            setEditable(false);
            editBtn.disabled = false;

            // Redirect to multi-login.html if password was changed
            if (formData.password) {
                window.location.href = 'multi-login.html';
            }
        } catch (error) {
            messageDiv.style.color = 'red';
            messageDiv.innerText = error.message;
            console.error(error);
            submitBtn.disabled = false;
        }
    });

    backButton.addEventListener('click', () => {
        window.location.href = 'user-groups.html';
    });
});
