// ====================================================
// 1. SETUP & IMPORTS
// ====================================================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;  // Use this for async operations
require('dotenv').config();

const app = express();
const User = require('./models/User');


// ====================================================
// 2. MIDDLEWARE
// ====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',  // true in prod, false in dev
        httpOnly: true,  // Prevent XSS attacks
        sameSite: 'strict'  // CSRF protection
    }
}));

// ====================================================
// 3. DATABASE CONNECTION
// ====================================================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined.');
    console.error('Please set MONGODB_URI in Render Environment Variables');
    process.exit(1);
}

// Database connection
mongoose.connect(MONGODB_URI, {
    dbName: 'test'
})
    .then(() => console.log('Connected to MongoDB - test database'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// ----------------------------------------------------
// [NEW] SUBMISSION SCHEMA (For storing exam results)
// ----------------------------------------------------
const submissionSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    exam_id: { type: String, required: true },
    answers: { type: Object, required: true },
    scores: { type: Object },
    total_score: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});

// Add unique constraint
submissionSchema.index({ user_id: 1, exam_id: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);


// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

// ====================================================
// 4. HELPER FUNCTIONS
// ====================================================
function calculateScores(examData, userAnswers) {
    const scores = {};
    let totalScore = 0;

    examData.forEach(block => {
        block.problems.forEach(problem => {
            const problemId = problem.id.toString();
            const userAnswer = userAnswers[problemId];
            const correctAnswer = problem.answer;
            const allocation = problem.allocation || 0;
            let earned = 0;

            if (problem.type === 'single') {
                // Single choice: exact match
                if (userAnswer === correctAnswer) {
                    earned = allocation;
                }
            } else if (problem.type === 'multi') {
                // Multi choice: (correct - wrong) / total * points
                const correctOpts = correctAnswer.split(',').map(a => a.trim());
                const userOpts = userAnswer ? userAnswer.split(',').map(a => a.trim()) : [];
                const allOpts = problem.options.map((_, idx) => String.fromCharCode(65 + idx));

                let correctDecisions = 0;
                let incorrectDecisions = 0;

                allOpts.forEach(opt => {
                    const isPicked = userOpts.includes(opt);
                    const isCorrect = correctOpts.includes(opt);
                    
                    if (isPicked === isCorrect) {
                        correctDecisions++;
                    } else {
                        incorrectDecisions++;
                    }
                });

                const rawScore = allocation * ((correctDecisions - incorrectDecisions) / allOpts.length);
                earned = Math.max(0, rawScore);

            } else if (problem.type === 'fill') {
                if (typeof correctAnswer === 'object') {
                    // Multi-part fill
                    const subKeys = Object.keys(correctAnswer);
                    const pointsPerBlank = allocation / subKeys.length;
                    let correctCount = 0;

                    subKeys.forEach(subKey => {
                        const userSub = userAnswer && userAnswer[subKey] ? userAnswer[subKey].trim() : '';
                        const correctSub = correctAnswer[subKey].trim();
                        
                        if (userSub === correctSub) {
                            correctCount++;
                        }
                    });

                    earned = correctCount * pointsPerBlank;
                } else {
                    // Single fill
                    if (userAnswer && userAnswer.trim() === correctAnswer.trim()) {
                        earned = allocation;
                    }
                }
            }

            scores[problemId] = parseFloat(earned.toFixed(2));
            totalScore += earned;
        });
    });

    scores.total = parseFloat(totalScore.toFixed(2));
    return { scores, totalScore: scores.total };
}


// ====================================================
// 5. HTML PAGE ROUTES
// ====================================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/solution', (req, res) => {
    // Frontend handles auth via localStorage, but add this for extra safety:
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'solution.html'));
});


// ====================================================
// 6. API ROUTES
// ====================================================

/**
 * [NEW] SUBMIT EXAM ROUTE
 * Receives answers, Grades them, Saves to Mongo
 */
app.post('/api/submit', async (req, res) => {
    try {
        const { user_id, exam_id, answers } = req.body;

        if (!user_id || !exam_id || !answers || Object.keys(answers).length === 0) {
            return res.status(400).json({ message: 'Invalid answers provided' });
        }

        // Check if already submitted
        const existing = await Submission.findOne({ user_id, exam_id });
        if (existing) {
            return res.status(400).json({ message: 'Exam already submitted' });
        }

        // Load exam data for grading
        const admissionYear = user_id.substring(0, 3);
        const examPath = path.join(__dirname, 'assets', 'data', `${admissionYear}_exam_summer.json`);

        // Add error handling
        try {
            const examDataRaw = await fsPromises.readFile(examPath, 'utf8');
            const examData = JSON.parse(examDataRaw); 

            // After parsing JSON, validate:
            if (!Array.isArray(examData)) {
                return res.status(500).json({ message: 'Invalid exam data format' });
            }
        } catch (error) {
            console.error('Failed to load exam data:', error);
            return res.status(500).json({ message: 'Exam data not found' });
        }

        // Calculate scores
        const { scores, totalScore } = calculateScores(examData, answers);

        // Save submission
        const submission = new Submission({
            user_id,
            exam_id,
            answers,
            scores,
            total_score: totalScore
        });

        await submission.save();

        res.json({
            message: 'Exam submitted successfully',
            totalScore: totalScore,
            scores: scores
        });

    } catch (error) {
        console.error('Submit error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Check if user has submitted exam
 * Returns submission data if found
 */
app.post('/api/check-status', async (req, res) => {
    try {
        const { user_id } = req.body;

        if (!user_id) {
            return res.status(400).json({ message: 'User ID required' });
        }

        const submission = await Submission.findOne({
            user_id: user_id,
            exam_id: "exam_summer_115"
        });

        if (submission) {
            return res.json({
                found: true,
                answers: submission.answers,
                scores: submission.scores,
                total: submission.total_score
            });
        }

        res.json({ found: false });
    } catch (error) {
        console.error('Check status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Registration endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        req.session.userId = user._id;
        req.session.username = user.username;

        res.json({ 
            message: 'Login successful',
            user: { username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

// Get user session
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * Download transcript PDF
 */
app.post('/get-transcript', async (req, res) => {  // Add async
    const { username, admission_year } = req.body;
    const fileName = `${username}_summer_transcript.pdf`;
    const filePath = path.join(__dirname, 'privatee', admission_year, '1.1', fileName);

    try {
        await fsPromises.access(filePath);  // Check if file exists
        res.download(filePath, fileName);
    } catch (error) {
        res.status(404).json({ success: false, message: "Transcript not found" });
    }
});


// ====================================================
// 7. START SERVER
// ====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { Submission };