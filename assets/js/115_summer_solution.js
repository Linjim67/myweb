/* =========================================
   1. INITIALIZATION
   ========================================= */
// This event triggers when the HTML is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Script started! Calling loadPage()...");
    loadPage();
});

/* =========================================
   2. DATA LOADING & THEME
   ========================================= */
async function loadPage() {
    try {
        console.log("📡 Fetching data from server...");

        // 1. Send request (Hardcoded username for testing!)
        const response = await fetch('/api/solution-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "1150",
                admission_year: "115"
            })
        });

        const data = await response.json();
        console.log("📦 Server Data Received:", data);

        if (data.success) {
            // 1. Get the Raw Data
            let rawExam = data.exam;
            const userFile = data.result || {};

            // SAFETY CHECK: Ensure Exam is an Array
            if (!Array.isArray(rawExam)) {
                // If your JSON is still an object { "block1": ... }, convert it here just in case
                rawExam = Object.values(rawExam);
            }

            // 2. THE NEW MERGE LOGIC (Updated for your new JSON structure)
            const userAnswers = userFile.answers || {}; // Get the "answers" block
            const userScores = userFile.scores || {};   // Get the "scores" block

            rawExam.forEach(block => {
                block.problems.forEach(prob => {
                    const pID = String(prob.id); // Ensure ID is a string ("1") to match JSON keys

                    // Grab specific data for this ID
                    const myChoice = userAnswers[pID];
                    const myScore = userScores[pID];

                    // Attach it to the problem so the HTML renderer can read it
                    prob.userResult = {
                        choice: myChoice !== undefined ? myChoice : [], // Default to empty if missing
                        score: myScore !== undefined ? myScore : 0      // Default to 0 if missing
                    };
                });
            });

            // 3. Save & Render
            window.examData = rawExam;

            // Pass the username to load the correct theme (e.g. "115")
            // Make sure data.result.username exists, or fallback to "115"
            const studentID = userFile.username || "115";
            loadUserTheme(studentID);

            renderSolutions();

        } else {
            document.getElementById('solution-container').innerHTML =
                `<div style="color:red; text-align:center;">${data.message || 'Error loading data'}</div>`;
        }

    } catch (error) {
        console.error("❌ Critical Error:", error);
        document.getElementById('solution-container').innerText = "System Error: Check Console.";
    }
}


function loadUserTheme(username) {
    // Extract year (e.g., "1150" -> "115")
    const admissionYear = username.substring(0, 3);
    const cssPath = `/assets/css/${admissionYear}_summer_solution.css`;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssPath;
    document.head.appendChild(link);
}

/* =========================================
   3. RENDERING LOGIC (The Visuals)
   ========================================= */
function renderSolutions() {
    const container = document.getElementById('solution-container');
    if (!container || !window.examData) return;

    container.innerHTML = ''; // Clear loading text

    window.examData.forEach(block => {
        // Create Block Header
        const blockDiv = document.createElement('div');
        blockDiv.className = 'exam-block';
        blockDiv.innerHTML = `<div class="block-header">${block.title || block.blockTitle}</div>`;

        // Loop through problems
        block.problems.forEach(prob => {
            // Score Calculation
            const maxPoints = prob.points || 5;
            const userScore = prob.userResult.score || 0;

            let scoreClass = 'score-partial', scoreIcon = '⚠️';
            if (userScore === maxPoints) { scoreClass = 'score-correct'; scoreIcon = '✅'; }
            if (userScore === 0) { scoreClass = 'score-wrong'; scoreIcon = '❌'; }

            // Create Problem Card
            const problemCard = document.createElement('div');
            problemCard.className = 'problem-row';

            problemCard.innerHTML = `
                <div class="problem-summary" onclick="toggleDetails(this)">
                    <span style="font-weight:bold; color:#0984e3;">#${prob.id}</span>
                    
                    <div>
                        <span class="tag">${prob.stats ? prob.stats.coverage : 'General'}</span>
                        <span class="stat-text">Type: ${prob.type} | Acc: ${prob.stats ? prob.stats.accuracy : 'N/A'}</span>
                    </div>

                    ${getAnswerBadges(prob)}

                    <div class="score-badge ${scoreClass}">
                        ${scoreIcon} ${userScore}
                    </div>
                    
                    <div style="text-align:right; color:#ccc;">▼</div>
                </div>

                <div class="problem-details">
                    ${prob.image ? `<div class="problem-figure"><img src="${prob.image}" onclick="window.open(this.src)"></div>` : ''}
                    <div class="question-text">${prob.question}</div>
                    <div>${renderOptionsList(prob)}</div>
                </div>
            `;
            blockDiv.appendChild(problemCard);
        });

        container.appendChild(blockDiv);
    });
}

/* =========================================
   4. HELPER FUNCTIONS
   ========================================= */
function getAnswerBadges(prob) {
    if (!prob.options) return '';

    const userChoices = Array.isArray(prob.userResult.choice) ? prob.userResult.choice : [prob.userResult.choice];
    const correctAnswers = Array.isArray(prob.correctAnswer) ? prob.correctAnswer : [prob.correctAnswer];

    return `<div class="badge-container" style="margin-left: 15px; display:flex; gap:5px;">
        ${prob.options.map(opt => {
        const isSelected = userChoices.includes(opt.label);
        const isCorrect = correctAnswers.includes(opt.label);
        const bgClass = isCorrect ? 'bg-correct' : 'bg-wrong';
        const textClass = isSelected ? 'text-selected' : 'text-ignored';
        return `<span class="option-letter-badge ${bgClass} ${textClass}">${opt.label}</span>`;
    }).join('')}
    </div>`;
}

function renderOptionsList(prob) {
    if (!prob.options) return '';

    const userChoices = Array.isArray(prob.userResult.choice) ? prob.userResult.choice : [prob.userResult.choice];
    const correctAnswers = Array.isArray(prob.correctAnswer) ? prob.correctAnswer : [prob.correctAnswer];

    return prob.options.map(opt => {
        const isSelected = userChoices.includes(opt.label);
        const isCorrect = correctAnswers.includes(opt.label);

        let optionClass = 'option-item';
        if (isCorrect) optionClass += ' correct-answer';
        if (isSelected && !isCorrect) optionClass += ' wrong-selection';

        return `
            <div class="${optionClass}">
                <div class="option-header">
                    <span style="font-weight:bold; margin-right:10px;">${opt.label}.</span>
                    <span style="flex-grow:1;">${opt.text}</span>
                </div>
                <div class="option-explanation" style="display:block;">
                    <strong>Analysis:</strong> ${opt.explanation || "N/A"}
                </div>
            </div>
        `;
    }).join('');
}

window.toggleDetails = function (element) {
    const details = element.nextElementSibling;
    if (details) {
        details.style.display = (details.style.display === 'block') ? 'none' : 'block';
    }
};
