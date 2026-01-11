const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    // We can add roles later (e.g., 'student', 'teacher')
    role: {
        type: String,
        default: 'student'
    }
});

module.exports = mongoose.model('User', userSchema);