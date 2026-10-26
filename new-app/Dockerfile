# Coolify: Base Directory = repo root, Dockerfile location = new-app/Dockerfile (ships new-app + root prisma).
FROM node:22-bookworm-slim AS deps
WORKDIR /app/new-app
RUN npm install -g pnpm@12.3.4
COPY new-app/package.json new-app/pnpm-lock.yaml new-app/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY prisma ./prisma
COPY new-app ./new-app
WORKDIR /app/new-app
RUN npm install -g pnpm@12.3.4
COPY --from=deps /app/new-app/node_modules ./node_modules
ENV COOLIFY_RESOURCE_UUID=1
RUN bash scripts/coolify-build.sh

FROM node:22-bookworm-slim AS runner
WORKDIR /app/new-app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/new-app/.next/standalone ./
COPY --from=builder /app/new-app/.next/static ./.next/static
COPY --from=builder /app/new-app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
