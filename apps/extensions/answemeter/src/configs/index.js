// Config loader - dynamically loads site-specific configuration
import { config as learnMicrosoftConfig } from './learn.microsoft.com.js';
import { config as datacampConfig } from './datacamp.com.js';

const configs = [
  learnMicrosoftConfig,
  datacampConfig
];

// Get configuration for current site
export function getConfigForSite(hostname) {
  const config = configs.find(cfg => cfg.hostPattern.test(hostname));
  
  if (!config) {
    console.warn(`[Config] No configuration found for ${hostname}, using default`);
    return getDefaultConfig();
  }
  
  console.log(`[Config] Loaded configuration for ${config.siteName}`);
  return config;
}

// Get current site config
export function getCurrentSiteConfig() {
  return getConfigForSite(window.location.hostname);
}

// Default/fallback configuration
function getDefaultConfig() {
  return {
    hostPattern: /.*/,
    siteName: 'Generic Quiz Site',
    
    selectors: {
      quizContainer: 'form',
      questionFieldset: 'fieldset',
      choiceLabel: 'label',
      radioInput: 'input[type="radio"]',
      checkboxInput: 'input[type="checkbox"]'
    },
    
    detection: {
      titlePatterns: ['Quiz', 'Question', 'Assessment', 'Test', 'Exam'],
      quizIndicators: [
        'form',
        'fieldset',
        'input[type="radio"]',
        'input[type="checkbox"]'
      ]
    },
    
    monitoring: {
      checkIntervalMs: 1000,
      changeThreshold: 0.15,
      waitForFormMs: 5000
    },
    
    prompt: {
      system: 'You are analyzing a quiz question. Your task is to identify ALL correct answers.',
      
      template: (html) => `Analyze this quiz question HTML and identify ALL correct answers.

${html}

Return ONLY valid JSON:
{
  "answers": [{
    "choiceId": "input-element-id-here",
    "answer": "Brief description",
    "confidence": 95
  }]
}`
    },
    
    highlighting: {
      enabled: false,
      style: {
        boxShadow: '0 0 0 1px rgba(76, 175, 80, 0.15)'
      }
    }
  };
}
