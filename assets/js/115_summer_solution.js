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
        // Change "115001" to a username that actually has a result file in your folder
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
            // 2. THE MERGE FIX: Combine "Exam Questions" with "User Results"
            // The server sends 'exam' (questions) and 'result' (answers) separately.
            // We need to stitch them together so the UI can read them.

            // 1. Get the raw object
            let rawExam = data.exam;

            // 2. SAFETY CHECK: If it's an object (not an array), convert it!
            if (!Array.isArray(rawExam)) {
                console.log("⚠️ Converting Exam Object to Array...");

                // This turns { "b1": {...}, "b2": {...} } into [ {...}, {...} ]
                rawExam = Object.values(rawExam);
            }            const userResults = data.result || {};

            // Loop through every block and every problem to attach the user's score
            rawExam.forEach(block => {
                block.problems.forEach(prob => {
                    // Find the answer for this specific problem ID (e.g., "1")
                    // If no answer found, give it a default "0 score" object
                    prob.userResult = userResults[prob.id] || { score: 0, choice: [] };
                });
            });

            // 3. Save the merged data globally
            window.examData = rawExam;

            // 4. Load the Theme (CSS)
            // Use the username sent in the request, or default to "115"
            loadUserTheme("1150");

            // 5. Draw the screen
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
