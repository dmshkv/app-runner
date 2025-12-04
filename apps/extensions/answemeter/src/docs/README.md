# Answemeter - Multi-Site Quiz Answer Extension

AI-powered quiz assistant that works across multiple learning platforms.

## Features

- 🎯 **Multi-site support** - Works with Microsoft Learn, DataCamp, and more
- 🤖 **OpenAI Integration** - Uses GPT-4o for accurate answer detection  
- 🔄 **Auto-detection** - Monitors page changes and processes new questions
- 💾 **Smart caching** - Reuses answers for identical questions
- 🥷 **Stealth mode** - Minimal visual footprint

## Quick Start

1. **Load Extension**: Chrome → `chrome://extensions/` → Load unpacked
2. **Configure**: Click icon → Enter OpenAI API key → Save
3. **Use**: Navigate to quiz page → Check console for answers

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical documentation.

## Supported Sites

- ✅ Microsoft Learn (Practice Assessments, Certification Exams)
- 🔜 DataCamp (Coming soon)

## Adding New Sites

Edit `SITE_CONFIGS` in `src/core/background.js` to add new quiz platforms.

## License

MIT - Educational purposes only
