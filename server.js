// ====================================================
// 1. SETUP & IMPORTS
// ====================================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const User = require('./models/User');

const app = express();
const port = process.env.PORT || 3000;

// ✅ CRITICAL FIX: Serve files strictly from the 'web' folder
// This makes sure http://site.com/assets/js/solution.js finds web/assets/js/solution.js
app.use(express.static(path.join(__dirname, 'web')));

// Optional: Keep this if you want to be extra safe with asset links
app.use('/assets', express.static(path.join(__dirname, 'web/assets')));

// ====================================================
// 2. MIDDLEWARE
// ====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    // ✅ FIX: Added 'web' to path
    res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// Login Page
app.get('/login', (req, res) => {
    // ✅ FIX: Added 'web' to path
    res.sendFile(path.join(__dirname, 'web', 'login.html'));
});

// Dashboard Page
app.get('/dashboard', (req, res) => {
    // ✅ FIX: Added 'web' to path
    res.sendFile(path.join(__dirname, 'web', 'dashboard.html'));
});

// Solution Page
app.get('/solution', (req, res) => {
    // ✅ FIX: Added 'web' to path
    res.sendFile(path.join(__dirname, 'web', 'solution.html'));
});

// ====================================================
// 5. API ROUTES (Data Handling)
// ====================================================

// API: Get Solution Data
app.post('/api/solution-data', (req, res) => {
    const { username, admission_year } = req.body;

    const yearToUse = `${String(admission_year || "115")}`;
    const classGroup = "1.2";

    // ✅ FIX: Look for 'privatee' inside the 'web' folder
    const baseDir = path.join(__dirname, 'web', 'privatee', yearToUse, classGroup);
    const universalPath = path.join(baseDir, 'exam_summer.json');
    const personalPath = path.join(baseDir, `${username}_result.json`);

    try {
        if (!fs.existsSync(universalPath)) {
            console.error(`❌ Exam file missing at: ${universalPath}`);
            return res.status(404).json({ success: false, message: "Exam file not found." });
        }

        const examData = JSON.parse(fs.readFileSync(universalPath, 'utf8'));

        let userResult = null;
        if (fs.existsSync(personalPath)) {
            userResult = JSON.parse(fs.readFileSync(personalPath, 'utf8'));
        }

        res.json({
            success: true,
            exam: examData,
            result: userResult
        });

    } catch (error) {
        console.error("File Read Error:", error);
        res.status(500).json({ success: false, message: "Server error reading solution files." });
    }
});

// ACTION: Handle User Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username: username });

        if (user && user.password === password) {
            console.log(`✅ User logged in: ${username}`);
            res.json({
                success: true,
                username: user.username,
                name: user.name,
                admission_year: user.admission_year
            });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials" });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ACTION: Download Transcript PDF
app.post('/get-transcript', (req, res) => {
    const { username, admission_year } = req.body;

    if (!admission_year || !username) {
        return res.status(400).json({ success: false, message: "Missing data" });
    }

    const fileName = `${username}_summer_transcript.pdf`;

    // ✅ FIX: Look for transcripts inside 'web/privatee'
    const filePath = path.join(__dirname, 'web', 'privatee', admission_year, '1.1', fileName);

    console.log(`🔍 Looking for PDF at: ${filePath}`);

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
    } else {
        console.error(`❌ PDF not found: ${filePath}`);
        res.status(404).json({ success: false, message: "Transcript not published yet" });
    }
});

// ====================================================
// 6. START SERVER
// ====================================================
app.listen(port, () => {
    console.log(`🚀 Website is running at http://localhost:${port}`);
    console.log(`📂 Serving static files from: ${path.join(__dirname, 'web')}`);
});