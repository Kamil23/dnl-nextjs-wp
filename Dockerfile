# syntax=docker/dockerfile:1

# ---- deps: install ALL deps (incl. dev — needed by `next build` and the tsx
#      one-off scripts: import-wp / process-imports / reindex-search).
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- source: deps + application source, WITHOUT a build. This is the image the
#      `tools` service runs (db:push / import:wp / search:reindex). No DB needed
#      to build it, so migrations/import can run before the app image is built.
FROM node:22-alpine AS source
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# ffmpeg + yt-dlp for the TikTok import worker (the `tools` service). The
# runtime image (runner) does not include these — it only copies the built server.
RUN apk add --no-cache ffmpeg yt-dlp
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ---- builder: compile the Next standalone server. `next build` pre-renders
#      pages via getStaticProps, so DATABASE_URL must be REACHABLE and populated
#      at build time — see docker-compose `web.build.network: host`.
FROM source AS builder
ARG WORDPRESS_API_URL
ARG APP_ORIGIN
ARG DATABASE_URL
ENV WORDPRESS_API_URL=$WORDPRESS_API_URL \
    APP_ORIGIN=$APP_ORIGIN \
    DATABASE_URL=$DATABASE_URL
RUN npm run build

# ---- runner: minimal runtime image, only the standalone server + static assets.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
