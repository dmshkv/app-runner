FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY dist/apps/api/process/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy built application
COPY dist/apps/api/process .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "main.js"]
