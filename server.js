// ====================================================
// 1. SETUP & IMPORTS
// ====================================================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const User = require('./models/User');


// ====================================================
// 2. MIDDLEWARE
// ====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// CORS Headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
    }
}));

// Rate limiting for login attempts
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts, please try again later'
});

// ====================================================
// 3. DATABASE CONNECTION
// ====================================================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined.');
    console.error('Please set MONGODB_URI in Render Environment Variables');
    process.exit(1);
}

// DEBUG: Print the connection string (MASK the password)
const maskedURI = MONGODB_URI.replace(/:[^@]*@/, ':****@');
console.log(MONGODB_URI);

mongoose.connect(MONGODB_URI, {
    dbName: 'test'
})
    .then(() => console.log('Connected to MongoDB - test database'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// ====================================================
// 4. SCHEMAS & MODELS
// ====================================================

// Submission Schema
const submissionSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    exam_id: { type: String, required: true },
    answers: { type: Object, required: true },
    scores: { type: Object },
    total_score: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});

// Add unique constraint to prevent duplicate submissions
submissionSchema.index({ user_id: 1, exam_id: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);

// ====================================================
// 5. AUTHENTICATION MIDDLEWARE
// ====================================================
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
};

// ====================================================
// 6. HELPER FUNCTIONS
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
// 7. HTML PAGE ROUTES
// ====================================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/solution', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'solution.html'));
});

// ====================================================
// 8. API ROUTES
// ====================================================

/**
 * SUBMIT EXAM ROUTE
 * Receives answers, Grades them, Saves to MongoDB
 */
app.post('/api/submit', async (req, res) => {
    try {
        const { user_id, exam_id, answers } = req.body;

        // Input validation
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

        let examData;
        try {
            const examDataRaw = await fsPromises.readFile(examPath, 'utf8');
            
            try {
                examData = JSON.parse(examDataRaw);
            } catch (parseError) {
                console.error('JSON parse error in exam data:', parseError);
                return res.status(500).json({ message: 'Invalid exam data format' });
            }

            // Validate exam data structure
            if (!Array.isArray(examData)) {
                return res.status(500).json({ message: 'Exam data must be an array' });
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
 * CHECK SUBMISSION STATUS
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

/**
 * USER REGISTRATION
 */
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, name, admission_year } = req.body;

        // Validation
        if (!username || !password || !name || !admission_year) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword, name, admission_year });
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * USER LOGIN
 */
app.post('/api/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Input validation
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }

        const user = await User.findOne({ username });
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
            user: { username: user.username }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * USER LOGOUT
 */
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

/**
 * GET USER INFO
 */
app.get('/api/user', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * DOWNLOAD TRANSCRIPT PDF
 */
app.post('/get-transcript', async (req, res) => {
    const { username, admission_year } = req.body;
    
    // Input validation
    if (!username || !admission_year) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    const fileName = `${username}_summer_transcript.pdf`;
    const filePath = path.join(__dirname, 'privatee', admission_year, '1.1', fileName);

    try {
        // Check if file exists and is readable
        await fsPromises.access(filePath, fs.constants.R_OK);
        res.download(filePath, fileName);
    } catch (error) {
        console.error('Transcript download error:', error);
        res.status(404).json({ success: false, message: 'Transcript not found' });
    }
});

// ====================================================
// 9. START SERVER
// ====================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { Submission };