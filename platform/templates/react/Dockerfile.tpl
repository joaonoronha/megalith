FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@12.3.4

COPY package.json pnpm-workspace.yaml* ./
RUN pnpm install

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /app/dist /usr/share/nginx/html

USER 101

EXPOSE {{PORT}}

HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
    CMD ["wget", "-qO-", "http://127.0.0.1:{{PORT}}/"]

CMD ["nginx", "-g", "daemon off;"]
