// web/exam_data.js
const examData = [
  {
    blockTitle: "Block 1: Basic Concepts",
    problems: [
      {
        id: 1,
        type: "single", // Type 1: Single Choice
        question: "Which element has the highest electronegativity?",
        tags: ["Periodic Table", "Properties"],
        stats: { difficulty: "Easy", accuracy: "85%", coverage: "Inorganic" },
        userResult: { choice: "B", score: 0, isCorrect: false }, // Mock User Data
        correctAnswer: "A",
        options: [
          { label: "A", text: "Fluorine (F)", percent: "85%", explanation: "Fluorine is the most electronegative element (3.98)." },
          { label: "B", text: "Chlorine (Cl)", percent: "10%", explanation: "Chlorine is high, but less than Fluorine." },
          { label: "C", text: "Oxygen (O)", percent: "3%", explanation: "Incorrect." },
          { label: "D", text: "Neon (Ne)", percent: "2%", explanation: "Noble gases are stable." }
        ]
      },
      {
        id: 2,
        type: "multi", // Type 2: Multiple Choice
        question: "Which of the following are strong acids? (Select 2)",
        tags: ["Acids/Bases"],
        stats: { difficulty: "Hard", accuracy: "45%", coverage: "Stoichiometry" },
        userResult: { choice: ["A", "C"], score: 5, isCorrect: true },
        correctAnswer: ["A", "C"],
        options: [
          { label: "A", text: "HCl", percent: "90%", explanation: "Correct. Hydrochloric acid is a strong acid." },
          { label: "B", text: "CH3COOH", percent: "40%", explanation: "Incorrect. Acetic acid is weak." },
          { label: "C", text: "H2SO4", percent: "88%", explanation: "Correct. Sulfuric acid is strong." },
          { label: "D", text: "HF", percent: "60%", explanation: "Incorrect. HF is a weak acid." },
          { label: "E", text: "NH3", percent: "10%", explanation: "Incorrect. Ammonia is a base." }
        ]
      },
      {
        id: 3,
        type: "fill", // Type 3: Fill in Blank
        question: "Calculate the molar mass of Water (H2O).",
        tags: ["Calculation"],
        stats: { difficulty: "Medium", accuracy: "92%", coverage: "Stoichiometry" },
        userResult: { input: "18", score: 5, isCorrect: true },
        correctAnswer: "18",
        explanation: "2 * 1.008 (H) + 16.00 (O) ≈ 18.02 g/mol"
      }
    ]
  },
  // You can add more blocks here (Block 2, Block 3...)
  {
    blockTitle: "Block 2: Organic Chemistry",
    problems: [] 
  }
];