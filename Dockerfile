# Specky MCP Server — Multi-stage Dockerfile
# Creator: Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB

# ── Build stage ──
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production stage ──
FROM node:22-slim AS production
WORKDIR /app

# Copy only what's needed
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist/ ./dist/
COPY templates/ ./templates/

# Non-root user for security
RUN addgroup --system specky && adduser --system --ingroup specky specky
USER specky

EXPOSE 3200

# HTTP mode for container deployment
ENTRYPOINT ["node", "dist/index.js", "--http"]
