// Google Docs Offline - Content Script
// Tracks page navigation and processes quiz content with LLM-detected selectors

// Note: htmlSanitizer.js and sessionManager.js are loaded before this file via manifest.json
// They expose: sanitizeHTML, getSanitizedBodyHTML, sessionManager

// Extension console output
const DEBUG = true;
const log = (...args) => DEBUG && console.log('[Extension]', ...args);

// Immediate startup log
console.log('[Extension] 🚀 Content script loaded and running!');
console.log('[Extension] Current URL:', window.location.href);
console.log('[Extension] Document ready state:', document.readyState);

let currentUrl = window.location.href;
let isProcessing = false;
let isInitialLoad = true;
let lastProcessedHtml = null;
let changeCheckInterval = null;

// Initialize session on page load
async function initializeSession() {
  log('🎬 Initializing new session...');
  
  // Reset session state
  sessionManager.reset();
  
  // Wait for page to be fully loaded
  await waitForPageFullyLoaded();
  
  // Check if selectors are already being detected
  if (sessionManager.isDetecting()) {
    log('⏳ Selector detection already in progress...');
    return;
  }
  
  // Detect selectors if not already initialized
  if (!sessionManager.isSelectorsInitialized()) {
    log('🔍 Selectors not initialized, starting detection...');
    await detectSelectors();
  } else {
    log('✅ Selectors already initialized for this session');
  }
}

// Wait for page to be fully loaded
function waitForPageFullyLoaded() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      log('✅ Page already loaded');
      // Additional wait for client-side rendering
      setTimeout(resolve, 500);
    } else {
      window.addEventListener('load', () => {
        log('✅ Page load event fired');
        // Additional wait for client-side rendering
        setTimeout(resolve, 500);
      }, { once: true });
    }
  });
}

// Detect selectors using LLM
async function detectSelectors() {
  sessionManager.startDetection();
  
  try {
    log('📦 Preparing to send page body to LLM for selector detection...');
    
    // Get sanitized body HTML
    const sanitizedData = getSanitizedBodyHTML();
    
    if (!sanitizedData) {
      log('❌ Failed to get sanitized body HTML');
      sessionManager.endDetection();
      return;
    }
    
    log(`📊 Payload size: Original=${formatBytes(sanitizedData.originalSize)}, Sanitized=${formatBytes(sanitizedData.sanitizedSize)}, Reduction=${sanitizedData.reduction}`);
    
    // Send to background script for LLM processing
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'detectSelectors',
        html: sanitizedData.sanitized,
        url: window.location.href,
        payloadSize: sanitizedData.sanitizedSize
      }, resolve);
    });
    
    if (response && response.success && response.selectors) {
      log('✅ Selectors detected:', response.selectors);
      sessionManager.setSelectors(response.selectors);
    } else {
      log('❌ Failed to detect selectors:', response?.error);
    }
  } catch (error) {
    log('❌ Error detecting selectors:', error);
  } finally {
    sessionManager.endDetection();
  }
}

// Helper to get selector from session
function getSelector(key) {
  const selector = sessionManager.getSelector(key);
  if (!selector) {
    log(`⚠️ Selector '${key}' not found in session`);
  }
  return selector;
}

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Track page navigation
function detectPageChange() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl && !isProcessing) {
    log('🔄 PAGE CHANGED (client-side navigation):', newUrl);
    currentUrl = newUrl;
    // Reset session on page change
    initializeSession().then(() => {
      handlePageLoad('PAGE CHANGED');
    });
  }
}

// Wait for quiz content to appear (using detected selectors)
function waitForQuizContent() {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const timeout = 5000; // 5 seconds timeout
    
    const checkQuizContent = () => {
      // Use detected selectors to find quiz content
      const quizBlockSelector = getSelector('quizBlock');
      if (!quizBlockSelector) {
        log('⚠️ Quiz block selector not available, using fallback');
        setTimeout(resolve, 300);
        return;
      }
      
      const quizBlock = document.querySelector(quizBlockSelector);
      
      if (quizBlock) {
        const elapsed = Date.now() - startTime;
        log(`✅ Quiz content found after ${elapsed}ms`);
        setTimeout(resolve, 300);
      } else if (Date.now() - startTime > timeout) {
        const elapsed = Date.now() - startTime;
        log(`⏱️ Timeout waiting for quiz content (${elapsed}ms)`);
        resolve();
      } else {
        setTimeout(checkQuizContent, 100);
      }
    };
    
    checkQuizContent();
  });
}

