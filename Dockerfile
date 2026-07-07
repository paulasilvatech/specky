# Specky MCP server container.
# Compiles the TypeScript sources, then runs the HTTP streaming transport.
# This is the image published to GHCR by .github/workflows/publish.yml.

# ---- Build stage: compile TypeScript and generate hook manifests ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install all dependencies (dev included) for the build.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Sources consumed by `npm run build`: manifest sync, tsc, then the hook/finalize scripts.
# check-manifest-sync.mjs reads apm.yml; build-claude-hooks.mjs reads .apm/hooks/sdd-hooks.json.
COPY tsconfig.json ./
COPY apm.yml config.yml apm.lock.yaml apm-policy.yml ./
COPY src ./src
COPY templates ./templates
COPY scripts ./scripts
COPY .apm ./.apm
RUN npm run build

# ---- Runtime stage: production dependencies + built artifacts only ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies only (the 3 runtime deps).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

# Ship the compiled server plus the assets it reads at runtime.
# TemplateEngine resolves templates from dist/templates (produced by the build);
# .apm and the governance manifests are copied to match the published npm package.
COPY --from=build /app/dist ./dist
COPY .apm ./.apm
COPY apm.yml config.yml apm.lock.yaml apm-policy.yml ./

# Run unprivileged; /workspace is the project root mounted at runtime
# (README: `docker run -p 3200:3200 -v $(pwd):/workspace ...`).
RUN mkdir -p /workspace && chown -R node:node /workspace
USER node
WORKDIR /workspace

# HTTP streaming transport listens on 3200 by default (DEFAULT_HTTP_PORT).
EXPOSE 3200

# The container is the isolation boundary, so bind all interfaces by default —
# otherwise `docker run -p 3200:3200` cannot reach the server (the CLI/npm
# default stays loopback). Real exposure is governed by the port mapping /
# orchestrator; set SDD_HTTP_TOKEN (and a TLS-terminating proxy) for
# authenticated deployments — the server warns when bound non-loopback without it.
ENV SDD_HTTP_HOST=0.0.0.0

# Liveness probe against the transport's /health endpoint (Node 22 global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3200/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Start the MCP server over HTTP. Override the port with `-e PORT=<n>`.
CMD ["node", "/app/dist/cli/index.js", "serve", "--http"]
