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

        return `<span class="option-letter-badge ${stateClass}" onclick="handleBadgeClick(this, event)">${label}</span>`;
    }).join('');

    return `<div class="badge-container">${badgesHtml}</div>`;
}


/* =========================================
   RENDERER
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
            const maxPoints = prob.allocation || prob.points || 5;
            const userScore = prob.userResult.score || 0;

            // Score Logic
            let scoreClass = 'score-partial';
            if (userScore === maxPoints) scoreClass = 'score-perfect';
            else if (userScore === 0) scoreClass = 'score-zero';

            // --- CONTENT LOGIC ---
            let middleContent = '';

            if (prob.type === 'fill') {
                // FILL-IN: Text Summary
                const userVal = prob.userResult.choice || "(Empty)";
                const trueVal = prob.correctAnswer || "";
                const userColor = (userScore === maxPoints) ? '#2ecc71' : '#e74c3c';

                middleContent = `
                    <div class="fill-summary-container">
                        <div class="fill-line">
                            <span class="fill-label">YOU:</span>
                            <span style="color:${userColor}; font-weight:bold; font-family:monospace; font-size:1rem;">${userVal}</span>
                        </div>
                        <div class="fill-line">
                            <span class="fill-label">ANS:</span>
                            <span style="color:#416361; font-weight:bold; font-family:monospace; font-size:1rem;">${trueVal}</span>
                        </div>
                    </div>
                `;
            } else {
                // MULTI/SINGLE: Badges
                middleContent = getAnswerBadges(prob);
            }

            // --- EXPLANATION LOGIC ---
            // We check both prob.explanation (standard) and prob.exp (short)
            const expText = prob.explanation || prob.exp || "";
            const explanationHtml = expText
                ? `<div class="general-explanation"><strong>📝 Explanation:</strong><br>${expText}</div>`
                : '';

            // --- CARD HTML ---
            const problemCard = document.createElement('div');
            problemCard.className = 'problem-row';

            problemCard.innerHTML = `
                <div class="problem-summary" onclick="handleRowClick(this, event)">
                    <span class="clickable-id" 
                          style="font-weight:bold; color:#416361; font-size:1.1em; padding:5px;"
                          onclick="expandFullQuestion(this, event)">
                          #${prob.id}
                    </span>
                    
                    <div style="display:flex; flex-direction:column; justify-content:center;">
                        <div>
                            <span class="tag">${prob.stats ? prob.stats.coverage : 'General'}</span>
                            <span class="tag" style="background:#77A88D;">${prob.stats ? prob.stats.difficulty : 'Normal'}</span>
                        </div>
                        <span class="stat-text">Type: ${prob.type.toUpperCase()} | Acc: ${prob.stats ? prob.stats.accuracy : 'N/A'}</span>
                    </div>

                    ${middleContent}

                    <div class="score-box ${scoreClass}">
                        <span class="score-val">${userScore}</span>
                        <span class="score-alloc">/${maxPoints}</span>
                    </div>
                </div>

                <div class="problem-details" id="details-${prob.id}">
                    ${prob.image ? `<div class="problem-figure"><img src="${prob.image}" onclick="window.open(this.src)"></div>` : ''}
                    
                    <div class="question-text">${prob.question}</div>
                    
                    <div id="options-${prob.id}">${renderOptionsList(prob)}</div>

                    ${explanationHtml}
                </div>
            `;
            blockDiv.appendChild(problemCard);
        });

        container.appendChild(blockDiv);
    });
}


function renderOptionsList(prob) {
    if (!prob.options) return '';

    const userChoices = Array.isArray(prob.userResult.choice) ? prob.userResult.choice : [prob.userResult.choice];
    const correctAnswers = Array.isArray(prob.correctAnswer) ? prob.correctAnswer : [prob.correctAnswer];

    return prob.options.map(opt => {
        const label = opt.label;
        const isSelected = userChoices.includes(label);
        const isCorrect = correctAnswers.includes(label); // Is it in the answer key?

        // 1. Row Color Logic (User vs Truth)
        let rowClass = '';
        if (isSelected && isCorrect) rowClass = 'opt-tp'; // Beige
        else if (!isSelected && !isCorrect) rowClass = 'opt-tn'; // Beige
        else if (!isSelected && isCorrect) rowClass = 'opt-fn'; // Green
        else if (isSelected && !isCorrect) rowClass = 'opt-fp'; // Red

        // 2. Bar Color Logic (Truth Only)
        // Correct (TP/FN) -> Green Bar. Wrong (TN/FP) -> Red Bar.
        const barClass = isCorrect ? 'bar-correct' : 'bar-wrong';

        const percentVal = opt.percent || "0%";

        // Added data-label="${label}" to help find this option later
        return `
            <div class="option-item ${rowClass}" data-label="${label}" onclick="toggleExplanation(this, event)">
                <div class="option-header">
                    <span style="font-weight:bold;">${label}. ${opt.text}</span>
                    <span style="font-size:0.9em; color:#666;">${percentVal}</span>
                </div>
                
                <div class="option-bar-container ${barClass}">
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


/* =========================================
   GLOBAL CONTROLS
   ========================================= */
