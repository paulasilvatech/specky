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

LABEL org.opencontainers.image.title="specky-sdd" \
      org.opencontainers.image.description="MCP server for Spec-Driven Development (SDD) with EARS notation" \
      org.opencontainers.image.version="3.1.0" \
      org.opencontainers.image.vendor="Paula Silva" \
      org.opencontainers.image.source="https://github.com/paulasilvatech/specky" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy only what's needed
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist/ ./dist/
COPY templates/ ./templates/
COPY references/ ./references/
COPY hooks/ ./hooks/

# Non-root user for security
RUN addgroup --system specky && adduser --system --ingroup specky specky
USER specky

EXPOSE 3200

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3200/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# HTTP mode for container deployment
ENTRYPOINT ["node", "dist/index.js", "--http"]
