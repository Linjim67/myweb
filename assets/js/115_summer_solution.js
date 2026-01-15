/**
 * 115 Summer Exam Solution Handler
 * Handles both exam-taking mode and solution review mode
 */

let examData = null;
let currentBlock = 0;
let userAnswers = {};
let userScores = {};

/**
 * Main entry point - determines if user should see exam or solutions
 */
async function loadPage() {
    try {
        // Get current user from localStorage
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser || !currentUser.username) {
            alert("Please login first");
            window.location.href = '/login.html';
            return;
        }

        const studentID = currentUser.username;
        const admissionYear = studentID.substring(0, 3);

        // Check if user has submitted the exam
        const statusRes = await fetch('/api/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: studentID })
        });
        const status = await statusRes.json();

        // Load exam structure
        const examRes = await fetch(`/assets/data/${admissionYear}_exam_summer.json`);
        examData = await examRes.json();

        if (status.found) {
            // User has submitted - show solutions with their answers
            userAnswers = status.answers;
            userScores = status.scores;
            renderSolutions();
        } else {
            // User hasn't submitted - show exam taking interface
            renderExamMode();
        }

    } catch (error) {
        console.error('Error loading page:', error);
        document.getElementById('content').innerHTML = 
            '<p class="error">Error loading exam data. Please refresh the page.</p>';
    }
}

/**
 * Render solutions with user's answers and scores
 */
function renderSolutions() {
    if (!examData) return;

    const container = document.getElementById('content');
    let totalScore = userScores.total || 0;
    let maxScore = 0;

    // Calculate max possible score
    examData.forEach(block => {
        block.problems.forEach(prob => {
            maxScore += prob.allocation || 0;
        });
    });

    let html = `
        <div class="solution-header">
            <h2>Exam Solutions - Summer 115</h2>
            <div class="score-display">
                <span class="user-score">Your Score: ${totalScore.toFixed(1)}</span>
                <span class="max-score">/ ${maxScore}</span>
            </div>
        </div>
        <div class="block-navigation">
            ${examData.map((block, idx) => 
                `<button class="block-btn ${idx === 0 ? 'active' : ''}" 
                         onclick="showBlock(${idx})">
                    Block ${idx + 1}: ${block.name}
                </button>`
            ).join('')}
        </div>
        <div id="blockContent"></div>
    `;

    container.innerHTML = html;
    showBlock(0);
}

/**
 * Display a specific block of questions
 */
function showBlock(blockIndex) {
    currentBlock = blockIndex;
    const block = examData[blockIndex];
    const blockContent = document.getElementById('blockContent');

    // Update navigation buttons
    document.querySelectorAll('.block-btn').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === blockIndex);
    });

    let html = `<div class="block-section">`;
    
    block.problems.forEach((problem, idx) => {
        const problemId = problem.id.toString();
        const userAnswer = userAnswers[problemId];
        const score = userScores[problemId] || 0;
        const maxPoints = problem.allocation || 0;

        html += `
            <div class="problem-card ${score === maxPoints ? 'correct' : score > 0 ? 'partial' : 'incorrect'}">
                <div class="problem-header">
                    <span class="problem-number">Question ${problem.id}</span>
                    <span class="problem-type">[${problem.type}]</span>
                    <span class="problem-score">${score.toFixed(1)} / ${maxPoints}</span>
                </div>
                <div class="problem-text">${problem.text}</div>
                ${renderProblemContent(problem, userAnswer)}
            </div>
        `;
    });

    html += `</div>`;
    blockContent.innerHTML = html;
}

/**
 * Render problem content based on type
 */
function renderProblemContent(problem, userAnswer) {
    let html = '';

    // Display options for single/multi choice
    if (problem.type === 'single' || problem.type === 'multi') {
        const correctAnswer = problem.type === 'single' 
            ? problem.answer 
            : problem.answer.split(',').map(a => a.trim());
        
        const userSelected = problem.type === 'single'
            ? userAnswer
            : (userAnswer ? userAnswer.split(',').map(a => a.trim()) : []);

        html += '<div class="options">';
        problem.options.forEach((option, idx) => {
            const optionLetter = String.fromCharCode(65 + idx);
            const isCorrect = problem.type === 'single' 
                ? optionLetter === correctAnswer
                : correctAnswer.includes(optionLetter);
            const isSelected = problem.type === 'single'
                ? optionLetter === userSelected
                : userSelected.includes(optionLetter);

            let className = 'option';
            if (isCorrect) className += ' correct-answer';
            if (isSelected && !isCorrect) className += ' wrong-answer';
            if (isSelected && isCorrect) className += ' user-correct';

            html += `
                <div class="${className}">
                    <span class="option-letter">${optionLetter}.</span>
                    <span class="option-text">${option}</span>
                    ${isSelected ? '<span class="badge">Your Answer</span>' : ''}
                    ${isCorrect ? '<span class="badge correct">Correct</span>' : ''}
                </div>
            `;
        });
        html += '</div>';
    }

    // Display fill-in-the-blank answers
    if (problem.type === 'fill') {
        html += '<div class="fill-answers">';
        
        if (typeof problem.answer === 'object') {
            // Multi-part fill (e.g., 30-1, 30-2)
            Object.keys(problem.answer).forEach(subKey => {
                const correctAns = problem.answer[subKey];
                const userAns = userAnswer && userAnswer[subKey] ? userAnswer[subKey] : '';
                const isCorrect = userAns.trim() === correctAns.trim();

                html += `
                    <div class="fill-item ${isCorrect ? 'correct' : 'incorrect'}">
                        <strong>${subKey}:</strong>
                        <span class="user-fill">Your answer: "${userAns}"</span>
                        ${!isCorrect ? `<span class="correct-fill">Correct: "${correctAns}"</span>` : ''}
                    </div>
                `;
            });
        } else {
            // Single fill
            const isCorrect = userAnswer && userAnswer.trim() === problem.answer.trim();
            html += `
                <div class="fill-item ${isCorrect ? 'correct' : 'incorrect'}">
                    <span class="user-fill">Your answer: "${userAnswer || ''}"</span>
                    ${!isCorrect ? `<span class="correct-fill">Correct: "${problem.answer}"</span>` : ''}
                </div>
            `;
        }
        
        html += '</div>';
    }

    // Add explanation if available
    if (problem.explanation) {
        html += `
            <div class="explanation">
                <strong>Explanation:</strong>
                <p>${problem.explanation}</p>
            </div>
        `;
    }

    return html;
}

