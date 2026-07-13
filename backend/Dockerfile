FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3002
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts/import-cctv-infrastructure.js ./scripts/import-cctv-infrastructure.js
COPY --from=builder /app/data/cctv-legacy-import.json ./data/cctv-legacy-import.json
USER nestjs
EXPOSE 3002
CMD ["npm","run","start"]
