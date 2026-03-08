FROM node:22-alpine AS builder
WORKDIR /build
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /build/dist ./dist
COPY items.json ./
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/main"]
