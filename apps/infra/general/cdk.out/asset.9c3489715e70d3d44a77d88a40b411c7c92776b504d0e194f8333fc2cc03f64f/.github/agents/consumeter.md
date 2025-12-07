---
description: 'custometer: the application stack serving the needs of worldwide price analysis on consumer market - including webcrawler, data extraction, data processing and storage, data analysis and BI, web interface'
tools: ['edit/createFile', 'edit/createDirectory', 'edit/editNotebook', 'edit/editFiles', 'new', 'fetch', 'todos']
<!-- handoffs:
  - label: Start Implementation
    agent: agent
    prompt: Start implementation
  - label: Open in Editor
    agent: agent
    prompt: ''
    send: true -->
---
description: 'custometer: the application stack serving the needs of worldwide price analysis on consumer market - including webcrawler, data extraction, data processing and storage, data analysis and BI, web interface'
tools: ['edit/createFile', 'edit/createDirectory', 'edit/editNotebook', 'edit/editFiles', 'new', 'fetch', 'todos']
prompts:
  - label: 'Architecture Review'
    prompt: 'Review current AWS architecture and NX monorepo structure. Verify all services are properly documented and aligned with actual implementation.'
  - label: 'Documentation Sync'
    prompt: 'Audit project documentation against actual codebase. Update README, API docs, and architecture diagrams to reflect current state.'
  - label: 'AI Integration Check'
    prompt: 'Verify LLM integration for data format recognition. Ensure AI models are properly versioned and deployment pipelines are documented.'
  - label: 'Infrastructure Audit'
    prompt: 'Review Terraform configurations and AWS resources. Confirm they match documented architecture and are properly tagged.'
  - label: 'Deploy to AWS'
    prompt: 'Execute deployment pipeline to AWS. Verify all services, verify GitHub Actions workflows, and validate deployment documentation.'
  - label: 'GitHub Workflow Review'
    prompt: 'Audit CI/CD pipelines in GitHub Actions. Ensure workflows match documented processes and deployment requirements.'
  - label: 'Project Health Check'
    prompt: 'Comprehensive review: verify NX workspace structure, check all app dependencies, validate environment configurations, and ensure documentation accuracy, validate the build and deployment processes.'
---
We develop smart webcrawler and data extraction tool tailored to the commercial data extraction from the websites. COre of the application is the event-based processing engine that starts from data exraction, to the data format regognion using LLMs and finally to the data validation and storage. The data is later used for the business intelligence and competitive analysis.

We are supporting the NX monorepo structure for this project. The project is created using the NX and has following inner app types:
- BE application - NestJS (server)
- BE application - Fastify (serverless)
- FE application - NextJS (web)
- DB application - Prisma (database client)
- Infrastructure as the code - Terraform (cloud infrastructure)
- Worker application Crawler - NestJS (worker)

AWS is used as cloud service provider.
Project has aws cli and user attached for the deployment.

```bash