function toggleAnimation() {
    const isOn = document.getElementById('toggle-animate').checked;
    // Toggles the class that enables the CSS transition
    document.body.classList.toggle('animate-enabled', isOn);
}

function toggleExpandAll() {
    const isOn = document.getElementById('toggle-expand').checked;

    const allDetails = document.querySelectorAll('.problem-details');
    const allExplanations = document.querySelectorAll('.option-explanation');
    const allOptions = document.querySelectorAll('.option-item');

    if (isOn) {
        // Add class to expand everything
        allDetails.forEach(d => d.classList.add('expanded'));
        allExplanations.forEach(e => e.classList.add('expanded'));
        allOptions.forEach(o => o.classList.add('show-explanation')); // Keeps visual style
    } else {
        // Remove class to collapse everything
        allDetails.forEach(d => d.classList.remove('expanded'));
        allExplanations.forEach(e => e.classList.remove('expanded'));
        allOptions.forEach(o => o.classList.remove('show-explanation'));
    }
}

/* =========================================
   CLICK HANDLERS (Updated for Animation)
   ========================================= */

// Behavior 1: Click ID -> Expand Details + Show ALL Explanations
function expandFullQuestion(idSpan, event) {
    event.stopPropagation();

    // 1. Expand the Question
    const summary = idSpan.closest('.problem-summary');
    const details = summary.nextElementSibling;
    details.classList.add('expanded'); // <--- CSS Transition triggers here

    // 2. Expand ALL Options inside
    const allOptions = details.querySelectorAll('.option-item');
    allOptions.forEach(opt => {
        opt.classList.add('show-explanation');
        const exp = opt.querySelector('.option-explanation');
        if (exp) exp.classList.add('expanded');
    });
}

// Behavior 2: Click Badge -> Expand Details + Show THAT Explanation
function handleBadgeClick(badge, event) {
    event.stopPropagation();

    const summary = badge.closest('.problem-summary');
    const details = summary.nextElementSibling;

    // 1. Ensure Question is Open
    if (!details.classList.contains('expanded')) {
        details.classList.add('expanded');
    }

    // 2. Find and Open Target Option
    const letter = badge.innerText.trim();
    const targetOption = details.querySelector(`.option-item[data-label="${letter}"]`);

    if (targetOption) {
        targetOption.classList.add('show-explanation');
        const exp = targetOption.querySelector('.option-explanation');
        if (exp) {
            exp.classList.add('expanded');
            // Optional: Scroll to it after a tiny delay so animation starts first
            setTimeout(() => {
                targetOption.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }
}

// Behavior 3: Click Blank (Row) -> Toggle Details ONLY
function handleRowClick(summary, event) {
    const details = summary.nextElementSibling;

    // Toggle the class
    const isNowOpen = details.classList.toggle('expanded');

    // If closing, we should probably close the inner explanations too for neatness
    if (!isNowOpen) {
        const allExps = details.querySelectorAll('.option-explanation');
        allExps.forEach(e => e.classList.remove('expanded'));
    }
}

// Helper: Toggle single explanation
function toggleExplanation(optionDiv, event) {
    event.stopPropagation();

    const exp = optionDiv.querySelector('.option-explanation');

    // Toggle Class instead of display
    const isNowOpen = exp.classList.toggle('expanded');

    if (isNowOpen) optionDiv.classList.add('show-explanation');
    else optionDiv.classList.remove('show-explanation');
}