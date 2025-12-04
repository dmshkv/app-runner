// HTML Sanitizer Utility
// Strips SVG, inline styles, and block styles from HTML while preserving structure

(function(window) {
  'use strict';

  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[HTMLSanitizer]', ...args);

  /**
   * Sanitize HTML by removing SVG, inline styles, and block styles
   * @param {string} html - The HTML content to sanitize
   * @returns {Object} - { sanitized: string, originalSize: number, sanitizedSize: number, reduction: string }
   */
  function sanitizeHTML(html) {
  const originalSize = new Blob([html]).size;
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove all SVG elements
  const svgElements = tempDiv.querySelectorAll('svg');
  svgElements.forEach(svg => svg.remove());
  
  // Remove all style tags (block styles)
  const styleTags = tempDiv.querySelectorAll('style');
  styleTags.forEach(style => style.remove());
  
  // Remove all script tags for safety
  const scriptTags = tempDiv.querySelectorAll('script');
  scriptTags.forEach(script => script.remove());
  
  // Remove inline style attributes from all elements
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(element => {
    element.removeAttribute('style');
    // Also remove common bloat attributes
    element.removeAttribute('data-v-');
    element.removeAttribute('data-reactid');
    element.removeAttribute('data-react-checksum');
  });
  
  // Get sanitized HTML
  const sanitized = tempDiv.innerHTML;
  const sanitizedSize = new Blob([sanitized]).size;
  const reductionPercent = ((1 - sanitizedSize / originalSize) * 100).toFixed(1);
  
  log(`📦 Original size: ${formatBytes(originalSize)}`);
  log(`📦 Sanitized size: ${formatBytes(sanitizedSize)}`);
  log(`📉 Reduction: ${reductionPercent}% (${formatBytes(originalSize - sanitizedSize)} removed)`);
  
  return {
    sanitized,
    originalSize,
    sanitizedSize,
    reduction: reductionPercent + '%',
    removedBytes: originalSize - sanitizedSize
  };
}

  /**
   * Get the sanitized body HTML from the entire document
   * @returns {Object} - { sanitized: string, originalSize: number, sanitizedSize: number, reduction: string }
   */
  function getSanitizedBodyHTML() {
  if (!document.body) {
    log('⚠️ Document body not available');
    return null;
  }
  
  const bodyHTML = document.body.innerHTML;
  return sanitizeHTML(bodyHTML);
}

  /**
   * Format bytes to human-readable format
   * @param {number} bytes - The number of bytes
   * @returns {string} - Formatted string (e.g., "1.5 KB")
   */
  function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

  /**
   * Extract minimal structural information for selector detection
   * Focuses on quiz-relevant elements only
   * @param {string} html - The HTML content
   * @returns {string} - Minimal HTML with quiz structure
   */
  function extractQuizStructure(html) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Keep only form-related and structural elements
  const relevantSelectors = [
    'form',
    'fieldset',
    'legend',
    'label',
    'input',
    'button',
    'select',
    'textarea',
    'div[role="radiogroup"]',
    'div[role="group"]',
    '[class*="quiz"]',
    '[class*="question"]',
    '[class*="answer"]',
    '[class*="choice"]',
    '[id*="quiz"]',
    '[id*="question"]',
    '[id*="answer"]'
  ];
  
  // Clone the structure but remove text content from non-essential elements
  const clone = tempDiv.cloneNode(true);
  
  // Remove all non-relevant elements first
  const allElements = Array.from(clone.querySelectorAll('*'));
  allElements.forEach(element => {
    const tagName = element.tagName.toLowerCase();
    const isRelevant = relevantSelectors.some(selector => {
      if (selector.startsWith('[')) {
        // Attribute selector
        const attrMatch = selector.match(/\[([^*=\]]+)(\*?=)?['"]?([^'"\]]+)?['"]?\]/);
        if (attrMatch) {
          const [, attr, operator, value] = attrMatch;
          const attrValue = element.getAttribute(attr);
          if (!operator) return attrValue !== null;
          if (operator === '*=' && value) return attrValue && attrValue.includes(value);
        }
        return false;
      }
      return element.matches(selector);
    });
    
    if (!isRelevant) {
      // Remove non-relevant elements but keep structure
      if (element.children.length === 0) {
        element.remove();
      }
    }
  });
  
    const structureHTML = clone.innerHTML;
    const originalSize = new Blob([html]).size;
    const structureSize = new Blob([structureHTML]).size;
    
    log(`🏗️ Structure extraction: ${formatBytes(originalSize)} → ${formatBytes(structureSize)}`);
    
    return structureHTML;
  }

  // Expose to global scope for content script
  window.sanitizeHTML = sanitizeHTML;
  window.getSanitizedBodyHTML = getSanitizedBodyHTML;
  window.extractQuizStructure = extractQuizStructure;

})(window);