// Extract page content using detected selectors
function extractPageContent() {
  const content = {
    url: window.location.href,
    title: document.title,
    pageType: detectPageType(),
    quizHtml: null,
    timestamp: new Date().toISOString()
  };

  // Get the quiz HTML using detected selectors
  if (content.pageType === 'quiz') {
    const quizBlockSelector = getSelector('quizBlock');
    if (quizBlockSelector) {
      const quizBlock = document.querySelector(quizBlockSelector);
      if (quizBlock) {
        content.quizHtml = quizBlock.innerHTML;
        log(`📦 Captured quiz HTML (${content.quizHtml.length} characters)`);
      } else {
        log('⚠️ Quiz block not found with detected selector');
      }
    } else {
      log('⚠️ Quiz block selector not available');
    }
  }

  return content;
}

// Detect what type of page this is using detected selectors
function detectPageType() {
  // Check if selectors are initialized
  if (!sessionManager.isSelectorsInitialized()) {
    // Fallback detection
    if (document.title.includes('Practice Assessment') ||
        document.title.includes('Exam') ||
        document.title.includes('Quiz')) {
      return 'quiz';
    }
    return 'other';
  }
  
  // Use detected selectors
  const quizBlockSelector = getSelector('quizBlock');
  if (quizBlockSelector && document.querySelector(quizBlockSelector)) {
    return 'quiz';
  }
  
  return 'other';
}

// Calculate HTML similarity (0 to 1, where 1 is identical)
function calculateSimilarity(html1, html2) {
  if (!html1 || !html2) return 0;
  
  // Normalize HTML: remove whitespace, style attributes that might change
  const normalize = (html) => html
    .replace(/\s+/g, ' ')
    .replace(/style="[^"]*"/g, '')
    .replace(/data-[^=]*="[^"]*"/g, '')
    .trim();
  
  const norm1 = normalize(html1);
  const norm2 = normalize(html2);
  
  if (norm1 === norm2) return 1;
  
  // Calculate Levenshtein distance
  const len1 = norm1.length;
  const len2 = norm2.length;
  const maxLen = Math.max(len1, len2);
  
  // For large strings, use simple length comparison
  if (maxLen > 5000) {
    const lengthDiff = Math.abs(len1 - len2);
    return 1 - (lengthDiff / maxLen);
  }
  
  // Simple character-by-character comparison for performance
  let matches = 0;
  const minLen = Math.min(len1, len2);
  for (let i = 0; i < minLen; i++) {
    if (norm1[i] === norm2[i]) matches++;
  }
  
  return matches / maxLen;
}

// Start monitoring for HTML changes using detected selectors
function startChangeMonitoring() {
  if (changeCheckInterval) {
    clearInterval(changeCheckInterval);
  }
  
  log('🔍 Started monitoring for quiz changes...');
  
  changeCheckInterval = setInterval(() => {
    const quizBlockSelector = getSelector('quizBlock');
    if (!quizBlockSelector) return;
    
    const quizBlock = document.querySelector(quizBlockSelector);
    
    if (!quizBlock || isProcessing) return;
    
    const currentHtml = quizBlock.innerHTML;
    
    if (lastProcessedHtml) {
      const similarity = calculateSimilarity(lastProcessedHtml, currentHtml);
      const changePercent = ((1 - similarity) * 100).toFixed(1);
      
      // Only log significant changes
      if (similarity < 0.99) {
        log(`📊 HTML changed by ${changePercent}%`);
      }
      
      // If significant change detected, reprocess (threshold: 15%)
      if (similarity < 0.85) {
        log(`🔄 Significant change detected (${changePercent}%), reprocessing...`);
        lastProcessedHtml = currentHtml;
        handlePageLoad('CONTENT CHANGED');
      }
    }
  }, 1000); // Check every second
}

// Stop monitoring
function stopChangeMonitoring() {
  if (changeCheckInterval) {
    clearInterval(changeCheckInterval);
    changeCheckInterval = null;
    log('⏹️ Stopped monitoring for changes');
  }
}

