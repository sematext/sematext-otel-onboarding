FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Run as non-root user
USER node

CMD ["npm", "start"]
