# Publishing Specky — Step-by-Step Guide

> Complete guide to publish Specky on GitHub, npm, and Docker Hub. Follow each step in order.

---

## Prerequisites

Before publishing, ensure you have:

- [ ] [GitHub account](https://github.com) with a `specky` repository created
- [ ] [npm account](https://www.npmjs.com) (free)
- [ ] [Docker Desktop](https://www.docker.com/products/docker-desktop) installed (for Docker publishing)
- [ ] Node.js 18+ installed
- [ ] The project builds cleanly: `npm run build`

---

## Step 1: Create the GitHub Repository

### 1.1 Create the repo on GitHub

Go to [github.com/new](https://github.com/new) and create:

- **Name:** `specky`
- **Description:** The open-source MCP server for Spec-Driven Development (SDD)
- **Visibility:** Public
- **Do NOT** initialize with README (we already have one)

### 1.2 Initialize git and push

```bash
cd /path/to/specky

# Initialize git
git init
git branch -M main

# Add remote
git remote add origin https://github.com/paulasilvatech/specky.git

# Stage all files
git add .

# First commit
git commit -m "feat: Specky MCP Server v1.0.0

52 MCP tools for Spec-Driven Development with EARS notation.

Pipeline: init, discover, write_spec, clarify, write_design, write_tasks, run_analysis, advance_phase
Utility: get_status, get_template, write_bugfix, check_sync, scan_codebase, amend
Transcript: import_transcript, auto_pipeline, batch_transcripts

Features:
- 7-phase pipeline with state machine enforcement
- EARS notation validation with 6 pattern types
- Atomic file writes with path sanitization
- VTT/SRT/TXT/MD transcript parsing
- Copilot Studio + Power Automate integration
- GitHub Copilot agents + Claude Code commands
- Docker support for remote deployment

Created by Paula Silva @paulasilvatech"

# Push
git push -u origin main
```

### 1.3 Add repository topics

On GitHub, go to your repo → Settings → add topics:
`mcp`, `spec-driven-development`, `ears-notation`, `copilot`, `claude`, `ai-agent`, `typescript`, `specification`

---

## Step 2: Publish to npm

### 2.1 Login to npm

```bash
npm login
# Enter your npm username, password, and email
# Verify:
npm whoami
```

### 2.2 Check package name availability

```bash
npm view specky
# If it shows 404 → name is available
# If it shows package info → name is taken, choose another
```

### 2.3 Verify package.json

Your `package.json` should have these fields:

```json
{
  "name": "specky",
  "version": "1.0.0",
  "description": "The open-source MCP server for Spec-Driven Development (SDD)",
  "main": "dist/index.js",
  "bin": { "specky": "./dist/index.js" },
  "files": ["dist/", "templates/", "README.md", "LICENSE"],
  "repository": { "type": "git", "url": "https://github.com/paulasilvatech/specky" },
  "author": "Paula Silva <paulasilvatech@github.com>",
  "license": "MIT"
}
```

The `files` field controls what goes into the npm package. Only `dist/`, `templates/`, `README.md`, and `LICENSE` are needed.

### 2.4 Test the package locally

```bash
# Build first
npm run build

# Create a .tgz to inspect what will be published
npm pack

# Check the contents
tar tzf specky-1.0.0.tgz
# Should show:
#   package/dist/index.js
#   package/dist/...
#   package/templates/...
#   package/README.md
#   package/LICENSE
#   package/package.json

# Test installing locally
mkdir /tmp/test-specky && cd /tmp/test-specky
npm install /path/to/specky/specky-1.0.0.tgz
npx specky  # Should start the server

# Clean up
rm -rf /tmp/test-specky
```

### 2.5 Publish

```bash
# Publish to npm (public package with provenance)
npm publish --access public --provenance
```

**Done!** Anyone can now run:

```bash
npx specky
# or
npm install -g specky
```

### 2.6 Set up automated publishing (optional)

Add your npm token to GitHub Secrets:

1. Go to npmjs.com → Access Tokens → Generate New Token (Automation)
2. Copy the token
3. Go to GitHub repo → Settings → Secrets and variables → Actions
4. Add secret: `NPM_TOKEN` = your token

Now the `.github/workflows/publish.yml` will auto-publish when you create a release.

---

## Step 3: Publish Docker Image

### 3.1 Build locally

```bash
# Build the Docker image
docker build -t specky .

# Test it
docker run --rm -p 3200:3200 -v $(pwd):/workspace specky

# In another terminal, test the HTTP endpoint:
curl -X POST http://localhost:3200/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

### 3.2 Push to GitHub Container Registry (ghcr.io)

```bash
# Login to ghcr.io
echo $GITHUB_TOKEN | docker login ghcr.io -u paulasilvatech --password-stdin

# Tag the image
docker tag specky ghcr.io/paulasilvatech/specky:latest
docker tag specky ghcr.io/paulasilvatech/specky:1.0.0

# Push
docker push ghcr.io/paulasilvatech/specky:latest
docker push ghcr.io/paulasilvatech/specky:1.0.0
```

### 3.3 Make the package public

Go to GitHub → Packages → specky → Package settings → Change visibility → Public

**Done!** Anyone can now run:

```bash
docker pull ghcr.io/paulasilvatech/specky
docker run -p 3200:3200 -v $(pwd):/workspace ghcr.io/paulasilvatech/specky
```

---

## Step 4: Create a GitHub Release

### 4.1 Tag the version

```bash
git tag v1.0.0
git push origin v1.0.0
```

### 4.2 Create the release on GitHub

Go to GitHub → Releases → Create a new release:

- **Tag:** `v1.0.0`
- **Title:** `Specky v1.0.0 — The fun name, the serious engine.`
- **Description:**

```markdown
## What's New

First public release of Specky — the open-source MCP server for Spec-Driven Development.

### 17 MCP Tools

**Pipeline (8):** init, discover, write_spec, clarify, write_design, write_tasks, run_analysis, advance_phase
**Utility (6):** get_status, get_template, write_bugfix, check_sync, scan_codebase, amend
**Transcript (3):** import_transcript, auto_pipeline, batch_transcripts

### Key Features

- EARS notation validation with 6 pattern types
- 7-phase pipeline with state machine enforcement
- Meeting transcript → full specification (VTT, SRT, TXT, MD)
- Copilot Studio + Power Automate integration
- GitHub Copilot agents + Claude Code commands
- Docker support

### Quick Start

```bash
npx specky
```

See [GETTING-STARTED.md](GETTING-STARTED.md) for the full tutorial.
```

---

## Step 5: Verify Everything Works

### For npm users:

```bash
mkdir /tmp/verify-specky && cd /tmp/verify-specky
npx specky &
# Server should start on stdio

# Or test MCP:
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | npx specky 2>/dev/null
```

### For Docker users:

```bash
docker run --rm ghcr.io/paulasilvatech/specky --help 2>&1 | head -1
```

### For VS Code users:

1. Create `.vscode/mcp.json` with `npx specky` config
2. Open Copilot Chat
3. Type: "Initialize a new SDD project called test-project"
4. Copilot should call `sdd_init` and create files

---

## Version Bumping (for future releases)

```bash
# Patch release (bug fixes): 1.0.0 → 1.0.1
npm version patch

# Minor release (new features): 1.0.0 → 1.1.0
npm version minor

# Major release (breaking changes): 1.0.0 → 2.0.0
npm version major

# Then push and publish
git push --follow-tags
npm publish --provenance
```

---

**Created by [Paula Silva](https://github.com/paulasilvatech)** | Americas Software GBB | MIT License
