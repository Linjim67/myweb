// ====================================================
// 1. SETUP & IMPORTS
// ====================================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const User = require('./models/User'); // Import User Model

const app = express();
const port = process.env.PORT || 3000;

// ====================================================
// 2. MIDDLEWARE (The "Gatekeepers")
// ====================================================
// Allow server to read JSON and Form data from login pages
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets (CSS, Images, JS)
// Note: Ensure style.css and script.js are in the root folder or a 'public' folder
app.use(express.static(__dirname)); 

// ====================================================
// 3. DATABASE CONNECTION
// ====================================================
const mongoURI = process.env.MONGO_URI; 

if (!mongoURI) {
    console.error("❌ Error: MONGO_URI is missing. Check Render Environment Variables.");
} else {
    mongoose.connect(mongoURI)
        .then(() => console.log("✅ Connected to MongoDB successfully!"))
        .catch(err => console.error("❌ MongoDB connection error:", err));
}

// ====================================================
// 4. HTML PAGE ROUTES (Navigation)
// ====================================================

// Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Dashboard Page
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ====================================================
// 5. API ROUTES (Data Handling)
// ====================================================

// ACTION: Handle User Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find user in database
        const user = await User.findOne({ username: username });

        // Check if user exists AND password matches
        if (user && user.password === password) {
            console.log(`✅ User logged in: ${username}`);
            
            res.json({ 
                success: true, 
                username: user.username, 
                // Ensure these exist in your MongoDB document if you need them:
                name: user.name || username, 
                admission_year: user.admission_year 
            });

        } else {
            res.status(401).json({ success: false, message: "帳號或密碼錯誤 (Invalid Credentials)" });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "伺服器錯誤 (Server Error)" });
    }
});

// ACTION: Download Transcript PDF
app.post('/get-transcript', (req, res) => {
    const { username, admission_year } = req.body; 

    if (!admission_year || !username) {
        return res.status(400).json({ success: false, message: "Missing data" });
    }

    const fileName = `${username}_summer_transcript.pdf`;
    const filePath = path.join(__dirname, 'privatee', admission_year, '1.1', fileName);

    console.log(`🔍 Looking for file at: ${filePath}`);

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
    } else {
        console.error(`❌ File not found: ${filePath}`);
        res.status(404).json({ success: false, message: "Transcript not published" });
    }
});

// ====================================================
// 6. START SERVER
// ====================================================
app.listen(port, () => {
    console.log(`🚀 Website is running at http://localhost:${port}`);
});