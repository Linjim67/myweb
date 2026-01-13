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

// ✅ STATIC FILES CONFIGURATION (The Magic Part)
// This tells the server: "If the user asks for /assets/..., look inside the 'web' folder."
app.use(express.static(path.join(__dirname, 'web')));

// Also serve root files if needed (fallback)
app.use(express.static(__dirname));

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
    console.error("❌ Error: MONGO_URI is missing.");
} else {
    mongoose.connect(mongoURI)
        .then(() => console.log("✅ Connected to MongoDB successfully!"))
        .catch(err => console.error("❌ MongoDB connection error:", err));
}

// ====================================================
// 4. HTML PAGE ROUTES (Restored to Root)
// ====================================================

// ✅ FIX: Look in Root (__dirname), NOT 'web'
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/solution', (req, res) => {
    res.sendFile(path.join(__dirname, 'solution.html'));
});

// ====================================================
// 5. API ROUTES
// ====================================================

app.post('/api/solution-data', (req, res) => {
    const { username, admission_year } = req.body;
    const yearToUse = `${String(admission_year || "115")}`;
    const classGroup = "1.2";

    // ✅ FIX: Assuming 'privatee' is in the ROOT folder (based on your original code)
    // If 'privatee' is actually inside 'web', change this line to: path.join(__dirname, 'web', 'privatee'...)
    const baseDir = path.join(__dirname, 'privatee', yearToUse, classGroup);

    const universalPath = path.join(baseDir, 'exam_summer.json');
    const personalPath = path.join(baseDir, `${username}_result.json`);

    try {
        if (!fs.existsSync(universalPath)) {
            return res.status(404).json({ success: false, message: "Exam file not found." });
        }
        const examData = JSON.parse(fs.readFileSync(universalPath, 'utf8'));
        let userResult = null;
        if (fs.existsSync(personalPath)) {
            userResult = JSON.parse(fs.readFileSync(personalPath, 'utf8'));
        }
        res.json({ success: true, exam: examData, result: userResult });
    } catch (error) {
        console.error("File Read Error:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username: username });
        if (user && user.password === password) {
            res.json({ success: true, username: user.username, name: user.name, admission_year: user.admission_year });
        } else {
            res.status(401).json({ success: false, message: "Invalid Credentials" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.post('/get-transcript', (req, res) => {
    const { username, admission_year } = req.body;
    const fileName = `${username}_summer_transcript.pdf`;

    // ✅ FIX: Assuming 'privatee' is in ROOT
    const filePath = path.join(__dirname, 'privatee', admission_year, '1.1', fileName);

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
    } else {
        res.status(404).json({ success: false, message: "Transcript not found" });
    }
});

// ====================================================
// 6. START SERVER
// ====================================================
app.listen(port, () => {
    console.log(`🚀 Website is running at http://localhost:${port}`);
});