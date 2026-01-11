const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

// 1. Database Connection Logic
const mongoURI = process.env.MONGO_URI; 

if (!mongoURI) {
    console.error("❌ Error: No Database URL found. Make sure MONGO_URI is set in Render.");
} else {
    mongoose.connect(mongoURI)
        .then(() => console.log("✅ Connected to MongoDB successfully!"))
        .catch(err => console.error("❌ MongoDB connection error:", err));
}

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Serve static files (CSS, Images) from the current folder
app.use(express.static(__dirname));

// Send the HTML file when the user goes to the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Website is running at http://localhost:${port}`);
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/login.html');
});


const User = require('./models/User'); // Import the model

// ... (Database connection code remains here) ...

// ROUTE: Handle Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username: username });

        if (user && user.password === password) {
            
            res.json({ 
                success: true, 
                username: user.username, 
                name: user.name,
                admission_year: user.admission_year
            });

        } else {
            res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "伺服器錯誤" });
    }
});

app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/dashboard.html');
});



const path = require('path');
const fs = require('fs');

app.post('/get-transcript', (req, res) => {
    const { username, admission_year } = req.body; 
    const filePath = path.join(__dirname, 'privatee', admission_year, '1.1', `${username}_summer_transcript.pdf`);

    if (fs.existsSync(filePath)) {
        res.download(filePath, `${username}.pdf`);
    } else {
        res.status(404).json({ success: false, message: "Transcrpit not found" });
    }
});