/**
 * Render exam taking interface
 */
function renderExamMode() {
    const container = document.getElementById('content');
    
    let html = `
        <div class="exam-header">
            <h2>Summer 115 Examination</h2>
            <p>Please complete all questions and submit your answers.</p>
        </div>
        <form id="examForm">
    `;

    examData.forEach((block, blockIdx) => {
        html += `
            <div class="exam-block">
                <h3>${block.name}</h3>
        `;

        block.problems.forEach(problem => {
            html += `
                <div class="exam-problem">
                    <div class="problem-header">
                        <span class="problem-number">Q${problem.id}</span>
                        <span class="problem-points">(${problem.allocation} points)</span>
                    </div>
                    <div class="problem-text">${problem.text}</div>
                    ${renderExamInput(problem)}
                </div>
            `;
        });

        html += `</div>`;
    });

    html += `
            <button type="submit" class="submit-btn">Submit Exam</button>
        </form>
    `;

    container.innerHTML = html;
    
    // Attach submit handler
    document.getElementById('examForm').addEventListener('submit', handleExamSubmit);
}

/**
 * Render input fields for exam questions
 */
function renderExamInput(problem) {
    const problemId = problem.id;
    let html = '';

    if (problem.type === 'single') {
        html += '<div class="options">';
        problem.options.forEach((option, idx) => {
            const optionLetter = String.fromCharCode(65 + idx);
            html += `
                <label class="option">
                    <input type="radio" name="q${problemId}" value="${optionLetter}" required>
                    <span>${optionLetter}. ${option}</span>
                </label>
            `;
        });
        html += '</div>';
    } else if (problem.type === 'multi') {
        html += '<div class="options">';
        problem.options.forEach((option, idx) => {
            const optionLetter = String.fromCharCode(65 + idx);
            html += `
                <label class="option">
                    <input type="checkbox" name="q${problemId}" value="${optionLetter}">
                    <span>${optionLetter}. ${option}</span>
                </label>
            `;
        });
        html += '</div>';
    } else if (problem.type === 'fill') {
        if (typeof problem.answer === 'object') {
            // Multi-part fill
            html += '<div class="fill-inputs">';
            Object.keys(problem.answer).forEach(subKey => {
                html += `
                    <div class="fill-group">
                        <label>${subKey}:</label>
                        <input type="text" name="q${problemId}_${subKey}" class="fill-input" required>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            // Single fill
            html += `
                <input type="text" name="q${problemId}" class="fill-input" placeholder="Enter your answer" required>
            `;
        }
    }

    return html;
}

/**
 * Handle exam submission
 */
async function handleExamSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const answers = {};

    // Collect answers
    examData.forEach(block => {
        block.problems.forEach(problem => {
            const problemId = problem.id.toString();
            
            if (problem.type === 'single') {
                answers[problemId] = formData.get(`q${problemId}`);
            } else if (problem.type === 'multi') {
                const selected = formData.getAll(`q${problemId}`);
                answers[problemId] = selected.join(',');
            } else if (problem.type === 'fill') {
                if (typeof problem.answer === 'object') {
                    answers[problemId] = {};
                    Object.keys(problem.answer).forEach(subKey => {
                        answers[problemId][subKey] = formData.get(`q${problemId}_${subKey}`);
                    });
                } else {
                    answers[problemId] = formData.get(`q${problemId}`);
                }
            }
        });
    });

    try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        const response = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.username,
                exam_id: "exam_summer_115",
                answers: answers
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`Exam submitted successfully!\nYour score: ${result.totalScore}`);
            // Reload page to show solutions
            window.location.reload();
        } else {
            alert('Submission failed: ' + result.message);
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('An error occurred during submission');
    }
}

// Initialize page on load
document.addEventListener('DOMContentLoaded', loadPage);
