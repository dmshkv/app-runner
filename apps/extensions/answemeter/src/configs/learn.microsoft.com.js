// Configuration for Microsoft Learn
export const config = {
  // Site identification
  hostPattern: /learn\.microsoft\.com/,
  siteName: 'Microsoft Learn',
  
  // DOM selectors
  selectors: {
    quizContainer: '.modular-content-container form',
    questionFieldset: 'fieldset[aria-label*="question"]',
    choiceLabel: '.quiz-choice',
    radioInput: 'input[type="radio"]',
    checkboxInput: 'input[type="checkbox"]'
  },
  
  // Content detection
  detection: {
    titlePatterns: ['Practice Assessment', 'Exam', 'Quiz'],
    quizIndicators: [
      '.modular-content-container form',
      'fieldset[aria-label*="question"]',
      '.quiz-choice'
    ]
  },
  
  // Change detection settings
  monitoring: {
    checkIntervalMs: 1000,
    changeThreshold: 0.15, // 15% difference triggers reprocessing
    waitForFormMs: 5000 // Max wait time for quiz form to appear
  },
  
  // AI prompt configuration
  prompt: {
    system: 'You are analyzing a quiz question HTML from Microsoft Learn certification practice assessments. Your task is to identify ALL correct answers.',
    
    instructions: `IMPORTANT INSTRUCTIONS:
1. Look for text that indicates HOW MANY answers to select:
   - "Which THREE actions..." = select 3 answers
   - "Which TWO statements..." = select 2 answers  
   - "Each correct answer presents a complete solution" = multiple answers may be correct
   - "Select all that apply" = multiple answers
   - Single radio buttons = only 1 answer
   - Checkboxes = potentially multiple answers

2. Identify if it's a single choice (radio input type="radio") or multiple choice (checkbox input type="checkbox")

3. Based on the question text and input types, determine ALL correct answers

4. Return the input element IDs (from id="..." attribute) for ALL correct choices

5. If the question asks for THREE actions, return exactly 3 choiceIds
   If it asks for TWO, return exactly 2 choiceIds
   If it's single choice, return exactly 1 choiceId

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "answers": [{
    "choiceId": "input-element-id-here",
    "answer": "Brief description",
    "confidence": 95
  }]
}

Make sure to return ALL correct answers as indicated by the question text.`,
    
    template: (html) => `You are analyzing a quiz question HTML from Microsoft Learn certification practice assessments. Your task is to identify ALL correct answers.

Here is the quiz form HTML:

${html}

IMPORTANT INSTRUCTIONS:
1. Look for text that indicates HOW MANY answers to select:
   - "Which THREE actions..." = select 3 answers
   - "Which TWO statements..." = select 2 answers  
   - "Each correct answer presents a complete solution" = multiple answers may be correct
   - "Select all that apply" = multiple answers
   - Single radio buttons = only 1 answer
   - Checkboxes = potentially multiple answers

2. Identify if it's a single choice (radio input type="radio") or multiple choice (checkbox input type="checkbox")

3. Based on the question text and input types, determine ALL correct answers

4. Return the input element IDs (from id="..." attribute) for ALL correct choices

5. If the question asks for THREE actions, return exactly 3 choiceIds
   If it asks for TWO, return exactly 2 choiceIds
   If it's single choice, return exactly 1 choiceId

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "answers": [{
    "choiceId": "input-element-id-here",
    "answer": "Brief description",
    "confidence": 95
  }]
}

Make sure to return ALL correct answers as indicated by the question text.`
  },
  
  // Highlighting configuration (stealth mode)
  highlighting: {
    enabled: false, // Currently disabled
    style: {
      boxShadow: '0 0 0 1px rgba(76, 175, 80, 0.15)'
    }
  }
};
