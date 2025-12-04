# Extension Architecture

## Directory Structure

```
answemeter/
├── manifest.json           # Extension configuration
├── icons/                  # Extension icons
└── src/
    ├── core/              # Core processing logic
    │   ├── background.js  # Service worker (AI API calls)
    │   └── content.js     # Content script (page interaction)
    ├── ui/                # User interface
    │   ├── popup.html     # Extension popup
    │   ├── popup.js       # Popup logic
    │   └── styles.css     # Popup styles
    ├── configs/           # Site-specific configurations
    │   ├── index.js       # Config loader
    │   ├── learn.microsoft.com.js
    │   └── datacamp.com.js
    └── docs/              # Documentation
        ├── ARCHITECTURE.md
        ├── QUICKSTART.md
        └── README.md
```

## Configuration System

The extension uses a site-specific configuration system that allows easy adaptation to different quiz platforms.

### Adding a New Site

1. Create a new config file in `src/configs/`:
   ```javascript
   // src/configs/example.com.js
   export const config = {
     hostPattern: /example\.com/,
     siteName: 'Example Site',
     selectors: { /* DOM selectors */ },
     detection: { /* Content detection */ },
     monitoring: { /* Change monitoring */ },
     prompt: { /* AI prompt template */ }
   };
   ```

2. Import it in `src/configs/index.js`:
   ```javascript
   import { config as exampleConfig } from './example.com.js';
   const configs = [..., exampleConfig];
   ```

3. Reload the extension

### Configuration Structure

Each site config contains:
- **hostPattern**: Regex to match the site hostname
- **siteName**: Display name
- **selectors**: CSS selectors for quiz elements
- **detection**: Patterns to identify quiz pages
- **monitoring**: Change detection settings  
- **prompt**: AI prompt templates
- **highlighting**: Visual feedback settings (optional)

## Data Flow

1. **Content Script** (`content.js`):
   - Loads site config
   - Monitors page for quiz forms
   - Extracts HTML content
   - Sends to background worker

2. **Background Worker** (`background.js`):
   - Receives content from content script
   - Loads site config and AI settings
   - Generates prompt using config template
   - Calls OpenAI API
   - Returns answers to content script

3. **Popup** (`popup.html/js`):
   - Allows user to configure API key
   - Select AI model
   - Test connection

## Key Features

- **Multi-site support**: Easy to add new quiz platforms
- **Intelligent caching**: Reuses answers for identical questions
- **Change detection**: Automatically processes new questions
- **Stealth mode**: Minimal visual changes to avoid detection
