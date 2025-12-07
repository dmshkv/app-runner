# Process API Documentation

Complete documentation for the Process API - a batch web crawling service with progress tracking.

## 🌟 Start Here

### New Users
1. **[API Reference](./API_REFERENCE.md)** - Complete API guide with examples
2. **[Process-Based Architecture](./PROCESS_BASED_ARCHITECTURE.md)** - How the system works
3. **[Setup Guide](./SETUP.md)** - Get up and running

### Existing Users  
- **[API Reference](./API_REFERENCE.md)** - Updated endpoints
- **[Process-Based Architecture](./PROCESS_BASED_ARCHITECTURE.md)** - Migration from old API

## 📚 All Documentation

| Document | Description |
|----------|-------------|
| **[API Reference](./API_REFERENCE.md)** | Complete API documentation, endpoints, examples |
| **[Process-Based Architecture](./PROCESS_BASED_ARCHITECTURE.md)** | New workflow, migration guide, benefits |
| **[Setup Guide](./SETUP.md)** | Environment setup, database, AWS config |
| **[Architecture Overview](./ARCHITECTURE.md)** | Feature-based structure, design principles |
| **[Architecture Diagrams](./ARCHITECTURE_DIAGRAMS.md)** | Visual flows, database schema |
| **[Quick Reference](./QUICK_REFERENCE.md)** | API cheat sheet, common commands |
| **[Migration Guide](./MIGRATION_GUIDE.md)** | Step-by-step migration instructions |
| **[CDK Integration](./CDK_INTEGRATION.md)** | AWS deployment with CDK |

## 🚀 Quick Example

```bash
# 1. Initiate batch crawl
curl -X POST http://localhost:3000/api/process/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      {"url": "https://example.com", "selectors": {"title": "h1"}},
      {"url": "https://example.org"}
    ]
  }'

# Response: { "processId": "uuid", "totalUrls": 2 }

# 2. Poll for progress
curl http://localhost:3000/api/process/{processId} | jq '.progress'

# Response: { "completed": 2, "total": 2, "percentage": 100 }
```

## 💡 Key Features

- **Batch Processing**: Submit multiple URLs in one request
- **Real-time Progress**: Track completion status (X/Y URLs done)
- **Immediate Execution**: No waiting for cron jobs
- **Detailed Results**: Get extracted data with selectors
- **Error Tracking**: Individual URL failure tracking

## 📋 Common Tasks

### Monitor Progress
```bash
watch -n 5 "curl -s http://localhost:3000/api/process/{id} | jq '.progress'"
```

### Get Completed Results
```bash
curl http://localhost:3000/api/process/{id} | \
  jq '.results[] | select(.status == "completed") | {url, data}'
```

### List Recent Processes
```bash
curl http://localhost:3000/api/process | jq '.[0:10]'
```

### Get Statistics
```bash
curl http://localhost:3000/api/process/stats/summary
```

## 🔑 Core Concepts

**Process**: Batch crawl job tracking multiple URLs
- Status: `initiated` → `in_progress` → `completed`
- Progress: Real-time completion tracking
- Metadata: Custom tracking information

**URL**: Individual crawl within a process
- Linked to parent process
- Has selectors for data extraction
- Status tracked independently

**CrawlResult**: Extracted data
- Linked to both URL and Process
- Contains structured data based on selectors
- Includes optional screenshots

## 📍 Documentation Map

```
docs/
├── API_REFERENCE.md                    ⭐ Complete API guide
├── PROCESS_BASED_ARCHITECTURE.md       ⭐ New workflow explained
├── SETUP.md                             Environment configuration
├── ARCHITECTURE.md                      Feature-based structure
├── ARCHITECTURE_DIAGRAMS.md            Visual diagrams
├── QUICK_REFERENCE.md                   API cheat sheet
├── MIGRATION_GUIDE.md                   Migration steps
└── CDK_INTEGRATION.md                   AWS deployment
```

## 🎯 Next Steps

1. Read **[API Reference](./API_REFERENCE.md)** for complete API docs
2. Follow **[Setup Guide](./SETUP.md)** to configure environment
3. Review **[Process-Based Architecture](./PROCESS_BASED_ARCHITECTURE.md)** for workflow
4. Run `./test-api.sh` to test endpoints
