# Onboarding — Getting Started with Specky

> **This document has moved.** For the complete getting-started guide, see **[GETTING-STARTED.md](GETTING-STARTED.md)**.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [README.md](README.md) | Project overview, quick start, all 52 tools |
| [GETTING-STARTED.md](GETTING-STARTED.md) | Complete educational guide — MCP, SDD, EARS, step-by-step walkthrough (assumes no prior knowledge) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, agent design, ADRs |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to add tools, templates, and services |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [SECURITY.md](SECURITY.md) | Security policy and OWASP coverage |

## Install in 30 Seconds

```bash
# npm (recommended)
npx specky-sdd

# Or Docker
docker run -p 3200:3200 -v $(pwd):/workspace ghcr.io/paulasilvatech/specky:latest
```

Then connect to your AI IDE — see [Quick Start](README.md#quick-start) for VS Code, Claude Code, Cursor, and Docker setup.
