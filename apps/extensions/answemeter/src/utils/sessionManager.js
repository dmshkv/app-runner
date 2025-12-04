// Session Manager
// Manages quiz session state, resets on page load, no persistence between sessions

(function(window) {
  'use strict';

  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[SessionManager]', ...args);

  class SessionManager {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.selectors = null;
    this.isInitialized = false;
    this.detectionInProgress = false;
    
    log(`🆕 New session created: ${this.sessionId}`);
  }
  
    /**
     * Generate a unique session ID
     * @returns {string}
     */
    generateSessionId() {
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Reset the session (called on page reload)
     */
    reset() {
      log(`♻️ Resetting session: ${this.sessionId}`);
      this.sessionId = this.generateSessionId();
      this.selectors = null;
      this.isInitialized = false;
      this.detectionInProgress = false;
      log(`🆕 New session created: ${this.sessionId}`);
    }
    
    /**
     * Set the detected selectors for this session
     * @param {Object} selectors - The selectors object
     */
    setSelectors(selectors) {
      log('✅ Selectors set for session:', selectors);
      this.selectors = selectors;
      this.isInitialized = true;
    }
    
    /**
     * Get the selectors for this session
     * @returns {Object|null}
     */
    getSelectors() {
      return this.selectors;
    }
    
    /**
     * Check if selectors are initialized
     * @returns {boolean}
     */
    isSelectorsInitialized() {
      return this.isInitialized && this.selectors !== null;
    }
    
    /**
     * Get a specific selector by key
     * @param {string} key - The selector key (e.g., 'quizBlock', 'quizQuestion')
     * @returns {string|null}
     */
    getSelector(key) {
      return this.selectors?.[key] || null;
    }
    
    /**
     * Mark detection as in progress
     */
    startDetection() {
      this.detectionInProgress = true;
      log('🔍 Selector detection started');
    }
    
    /**
     * Mark detection as complete
     */
    endDetection() {
      this.detectionInProgress = false;
      log('✅ Selector detection completed');
    }
    
    /**
     * Check if detection is in progress
     * @returns {boolean}
     */
    isDetecting() {
      return this.detectionInProgress;
    }
    
    /**
     * Get session info
     * @returns {Object}
     */
    getInfo() {
      return {
        sessionId: this.sessionId,
        isInitialized: this.isInitialized,
        hasSelectors: this.selectors !== null,
        detectionInProgress: this.detectionInProgress,
        selectors: this.selectors
      };
    }
  }

  // Create a singleton instance and expose to global scope
  window.sessionManager = new SessionManager();

  // Reset session on page unload (for SPA navigation)
  window.addEventListener('beforeunload', () => {
    log('📤 Page unloading, session will reset on next load');
  });

})(window);
