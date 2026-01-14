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
            const userAnswers = userFile.answers || {};
            const userScores = userFile.scores || {};

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
   1. BADGE GENERATOR (Aligns A-E)
   ========================================= */
function getAnswerBadges(prob) {
    if (!prob.options) return '<div class="badge-container"></div>';

    // Normalize inputs
    const userChoices = Array.isArray(prob.userResult.choice) ? prob.userResult.choice : [prob.userResult.choice];
    const correctAnswers = Array.isArray(prob.correctAnswer) ? prob.correctAnswer : [prob.correctAnswer];

    // Force A-E Grid
    const slots = ['A', 'B', 'C', 'D', 'E', 'F'];

    const badgesHtml = slots.map(label => {
        // 1. Check if option exists in the question
        const optExists = prob.options.some(o => o.label === label);

        if (!optExists) {
            // Invisible placeholder to maintain alignment
            return `<span class="badge-placeholder"></span>`;
        }

        // 2. Determine State (1 or 0)
        const userChose = userChoices.includes(label);    // (1) or (0)
        const isAnswer = correctAnswers.includes(label); // (1) or (0)

        // 3. Apply Truth Table Logic
        let stateClass = '';

        if (userChose && isAnswer) {
            // Case (1,1): True Positive -> Green, Border
            stateClass = 'case-tp';
        }
        else if (userChose && !isAnswer) {
            // Case (1,0): False Positive -> Red, Border
            stateClass = 'case-fp';
        }
        else if (!userChose && isAnswer) {
            // Case (0,1): False Negative -> Red, Faded
            stateClass = 'case-fn';
        }
        else {
            // Case (0,0): True Negative -> Green, Faded
            stateClass = 'case-tn';
        }

        return `<span class="option-letter-badge ${stateClass}">${label}</span>`;
    }).join('');

    return `<div class="badge-container">${badgesHtml}</div>`;
}


/* =========================================
   2. RENDERER (Clean Layout)
   ========================================= */
/* =========================================
   UPDATED RENDERER (Score / Allocation)
   ========================================= */
function renderSolutions() {
    const container = document.getElementById('solution-container');
    if (!container || !window.examData) return;

    container.innerHTML = '';

    window.examData.forEach(block => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'exam-block';
        blockDiv.innerHTML = `<div class="block-header">${block.title || block.blockTitle}</div>`;

        block.problems.forEach(prob => {
            // 1. Get Points (Allocation from JSON)
            const maxPoints = prob.allocation || prob.points || 5;
            const userScore = prob.userResult.score || 0;

            // 2. Determine Score Box Style
            let scoreClass = 'score-partial';
            if (userScore === maxPoints) scoreClass = 'score-perfect';
            else if (userScore === 0) scoreClass = 'score-zero';

            const problemCard = document.createElement('div');
            problemCard.className = 'problem-row';

            problemCard.innerHTML = `
                <div class="problem-summary" onclick="toggleDetails(this)">
                    <span style="font-weight:bold; color:#416361; font-size:1.1em;">#${prob.id}</span>
                    
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div>
                            <span class="tag">${prob.stats ? prob.stats.coverage : 'General'}</span>
                            <span class="tag" style="background:#77A88D;">${prob.stats ? prob.stats.difficulty : 'Normal'}</span>
                        </div>
                        <span class="stat-text">Type: ${prob.type.toUpperCase()} | Acc: ${prob.stats ? prob.stats.accuracy : 'N/A'}</span>
                    </div>

                    ${getAnswerBadges(prob)}

                    <div class="score-box ${scoreClass}">
                        <span class="score-val">${userScore}</span>
                        <span class="score-alloc">/${maxPoints}</span>
                    </div>
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
   UPDATED OPTION LIST (Colors & Percents)
   ========================================= */
function renderOptionsList(prob) {
    if (!prob.options) return '';

    // Normalize Data
    const userChoices = Array.isArray(prob.userResult.choice) ? prob.userResult.choice : [prob.userResult.choice];
    const correctAnswers = Array.isArray(prob.correctAnswer) ? prob.correctAnswer : [prob.correctAnswer];

    return prob.options.map(opt => {
        const label = opt.label;

        // --- 1. Determine Truth Table State ---
        const isSelected = userChoices.includes(label);
        const isCorrect = correctAnswers.includes(label);

        let rowClass = '';
        if (isSelected && isCorrect) rowClass = 'opt-tp'; // True Positive (Beige)
        else if (!isSelected && !isCorrect) rowClass = 'opt-tn'; // True Negative (Beige)
        else if (!isSelected && isCorrect) rowClass = 'opt-fn'; // False Negative (Green - Missed!)
        else if (isSelected && !isCorrect) rowClass = 'opt-fp'; // False Positive (Red - Wrong!)

        // --- 2. Percentage Bar ---
        const percentVal = opt.percent || "0%";

        return `
            <div class="option-item ${rowClass}" onclick="toggleExplanation(this)">
                <div class="option-header">
                    <span style="font-weight:bold;">${label}. ${opt.text}</span>
                    <span style="font-size:0.9em; color:#666;">${percentVal}</span>
                </div>
                
                <div class="option-bar-container">
                    <div class="option-bar-fill" style="width: ${percentVal};"></div>
                </div>

                <div class="option-explanation">
                    ${opt.explanation || 'No explanation provided.'}
                </div>
            </div>
        `;
    }).join('');
}


/* =========================================
   INTERACTION HANDLERS
   ========================================= */

// 1. Toggle the "Details" (Question Image & Options)
function toggleDetails(summaryDiv) {
    const detailsDiv = summaryDiv.nextElementSibling;
    if (detailsDiv) {
        const isHidden = detailsDiv.style.display === 'none' || detailsDiv.style.display === '';
        detailsDiv.style.display = isHidden ? 'block' : 'none';

        // Optional: Highlight the summary row when open
        summaryDiv.style.background = isHidden ? '#E8E4D9' : '';
    }
}

// 2. Toggle the "Explanation" (Option Dropdown)
function toggleExplanation(optionDiv) {
    // We toggle a class on the PARENT div (.option-item)
    // The CSS rule ".show-explanation .option-explanation" handles the display
    optionDiv.classList.toggle('show-explanation');
}