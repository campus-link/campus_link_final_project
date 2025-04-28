const bcrypt = require('bcryptjs');

bcrypt.hash("admin123", 10, (err, hash) => {
    if (err) return console.error(err);
    console.log("New Hashed Password:", hash);
});
