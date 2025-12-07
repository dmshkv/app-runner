# Answemeter Chrome Extension

AI-powered quiz assistant for online learning platforms.

## 📁 Directory Structure

```
answemeter/
├── manifest.json          # Extension configuration
├── icons/                 # Extension icons
└── src/
    ├── core/             # Core processing
    ├── ui/               # User interface
    ├── configs/          # Site configurations
    └── docs/             # Documentation
```

## 🚀 Quick Start

1. Load extension in Chrome (`chrome://extensions/`)
2. Configure OpenAI API key in popup
3. Navigate to supported quiz site
4. Check console for AI-generated answers

## 📚 Documentation

- [README.md](src/docs/README.md) - Overview and features
- [QUICKSTART.md](src/docs/QUICKSTART.md) - Setup instructions
- [ARCHITECTURE.md](src/docs/ARCHITECTURE.md) - Technical details

## ✅ Supported Platforms

- Microsoft Learn (Practice Assessments, Certification Exams)
- More coming soon...

## ⚙️ Configuration

The extension uses site-specific configurations in `src/core/background.js`:
- DOM selectors for quiz elements
- Change detection settings
- AI prompt templates

## 📝 Version

Current: 0.0.15
