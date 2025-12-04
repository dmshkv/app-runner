// Configuration for DataCamp
export const config = {
  // Site identification
  hostPattern: /datacamp\.com/,
  siteName: 'DataCamp',
  
  // DOM selectors - customize for DataCamp's structure
  selectors: {
    quizContainer: '.exercise--content',
    questionFieldset: '.dc-question',
    choiceLabel: '.dc-choice-label',
    radioInput: 'input[type="radio"]',
    checkboxInput: 'input[type="checkbox"]'
  },
  
  // Content detection
  detection: {
    titlePatterns: ['Exercise', 'Question', 'Quiz'],
    quizIndicators: [
      '.exercise--content',
      '.dc-question',
      '.dc-choice-label'
    ]
  },
  
  // Change detection settings
  monitoring: {
    checkIntervalMs: 1000,
    changeThreshold: 0.15,
    waitForFormMs: 5000
  },
  
  // AI prompt configuration
  prompt: {
    system: 'You are analyzing a quiz question from DataCamp. Your task is to identify ALL correct answers.',
    
    template: (html) => `You are analyzing a quiz question from DataCamp exercises. Your task is to identify ALL correct answers.

Here is the question HTML:

${html}

IMPORTANT INSTRUCTIONS:
1. Look for text that indicates HOW MANY answers to select
2. Identify if it's single choice (radio) or multiple choice (checkbox)
3. Return the input element IDs for ALL correct choices

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
  
  // Highlighting configuration
  highlighting: {
    enabled: false,
    style: {
      boxShadow: '0 0 0 1px rgba(76, 175, 80, 0.15)'
    }
  }
};
