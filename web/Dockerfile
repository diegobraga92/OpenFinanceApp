# Build stage
# NOTE: the build context is the repo root (see docker-compose.yml) because
# web/src imports the shared i18n dictionary via ../../shared/i18n. The image
# mirrors the repo layout (web/ + shared/ at /app) so those relative imports
# keep resolving: /app/web/src  →  ../../shared/i18n  →  /app/shared/i18n.
FROM node:20-alpine AS builder

WORKDIR /app

# 1) Manifests first, so the `npm ci` layer stays cached across source edits.
COPY web/package.json web/package-lock.json* /app/web/
COPY shared/ /app/shared/
WORKDIR /app/web
RUN npm ci

# 2) Rest of the web app.
COPY web/ /app/web/

# VITE_API_BASE_URL is baked into the bundle at build time.
# Leave unset/empty to use same-origin URLs (nginx proxies to the backend).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# Runtime stage
FROM nginx:stable-alpine

COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]