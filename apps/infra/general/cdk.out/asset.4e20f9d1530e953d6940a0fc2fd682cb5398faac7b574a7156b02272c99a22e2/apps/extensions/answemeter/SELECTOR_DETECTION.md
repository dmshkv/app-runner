# Quiz Detector - Selector Detection Implementation

## Overview

The quiz detector now uses LLM-based selector detection on page load instead of hardcoded selectors. Each page reload creates a new session with no persistence between sessions.

## Key Changes

### 1. Session-Based Architecture

- **New Session on Every Page Load**: Each time a page loads or reloads, a new session is created
- **No Persistence**: Session data (including detected selectors) is not persisted between page loads
- **Session Manager**: Centralized session management through `sessionManager.js`

### 2. Automatic Selector Detection

On page load, the extension:

1. **Waits for Full Page Load**: Ensures all client-side rendering is complete
2. **Sanitizes HTML**: Strips SVG, inline styles, and block styles from the entire `<body>` tag
3. **Logs Payload Size**: Tracks original size, sanitized size, and reduction percentage
4. **Sends to LLM**: Submits sanitized HTML to LLM for selector detection
5. **Stores Selectors**: Saves detected selectors in session for the page's lifetime

### 3. LLM Selector Detection

The LLM analyzes the page HTML and returns stable CSS selectors for:

- `quizBlock`: Main quiz container
- `quizQuestionNr`: Question number element (optional)
- `quizQuestion`: Question text element
- `quizAnswers`: Array selector for all answer choices

### 4. HTML Sanitization

The `htmlSanitizer.js` utility:

- Removes all `<svg>` elements
- Removes all `<style>` tags (block styles)
- Removes all `<script>` tags
- Strips `style` attributes (inline styles)
- Removes data- attributes that add bloat
- Logs size metrics: original, sanitized, and reduction percentage

Example output:
```
📦 Original size: 245.8 KB
📦 Sanitized size: 87.3 KB
📉 Reduction: 64.5% (158.5 KB removed)
```

## File Structure

```
apps/extensions/answemeter/src/
├── core/
│   ├── content.js          # Updated with session initialization
│   └── background.js       # Updated with selector detection handler
└── utils/
    ├── htmlSanitizer.js    # NEW: HTML sanitization utilities
    └── sessionManager.js   # NEW: Session management
```

## Workflow

### Page Load Sequence

1. **Content Script Loads**
   ```javascript
   initializeSession()
   ```

2. **Session Initialization**
   - Reset session state
   - Wait for page fully loaded
   - Check if selectors already detected

3. **Selector Detection** (if not detected)
   - Get sanitized body HTML
   - Log payload size
   - Send to background script

4. **Background Processing**
   - Receive sanitized HTML
   - Call LLM API with detection prompt
   - Parse and return selectors

5. **Session Ready**
   - Store selectors in session
   - Begin monitoring quiz content
   - Process quiz when found

### Content Processing

Once selectors are detected, the extension:

1. Uses `quizBlock` selector to find quiz container
2. Monitors for changes using similarity algorithm
3. Extracts quiz HTML when changes detected
4. Sends to LLM for answer identification
5. Highlights correct answers (in development)

## API Integration

### Selector Detection Prompt

```
You are analyzing a web page HTML to identify stable CSS selectors...

TASK: Identify stable, unique CSS selectors for:
1. quizBlock - Main quiz container
2. quizQuestionNr - Question number (optional)
3. quizQuestion - Question text
4. quizAnswers - All answer choices (array selector)

RESPONSE FORMAT:
{
  "selectors": {
    "quizBlock": "form.quiz-form",
    "quizQuestionNr": ".question-number",
    "quizQuestion": ".question-text",
    "quizAnswers": ".answer-choice"
  }
}
```

### Fallback Selectors

If API is not configured, fallback selectors are used:

```javascript
{
  quizBlock: 'form, .quiz-container, .assessment-container, [role="form"]',
  quizQuestionNr: '.question-number, .question-count, [class*="question-num"]',
  quizQuestion: '.question-text, .question, legend, [class*="question"]',
  quizAnswers: 'label, .answer, .choice, [class*="answer"], [class*="choice"]'
}
```

## Benefits

1. **No Hardcoded Selectors**: Works with any quiz platform automatically
2. **Adaptive**: Learns selectors from actual page structure
3. **Reduced Payload**: Sanitization significantly reduces data sent to LLM
4. **Session-Based**: Clean state on every page load
5. **Transparent**: Logs payload sizes and detection results

## Logging

The implementation provides detailed console logging:

```
[Extension] 🚀 Content script loaded and running!
[Extension] 🎬 Initializing new session...
[SessionManager] 🆕 New session created: session_1234567890_abc123
[Extension] 📦 Preparing to send page body to LLM for selector detection...
[HTMLSanitizer] 📦 Original size: 245.8 KB
[HTMLSanitizer] 📦 Sanitized size: 87.3 KB
[HTMLSanitizer] 📉 Reduction: 64.5% (158.5 KB removed)
[Background] 🔍 Selector detection requested
[Background] 📊 Payload size: 87.3 KB
[Background] ✅ Selectors detected and stored: {...}
[SessionManager] ✅ Selectors set for session: {...}
[Extension] ✅ Selectors detected: {...}
```

## Future Enhancements

1. Add caching for selectors across similar pages (same domain/pattern)
2. Implement selector validation and auto-correction
3. Add metrics tracking for selector accuracy
4. Support for dynamic selector updates mid-session
5. Batch processing for multiple quizzes on same page
