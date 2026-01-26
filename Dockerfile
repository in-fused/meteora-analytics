# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="NodeJS"

# NodeJS app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV=production


# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build node modules (including better-sqlite3)
RUN apt-get update -qq && \
    apt-get install -y python-is-python3 pkg-config build-essential

# Install node modules
COPY --link package.json .
RUN npm install --build-from-source

# Copy application code
COPY --link . .


# Final stage for app image
FROM base

# Install runtime dependencies for better-sqlite3
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends libsqlite3-0 && \
    rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=build /app /app

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Set database path to use volume mount
ENV DB_PATH=/app/data/meteora.db

# Expose port
EXPOSE 8080

# Start the server by default, this can be overwritten at runtime
CMD [ "npm", "run", "start" ]
