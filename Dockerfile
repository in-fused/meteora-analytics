# syntax=docker/dockerfile:1

ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-slim AS base

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

# Copy dependency files first
COPY package.json package-lock.json ./

# Install ALL deps (including devDeps for build)
RUN npm ci

# Copy source
COPY . .

# Build Vite app
RUN npm run build

# ------------------------
# Runtime stage
# ------------------------
FROM nginx:alpine AS runtime

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Expose Fly port
EXPOSE 8080

# Replace nginx default config
RUN printf "server {\n\
  listen 8080;\n\
  location / {\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    try_files \$uri /index.html;\n\
  }\n\
}\n" > /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]
