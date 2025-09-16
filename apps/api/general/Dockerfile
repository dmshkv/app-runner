FROM node:20-slim as builder
WORKDIR /app-runner-workspace
COPY package*.json nx.json tsconfig*.json ./
COPY apps apps
ENV NX_DAEMON=false CI=1
ENV npm_config_fund=false npm_config_audit=false
RUN npm ci
RUN npx --yes nx build general --verbose

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app-runner-workspace/dist/apps/api/general ./
RUN npm i --omit=dev
EXPOSE 3000
CMD ["node", "main.js"]
