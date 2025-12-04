// Google Docs Offline - Background Service Worker
// Handles API calls, selector detection, and communication with content script

// Extension console output
const DEBUG = true;
const log = (...args) => console.log('[Background]', ...args);

// Session storage for detected selectors (per tab)
const tabSelectors = new Map();

// Site-specific configurations
const SITE_CONFIGS = {
  'learn.microsoft.com': {
    hostPattern: 'learn.microsoft.com',
    siteName: 'Microsoft Learn',
    selectors: {
      quizContainer: '.modular-content-container form',
      questionFieldset: 'fieldset[aria-label*="question"]',
      choiceLabel: '.quiz-choice'
    },
    monitoring: {
      checkIntervalMs: 1000,
      changeThreshold: 0.15,
      waitForFormMs: 5000
    }
  },
  'datacamp.com': {
    hostPattern: 'datacamp.com',
    siteName: 'DataCamp',
    selectors: {
      quizContainer: '.exercise--content',
      questionFieldset: '.dc-question',
      choiceLabel: '.dc-choice-label'
    },
    monitoring: {
      checkIntervalMs: 1000,
      changeThreshold: 0.15,
      waitForFormMs: 5000
    }
  },
  'default': {
    hostPattern: '*',
    siteName: 'Generic Quiz Site',
    selectors: {
      quizContainer: 'form',
      questionFieldset: 'fieldset',
      choiceLabel: 'label'
    },
    monitoring: {
      checkIntervalMs: 1000,
      changeThreshold: 0.15,
      waitForFormMs: 5000
    }
  }
};

// Get config for hostname
function getSiteConfig(hostname) {
  return SITE_CONFIGS[hostname] || SITE_CONFIGS['default'];
}

// AI Configuration - Will be loaded from chrome.storage
let AI_CONFIG = {
  apiKey: null,
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o',
  maxTokens: 1000,
  temperature: 0.3
};

// Load config from storage
async function loadConfig() {
  const config = await chrome.storage.local.get(['apiKey', 'model']);
  
  if (config.apiKey) {
    AI_CONFIG.apiKey = config.apiKey;
    AI_CONFIG.model = config.model || 'gpt-4o';
    
    log('✅ Configuration loaded:', {
      model: AI_CONFIG.model,
      hasKey: !!AI_CONFIG.apiKey
    });
  } else {
    log('⚠️ No API configuration found. Please configure in popup.');
  }
}

// Load config on startup
loadConfig();

// Store processed pages to avoid reprocessing
const processedPages = new Map();

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'detectSelectors') {
    handleSelectorDetection(message.html, message.url, message.payloadSize, sender.tab.id)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'processContent') {
    handleContentProcessing(message.content, message.selectors, sender.tab.id)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'getSiteConfig') {
    const config = getSiteConfig(message.hostname);
    sendResponse({ config });
    return true;
  }
  
  if (message.action === 'reloadConfig') {
    loadConfig().then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (message.action === 'testConnection') {
    testConnection().then(response => sendResponse(response));
    return true;
  }
});

