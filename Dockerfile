# syntax=docker/dockerfile:1

ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NodeJS"

WORKDIR /app

ENV NODE_ENV=production

# ------------------------
# Build stage
# ------------------------
FROM base AS build

# Install build dependencies
RUN apt-get update && \
    apt-get install -y python-is-python3 pkg-config build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy package files FIRST (important for caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Build frontend (Vite)
RUN npm run build

# ------------------------
# Runtime stage
# ------------------------
FROM base AS runtime

# Copy built app from build stage
COPY --from=build /app /app

# Fly expects the app to listen on 8080
EXPOSE 8080

# Start the app
CMD ["npm", "run", "start"]
