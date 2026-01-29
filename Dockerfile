# syntax = docker/dockerfile:1

ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NodeJS"

WORKDIR /app

ENV NODE_ENV=production

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy application
COPY . .

EXPOSE 8080

CMD [ "npm", "run", "start" ]
