# Stage 1: Build static assets
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS builder

WORKDIR /app

# Install pinned pnpm version matching repository toolchain
RUN npm install -g pnpm@12.3.4

# Copy dependency configuration and committed lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies using frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source code and build configurations
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

# Compile production bundle into /app/dist
RUN pnpm build

# Stage 2: Minimal unprivileged Nginx runtime
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS runtime

# Copy custom Nginx configuration with reverse proxy for /api/*
COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder --chown=101:101 /app/dist /usr/share/nginx/html

# Run as unprivileged nginx user (UID 101)
USER 101

EXPOSE 8080

# Health check using lightweight wget from BusyBox in Alpine
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1:8080/"]

CMD ["nginx", "-g", "daemon off;"]
