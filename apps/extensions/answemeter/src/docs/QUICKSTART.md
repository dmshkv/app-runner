# Quick Start Guide

## Install the Extension

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## Configure

1. Click the extension icon in your toolbar
2. Choose AI provider:
   - **Mock**: No setup needed (for testing)
   - **OpenAI**: Enter your API key
   - **Local AI**: Requires Ollama installed
3. Click "Save Configuration"

## Use

1. Visit any Microsoft Learn page: https://learn.microsoft.com/
2. AI enhancements appear automatically with 🤖 badges
3. Check stats in the extension popup

## Need Icons?

The extension needs icon files. Create simple PNG icons or use these placeholder commands:

```bash
cd chrome-extension/icons

# On macOS with ImageMagick:
convert -size 16x16 xc:#667eea icon16.png
convert -size 48x48 xc:#667eea icon48.png
convert -size 128x128 xc:#667eea icon128.png
```

Or download icons from any icon source and save as:
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

## Troubleshooting

- **Not working?** Check Console (F12) for errors
- **No enhancements?** Start with "Mock" mode first
- **API errors?** Verify your API key and quota

Enjoy enhanced Microsoft Learn documentation! 🚀
