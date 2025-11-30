---
description: 'Creation of the project - NX and techdetails'
tools: []
---
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