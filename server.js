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

app.get('/solution', (req, res) => {
    res.sendFile(path.join(__dirname, 'solution.html'));
});

// ====================================================
// 5. API ROUTES (Data Handling)
// ====================================================

// API: Get Solution Data (Reads local JSON files)
app.post('/api/solution-data', (req, res) => {
    const { username, admission_year } = req.body;

    // DEBUG: Force 115 if admission_year is missing/113
    const yearToUse = `${String(admission_year || "115")}`;
    const classGroup = "1.2";

    // 1. Build Paths
    const baseDir = path.join(__dirname, 'privatee', yearToUse, classGroup);
    const universalPath = path.join(baseDir, 'exam_summer.json');
    const personalPath = path.join(baseDir, `${username}_result.json`);

    // --- 🔍 DEBUG LOGS ---
    console.log("------------------------------------------------");
    console.log(`🔍 Request for: ${username} (Year: ${yearToUse})`);
    console.log(`📂 Looking in folder: ${baseDir}`);
    console.log(`📄 Universal File: ${universalPath} -> Exists? ${fs.existsSync(universalPath)}`);
    console.log(`📄 Personal File: ${personalPath} -> Exists? ${fs.existsSync(personalPath)}`);
    console.log("------------------------------------------------");

    // 2. Read Files
    try {
        // Check if Universal Exam exists
        if (!fs.existsSync(universalPath)) {
            return res.status(404).json({ success: false, message: `Exam file not found at: ${universalPath}` });
        }

        const examData = JSON.parse(fs.readFileSync(universalPath, 'utf8'));

        // Check if User Result exists
        let userResult = null;
        if (fs.existsSync(personalPath)) {
            userResult = JSON.parse(fs.readFileSync(personalPath, 'utf8'));
        }

        // 3. Send Both to Frontend
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
        // Find user in database
        const user = await User.findOne({ username: username });

        // Check if user exists AND password matches
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
    const filePath = path.join(__dirname, 'privatee', admission_year, '1.1', fileName);

    console.log(`🔍 Looking for file at: ${filePath}`);

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
    } else {
        console.error(`❌ File not found: ${filePath}`);
        res.status(404).json({ success: false, message: "Transcript not published yet" });
    }
});



// ====================================================
// 6. START SERVER
// ====================================================
app.listen(port, () => {
    console.log(`🚀 Website is running at http://localhost:${port}`);
});