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

// 2. Middleware (Allows server to read JSON data from forms)
app.use(express.static('public')); // Or wherever your html files are
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