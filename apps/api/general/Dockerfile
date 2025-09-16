FROM node:20-slim as builder
WORKDIR /app-runner-workspace
COPY package*.json nx.json tsconfig*.json ./
COPY apps apps
RUN npm ci
RUN npx nx build general

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app-runner-workspace/dist/apps/api/general ./
RUN npm i --omit=dev
EXPOSE 3000
CMD ["node", "main.js"]
