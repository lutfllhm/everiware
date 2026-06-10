# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package lock and configuration
COPY package*.json ./

# Install alpine build dependencies for building node-gyp packages (if any)
RUN apk add --no-cache python3 make g++

# Install only production dependencies
RUN npm ci --only=production

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /app

# Copy production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy app source code and helper scripts
COPY . .

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=5005

# Expose backend port
EXPOSE 5005

# Start command
CMD ["node", "src/server.js"]
