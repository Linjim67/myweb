// ====================================================
// 1. SETUP & IMPORTS
// ====================================================
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const User = require('./models/User');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// ✅ STATIC FILES CONFIGURATION
app.use(express.static(path.join(__dirname, 'web')));
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

// ----------------------------------------------------
// [NEW] SUBMISSION SCHEMA (For storing exam results)
// ----------------------------------------------------
const SubmissionSchema = new mongoose.Schema({
    user_id: String,
    exam_id: String,
    timestamp: { type: Date, default: Date.now },
    answers: Object,  // Stores raw input { "1": "A", "30": { "30-1": "..." } }
    scores: Object,   // Stores graded points { "1": 3, "total": 85 }
    total_score: Number
});
// Check if model exists to avoid recompilation errors
const Submission = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);


// ====================================================
// 4. HELPER FUNCTIONS (The Auto-Grader)
// ====================================================

/**
 * Calculates scores based on User Answers vs Exam Data
 */
function calculateAutoGrades(examData, userAnswers) {
    const scores = {};
    let totalScore = 0;

    // Flatten blocks to get simple list of problems
    const allProblems = [];
    if (Array.isArray(examData)) {
        examData.forEach(block => {
            if (block.problems) allProblems.push(...block.problems);
        });
    }

    allProblems.forEach(prob => {
        const pID = prob.id.toString();
        const userAns = userAnswers[pID];
        const correctAns = prob.correctAnswer;

        // Default allocation logic
        let allocation = prob.allocation || prob.points || (prob.type === 'multi' ? 5 : 3);
        let earned = 0;

        if (userAns) {
            // A. FILL-IN (Handle Sub-Questions)
            if (prob.type === 'fill') {
                if (typeof correctAns === 'object') {
                    // Multi-part (e.g. 30-1, 30-2)
                    const subKeys = Object.keys(correctAns);
                    const pointsPerBlank = allocation / subKeys.length;
                    let correctCount = 0;

                    subKeys.forEach(k => {
                        const uVal = (userAns[k] || "").toString().trim();
                        const cVal = (correctAns[k] || "").toString().trim();
                        // Loose equality for numbers ("6" == 6)
                        if (uVal == cVal) correctCount++;
                    });
                    earned = parseFloat((correctCount * pointsPerBlank).toFixed(2));
                } else {
                    // Single Fill
                    if (userAns.toString().trim() == correctAns.toString().trim()) earned = allocation;
                }
            }
            // B. SINGLE CHOICE
            else if (prob.type === 'single') {
                if (userAns === correctAns) earned = allocation;
            }
            // C. MULTI CHOICE (Right - Wrong Formula)
            else if (prob.type === 'multi') {
                const allOpts = prob.options.map(o => o.label);
                const uArr = Array.isArray(userAns) ? userAns : [userAns];
                const cArr = Array.isArray(correctAns) ? correctAns : [correctAns];

                let correctDecisions = 0;
                let incorrectDecisions = 0;

                allOpts.forEach(opt => {
                    const picked = uArr.includes(opt);
                    const isRight = cArr.includes(opt);
                    if (picked === isRight) correctDecisions++;
                    else incorrectDecisions++;
                });

                let rawScore = allocation * ((correctDecisions - incorrectDecisions) / allOpts.length);
                earned = rawScore > 0 ? parseFloat(rawScore.toFixed(2)) : 0;
            }
        }

        scores[pID] = earned;
        totalScore += earned;
    });

    scores.total = parseFloat(totalScore.toFixed(1));
    return scores;
}


// ====================================================
// 5. HTML PAGE ROUTES
// ====================================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/solution', (req, res) => res.sendFile(path.join(__dirname, 'solution.html')));


// ====================================================
// 6. API ROUTES
// ====================================================

/**
 * [NEW] SUBMIT EXAM ROUTE
 * Receives answers, Grades them, Saves to Mongo
 */
app.post('/api/submit', async (req, res) => {
    try {
        const { user_id, answers } = req.body;
        console.log(`📝 Received submission from User: ${user_id}`);

        // 1. Load the Answer Key
        // We look in the same 'privatee' folder logic you used elsewhere
        // Defaulting to 115/1.2 for now. You can pass these as params if needed.
        const yearToUse = "115";
        const classGroup = "1.2";
        const examPath = path.join(__dirname, 'privatee', yearToUse, classGroup, 'exam_summer.json');

        if (!fs.existsSync(examPath)) {
            console.error("Exam file missing at:", examPath);
            return res.status(404).json({ success: false, message: "Exam definition not found on server." });
        }

        const examData = JSON.parse(fs.readFileSync(examPath, 'utf8'));

        // 2. Run Auto-Grader
        const scores = calculateAutoGrades(examData, answers);

        // 3. Save to MongoDB
        if (mongoose.connection.readyState === 1) {
            const newSubmission = new Submission({
                user_id,
                exam_id: "exam_summer_115",
                answers,
                scores,
                total_score: scores.total
            });

            await newSubmission.save();
            console.log(`✅ Scores saved for ${user_id}: ${scores.total} pts`);
        } else {
            console.warn("⚠️ DB not connected; results calculated but not saved.");
        }

        // 4. Return Results
        res.json({ success: true, scores: scores, total: scores.total });

    } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).json({ success: false, message: "Server Error processing submission." });
    }
});

// Existing Route: Load Solution Data
app.post('/api/solution-data', (req, res) => {
    const { username, admission_year } = req.body;
    const yearToUse = `${String(admission_year || "115")}`;
    const classGroup = "1.2";
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

// Existing Route: Login
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

// Existing Route: Download Transcript
app.post('/get-transcript', (req, res) => {
    const { username, admission_year } = req.body;
    const fileName = `${username}_summer_transcript.pdf`;
    const filePath = path.join(__dirname, 'privatee', admission_year, '1.1', fileName); // Note: 1.1 used here in your original code

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName);
    } else {
        res.status(404).json({ success: false, message: "Transcript not found" });
    }
});


/* =========================================
   CHECK STATUS ROUTE
   frontend asks: "Did I submit this already?"
   ========================================= */
app.post('/api/check-status', async (req, res) => {
    try {
        const { user_id } = req.body;

        // 1. Search MongoDB for this user's submission
        if (mongoose.connection.readyState === 1) {
            const submission = await Submission.findOne({
                user_id: user_id,
                exam_id: "exam_summer_115"
            });

            if (submission) {
                // FOUND: Send back the data so we can show the transcript
                return res.json({
                    found: true,
                    answers: submission.answers,
                    scores: submission.scores
                });
            }
        }

        // NOT FOUND: Tell frontend to show exam mode
        res.json({ found: false });

    } catch (error) {
        console.error("Check Status Error:", error);
        res.status(500).json({ error: "Server Error" });
    }
});


// ====================================================
// 7. START SERVER
// ====================================================
app.listen(port, () => {
    console.log(`🚀 Website is running at http://localhost:${port}`);
});