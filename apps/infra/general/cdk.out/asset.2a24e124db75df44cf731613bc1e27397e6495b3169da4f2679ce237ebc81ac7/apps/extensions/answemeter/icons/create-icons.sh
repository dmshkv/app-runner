#!/bin/bash
# Create simple placeholder icons

# Create 16x16 icon
cat > icon16.svg << 'ICONEOF'
<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
  <rect width="16" height="16" fill="#667eea" rx="3"/>
  <text x="8" y="12" font-family="Arial" font-size="10" fill="white" text-anchor="middle">🤖</text>
</svg>
ICONEOF

# Create 48x48 icon
cat > icon48.svg << 'ICONEOF'
<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="48" height="48" fill="url(#grad1)" rx="8"/>
  <circle cx="18" cy="20" r="3" fill="white"/>
  <circle cx="30" cy="20" r="3" fill="white"/>
  <path d="M 16 30 Q 24 36 32 30" stroke="white" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>
ICONEOF

# Create 128x128 icon
cat > icon128.svg << 'ICONEOF'
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#grad2)" rx="20"/>
  <circle cx="48" cy="54" r="8" fill="white"/>
  <circle cx="80" cy="54" r="8" fill="white"/>
  <path d="M 44 80 Q 64 96 84 80" stroke="white" stroke-width="6" fill="none" stroke-linecap="round"/>
  <rect x="36" y="28" width="16" height="6" fill="white" rx="3"/>
  <rect x="76" y="28" width="16" height="6" fill="white" rx="3"/>
</svg>
ICONEOF

echo "SVG icons created. Converting to PNG..."

# Try to convert with available tools
if command -v magick &> /dev/null; then
    magick icon16.svg icon16.png
    magick icon48.svg icon48.png
    magick icon128.svg icon128.png
    echo "✓ PNG icons created with ImageMagick"
elif command -v convert &> /dev/null; then
    convert icon16.svg icon16.png
    convert icon48.svg icon48.png
    convert icon128.svg icon128.png
    echo "✓ PNG icons created with ImageMagick (convert)"
elif command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 16 -h 16 icon16.svg -o icon16.png
    rsvg-convert -w 48 -h 48 icon48.svg -o icon48.png
    rsvg-convert -w 128 -h 128 icon128.svg -o icon128.png
    echo "✓ PNG icons created with rsvg-convert"
else
    echo "⚠️  SVG icons created but PNG conversion skipped (no converter found)"
    echo "You can:"
    echo "1. Use SVG icons directly in manifest.json, or"
    echo "2. Install ImageMagick: brew install imagemagick"
    echo "3. Then run: bash create-icons.sh"
fi