// Test connection to AI API
async function testConnection() {
  try {
    if (!AI_CONFIG.apiKey) {
      return { success: false, error: 'No API key configured' };
    }
    
    const testPrompt = 'Say "OK" if you can read this.';
    const response = await callAIAPI(testPrompt, '<div>test</div>');
    
    return { success: true, response: 'Connection successful!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle selector detection
async function handleSelectorDetection(html, url, payloadSize, tabId) {
  log('🔍 Selector detection requested');
  log('📊 Payload size:', formatBytes(payloadSize));
  log('🌐 URL:', url);
  
  try {
    // Prepare prompt for LLM to detect selectors
    const prompt = `You are analyzing a web page HTML to identify stable CSS selectors for quiz/assessment elements.

Here is the sanitized HTML (${formatBytes(payloadSize)}) from the page body:

${html}

TASK: Identify stable, unique CSS selectors for the following quiz elements:

1. **quizBlock**: The main container that wraps the entire quiz/question (e.g., form, section, div)
2. **quizQuestionNr**: The element showing question number (e.g., "Question 1 of 10") - can be null if not present
3. **quizQuestion**: The element containing the question text
4. **quizAnswers**: An array selector that matches ALL answer choices/options (e.g., labels, divs with choices)

REQUIREMENTS:
- Selectors must be stable (use class names, data attributes, or structural patterns that won't change)
- Prefer CSS selectors over XPath
- Selectors should be as specific as needed but not overly fragile
- For quizAnswers, provide a selector that matches ALL answer elements (will be used with querySelectorAll)
- If an element doesn't exist, return null for that selector

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "selectors": {
    "quizBlock": "form.quiz-form",
    "quizQuestionNr": ".question-number",
    "quizQuestion": ".question-text",
    "quizAnswers": ".answer-choice"
  }
}`;

    // Call LLM API
    const selectors = await callSelectorDetectionAPI(prompt);
    
    // Store selectors for this tab
    if (selectors) {
      tabSelectors.set(tabId, selectors);
      log('✅ Selectors detected and stored:', selectors);
    }
    
    return {
      success: true,
      selectors: selectors
    };
  } catch (error) {
    log('❌ Error detecting selectors:', error);
    return {
      success: false,
      error: error.message,
      selectors: null
    };
  }
}

// Call API for selector detection
async function callSelectorDetectionAPI(prompt) {
  // Ensure config is loaded
  await loadConfig();
  
  // Check if API key is configured
  if (!AI_CONFIG.apiKey) {
    log('⚠️ API key not configured, using fallback selectors');
    return getFallbackSelectors();
  }
  
  log('🤖 Calling OpenAI API for selector detection');
  log('Model:', AI_CONFIG.model);
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AI_CONFIG.apiKey}`
  };
  
  const requestBody = {
    model: AI_CONFIG.model,
    messages: [
      {
        role: 'system',
        content: 'You are a web scraping expert. Analyze HTML and return stable CSS selectors in valid JSON format.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 500,
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };
  
  const response = await fetch(AI_CONFIG.apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    log('API error response:', errorText);
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const aiResponse = data.choices[0].message.content;
  
  log('📨 Raw AI Response:', aiResponse);
  
  // Parse JSON response
  try {
    const parsed = JSON.parse(aiResponse);
    log('✅ Parsed selectors:', parsed.selectors);
    return parsed.selectors;
  } catch (error) {
    log('❌ Failed to parse response:', error);
    return getFallbackSelectors();
  }
}

// Fallback selectors if API is not configured
function getFallbackSelectors() {
  log('Using fallback selectors for common quiz patterns');
  return {
    quizBlock: 'form, .quiz-container, .assessment-container, [role="form"]',
    quizQuestionNr: '.question-number, .question-count, [class*="question-num"]',
    quizQuestion: '.question-text, .question, legend, [class*="question"]',
    quizAnswers: 'label, .answer, .choice, [class*="answer"], [class*="choice"]'
  };
}

// Format bytes helper
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Process content (updated to use selectors)
async function handleContentProcessing(content, selectors, tabId) {
  log('📥 Processing content from:', content.url);
  log('Using selectors:', selectors);
  log('Content details:', {
    pageType: content.pageType,
    hasQuizHtml: !!content.quizHtml,
    htmlLength: content.quizHtml?.length || 0
  });
  
  // Create cache key from URL + hash of HTML content to detect changes
  const htmlHash = content.quizHtml ? simpleHash(content.quizHtml) : '';
  const cacheKey = `${content.url}#${htmlHash}`;
  
  // Check if already processed
  if (processedPages.has(cacheKey)) {
    log('✨ Using cached result for this exact question');
    return processedPages.get(cacheKey);
  }
  
  try {
    // Get enhancements
    const enhancements = await getEnhancements(content);
    
    const result = {
      success: true,
      enhancements: enhancements,
      timestamp: new Date().toISOString()
    };
    
    // Cache result
    processedPages.set(cacheKey, result);
    
    // Clean up old cache entries (keep last 20)
    if (processedPages.size > 20) {
      const firstKey = processedPages.keys().next().value;
      processedPages.delete(firstKey);
    }
    
    return result;
  } catch (error) {
    log('Error processing content:', error);
    return {
      success: false,
      error: error.message,
      enhancements: []
    };
  }
}

// Simple hash function for cache key
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

// Get enhancements for the content
async function getEnhancements(content) {
  log('Requesting enhancements...');
  
  // Validate content has required fields
  if (!content.quizHtml) {
    log('⚠️ No quiz HTML found in content, cannot process');
    return [];
  }
  
  // Prepare prompt with raw HTML
  const prompt = `You are analyzing a quiz question HTML from Microsoft Learn certification practice assessments. Your task is to identify ALL correct answers and provide all available options.

Here is the quiz form HTML:

${content.quizHtml}

IMPORTANT INSTRUCTIONS:
1. Extract ALL available answer options from the HTML (all labels with input elements)

2. Look for text that indicates HOW MANY answers to select:
   - "Which THREE actions..." = select 3 answers
   - "Which TWO statements..." = select 2 answers  
   - "Each correct answer presents a complete solution" = multiple answers may be correct
   - "Select all that apply" = multiple answers
   - Single radio buttons = only 1 answer
   - Checkboxes = potentially multiple answers

3. Identify if it's a single choice (radio input type="radio") or multiple choice (checkbox input type="checkbox")

4. Based on the question text and input types, determine which answers are correct

5. Return ALL options as an array, and mark which ones should be chosen (isCorrect: true)

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "questionText": "The full question text",
  "questionType": "single-choice" or "multiple-choice",
  "options": [
    {
      "choiceId": "input-element-id-here",
      "text": "The full text of this answer option",
      "isCorrect": true,
      "confidence": 95
    },
    {
      "choiceId": "input-element-id-here-2",
      "text": "The full text of this answer option",
      "isCorrect": false,
      "confidence": 90
    }
  ],
  "correctAnswers": ["input-element-id-here"],
  "expectedAnswerCount": 1
}

Make sure to include ALL options found in the HTML, and mark which ones are correct.`;

  try {
    // Call API
    const enhancements = await callAIAPI(prompt, content.quizHtml);
    return enhancements;
  } catch (error) {
    log('API error:', error);
    // Return empty if fails
    return [];
  }
}

// Call API (OpenAI format)
async function callAIAPI(prompt, quizHtml) {
  // Ensure config is loaded
  await loadConfig();
  
  // Check if API key is configured
  if (!AI_CONFIG.apiKey) {
    log('⚠️  API key not configured, using mock data');
    log('📄 HTML snippet:', quizHtml.substring(0, 500) + '...');
    log('To use real AI: Configure API key in extension popup');
    return getMockAnswers(quizHtml);
  }
  
  log('🤖 Calling OpenAI API:', AI_CONFIG.apiUrl);
  log('Model:', AI_CONFIG.model);
  log('API Key present:', AI_CONFIG.apiKey.substring(0, 7) + '...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AI_CONFIG.apiKey}`
  };
  
  const requestBody = {
    model: AI_CONFIG.model,
    messages: [
      {
        role: 'system',
        content: 'You are a quiz answer analyzer. Return only valid JSON with correct answer IDs.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: AI_CONFIG.maxTokens,
    temperature: AI_CONFIG.temperature,
    response_format: { type: 'json_object' }
  }
  
  const response = await fetch(AI_CONFIG.apiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    log('API error response:', errorText);
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const aiResponse = data.choices[0].message.content;
  
  log('📨 Raw AI Response:', aiResponse);
  
  // Parse JSON response
  try {
    const parsed = JSON.parse(aiResponse);
    log('✅ Parsed response:', parsed);
    
    // Handle new format with options array
    if (parsed.options && Array.isArray(parsed.options)) {
      log(`✅ Found ${parsed.options.length} total option(s)`);
      log(`✅ Correct answers: ${parsed.correctAnswers?.length || 0}`);
      
      // Return the full parsed response with all options
      return {
        questionText: parsed.questionText,
        questionType: parsed.questionType,
        options: parsed.options,
        correctAnswers: parsed.correctAnswers,
        expectedAnswerCount: parsed.expectedAnswerCount
      };
    }
    
    // Handle old format for backwards compatibility
    let enhancements;
    if (Array.isArray(parsed)) {
      enhancements = parsed;
    } else if (parsed.answers && Array.isArray(parsed.answers)) {
      enhancements = parsed.answers;
    } else {
      enhancements = [parsed];
    }
    
    log(`✅ Found ${enhancements.length} answer(s) (legacy format)`);
    return enhancements;
  } catch (error) {
    log('❌ Failed to parse response:', error);
    log('Response was:', aiResponse);
    return [];
  }
}

// Mock answers for testing without API key
function getMockAnswers(quizHtml) {
  // Parse the HTML to find actual input IDs and labels
  log('🔍 Analyzing HTML for input IDs and options...');
  
  // Create a temporary DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(quizHtml, 'text/html');
  
  // Extract all input elements
  const inputs = doc.querySelectorAll('input[type="radio"], input[type="checkbox"]');
  const options = [];
  
  inputs.forEach((input, index) => {
    const inputId = input.id;
    const label = doc.querySelector(`label[for="${inputId}"]`) || input.closest('label');
    const text = label ? label.textContent.trim() : `Option ${index + 1}`;
    
    options.push({
      choiceId: inputId,
      text: text,
      isCorrect: index === 1, // Mock: mark second option as correct
      confidence: 85
    });
  });
  
  log('Found options:', options);
  
  // Determine question type
  const questionType = inputs[0]?.type === 'radio' ? 'single-choice' : 'multiple-choice';
  const correctAnswers = options.filter(opt => opt.isCorrect).map(opt => opt.choiceId);
  
  return {
    questionText: 'Mock Question Text',
    questionType: questionType,
    options: options,
    correctAnswers: correctAnswers,
    expectedAnswerCount: correctAnswers.length
  };
}

// Handle installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    log('Extension installed');
    // Silent install, no popup
  }
});

// Clean up tab selectors when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabSelectors.has(tabId)) {
    tabSelectors.delete(tabId);
    log(`🧹 Cleaned up selectors for closed tab ${tabId}`);
  }
});
