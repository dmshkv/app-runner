// Test Script for Selector Detection
// Run this in the browser console to test the HTML sanitizer

console.log('🧪 Testing HTML Sanitizer...');

// Mock document body with quiz-like structure
const mockHTML = `
<div class="header" style="background: blue;">
  <h1>Quiz Page</h1>
</div>

<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="red"/>
</svg>

<style>
  .quiz-form { color: red; }
  body { font-size: 16px; }
</style>

<form class="quiz-form" data-quiz-id="123">
  <fieldset class="question-block">
    <legend class="question-text">What is 2 + 2?</legend>
    <div class="question-number">Question 1 of 10</div>
    
    <label class="answer-choice">
      <input type="radio" name="q1" id="q1-a1" value="3">
      <span>3</span>
    </label>
    
    <label class="answer-choice" style="padding: 10px;">
      <input type="radio" name="q1" id="q1-a2" value="4">
      <span>4</span>
    </label>
    
    <label class="answer-choice">
      <input type="radio" name="q1" id="q1-a3" value="5">
      <span>5</span>
    </label>
  </fieldset>
</form>

<script>
  console.log('This should be removed');
</script>
`;

// Create temp div
const tempDiv = document.createElement('div');
tempDiv.innerHTML = mockHTML;

// Measure original size
const originalSize = new Blob([mockHTML]).size;
console.log('📦 Original HTML size:', originalSize, 'bytes');

// Remove SVG
const svgs = tempDiv.querySelectorAll('svg');
console.log('🗑️ Removing', svgs.length, 'SVG element(s)');
svgs.forEach(svg => svg.remove());

// Remove style tags
const styles = tempDiv.querySelectorAll('style');
console.log('🗑️ Removing', styles.length, 'style tag(s)');
styles.forEach(style => style.remove());

// Remove script tags
const scripts = tempDiv.querySelectorAll('script');
console.log('🗑️ Removing', scripts.length, 'script tag(s)');
scripts.forEach(script => script.remove());

// Remove inline styles
const allElements = tempDiv.querySelectorAll('*');
let styleCount = 0;
allElements.forEach(el => {
  if (el.hasAttribute('style')) {
    el.removeAttribute('style');
    styleCount++;
  }
});
console.log('🗑️ Removed inline styles from', styleCount, 'element(s)');

// Get sanitized HTML
const sanitized = tempDiv.innerHTML;
const sanitizedSize = new Blob([sanitized]).size;
const reduction = ((1 - sanitizedSize / originalSize) * 100).toFixed(1);

console.log('📦 Sanitized HTML size:', sanitizedSize, 'bytes');
console.log('📉 Reduction:', reduction + '%');
console.log('\n✨ Sanitized HTML:\n', sanitized);

// Test selector detection (mock)
console.log('\n🔍 Detected selectors (mock):');
const mockSelectors = {
  quizBlock: 'form.quiz-form',
  quizQuestionNr: '.question-number',
  quizQuestion: '.question-text',
  quizAnswers: '.answer-choice'
};
console.log(JSON.stringify(mockSelectors, null, 2));

console.log('\n✅ Test complete!');