// Handle page load and send to AI
async function handlePageLoad(loadType = 'PAGE LOADED') {
  if (isProcessing) return;
  
  // Ensure selectors are initialized before processing
  if (!sessionManager.isSelectorsInitialized()) {
    log('⚠️ Selectors not initialized yet, waiting...');
    // Wait for selector detection to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!sessionManager.isSelectorsInitialized()) {
      log('❌ Selectors still not initialized, skipping processing');
      return;
    }
  }
  
  isProcessing = true;

  try {
    log(`📄 ${loadType} - Extracting content from:`, window.location.href);
    
    // Wait for quiz content to be available
    await waitForQuizContent();
    
    const content = extractPageContent();
    log('Content extracted:', {
      pageType: content.pageType,
      hasQuizHtml: !!content.quizHtml,
      htmlLength: content.quizHtml?.length || 0
    });
    
    // Only process if we found quiz content
    if (content.pageType === 'quiz' && content.quizHtml) {
      // Store current HTML for comparison
      lastProcessedHtml = content.quizHtml;
      
      // Start monitoring if not already started
      if (!changeCheckInterval) {
        startChangeMonitoring();
      }
      
      log('📤 Sending quiz HTML to AI for processing...');
      // Send to background script for processing
      chrome.runtime.sendMessage({
        action: 'processContent',
        content: content,
        selectors: sessionManager.getSelectors()
      }, (response) => {
        if (response && response.success) {
          log('✅ Processing complete');
          log('📋 AI Response:', JSON.stringify(response.enhancements, null, 2));
          // highlightAnswers(response.enhancements);
        } else {
          log('❌ Processing failed:', response?.error);
        }
        isProcessing = false;
      });
    } else {
      log('ℹ️ Not a quiz page or no HTML found, skipping AI processing');
      stopChangeMonitoring();
      isProcessing = false;
    }
  } catch (error) {
    log('Error handling page load:', error);
    isProcessing = false;
  }
}

// Highlight answers on the page - STEALTH MODE
function highlightAnswers(enhancements) {
  if (!enhancements || enhancements.length === 0) {
    log('No answers to highlight');
    return;
  }

  log(`🎯 Highlighting ${enhancements.length} answer(s)`);

  enhancements.forEach((enhancement, idx) => {
    const { choiceId, answer, confidence } = enhancement;
    
    // Find the input element by ID
    let targetElement = null;
    
    if (choiceId) {
      const input = document.getElementById(choiceId);
      targetElement = input?.closest('label');
      
      if (targetElement) {
        // STEALTH: Only add subtle visual cue
        targetElement.style.boxShadow = '0 0 0 1px rgba(76, 175, 80, 0.15)';
        targetElement.setAttribute('data-answer', answer || '');
        targetElement.setAttribute('data-confidence', confidence || 0);
        
        // Store answer data for retrieval via DevTools if needed
        if (!window.__answers) window.__answers = [];
        window.__answers.push({
          element: targetElement,
          answer: answer,
          confidence: confidence,
          choiceId: choiceId,
          index: idx
        });
        
        log(`✅ Highlighted answer ${idx + 1}: ${answer?.substring(0, 50) || choiceId}... (confidence: ${confidence}%)`);
      } else {
        log(`⚠️ Could not find label for input ID: ${choiceId}`);
      }
    } else {
      log(`⚠️ No choiceId provided for answer ${idx + 1}`);
    }
  });
  
  if (window.__answers && window.__answers.length > 0) {
    log(`💾 Answers stored in window.__answers (${window.__answers.length} total)`);
  }
}

// Find element by text content
function findElementByText(searchText) {
  const elements = document.querySelectorAll('p, div, section, article');
  for (const element of elements) {
    if (element.innerText.includes(searchText.substring(0, 100))) {
      return element;
    }
  }
  return null;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'highlightContent') {
    highlightAnswers(message.enhancements);
    sendResponse({ success: true });
  }
  return true;
});

// Initialize
function init() {
  log('🚀 Extension initialized on:', window.location.href);
  log('📊 Session info:', sessionManager.getInfo());
  
  // Initialize session and detect selectors
  initializeSession().then(() => {
    if (isInitialLoad) {
      log('📥 Initial page load complete, processing...');
      isInitialLoad = false;
      handlePageLoad('INITIAL PAGE LOAD');
    }
  });
  
  // Set up mutation observer to detect navigation
  const observer = new MutationObserver(() => {
    detectPageChange();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also listen for URL changes (for SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      detectPageChange();
    }
  }).observe(document, { subtree: true, childList: true });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
