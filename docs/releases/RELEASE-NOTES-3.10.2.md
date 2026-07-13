# Specky 3.10.2 — MCP Logo (VS Code + Cursor)

> Copy-paste body for the GitHub Release `v3.10.2`.

Specky 3.10.2 makes the Specky logo appear correctly in VS Code MCP and Cursor Agent Plugins — stdio MCP servers must use `file://` icons, and Cursor needs a plugin manifest for the Installed plugins list.

## Highlights

### VS Code / GitHub Copilot

The MCP server handshake now advertises `site/specky-icon.png` as a local `file://` URI with `sizes`. VS Code ignores HTTPS icon URLs on stdio transports.

### Cursor Agent Plugins

`specky install --target=cursor` (and `specky upgrade`) now writes:

- `.cursor-plugin/plugin.json` — plugin manifest with `logo`
- `.cursor/assets/specky-icon.png` — copied from the npm package

### Repo plugin (Marketplace / Git)

Root `.cursor-plugin/plugin.json` and `mcp.json` support installing Specky as a Cursor plugin from the repository.

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
```

Restart VS Code or Cursor after upgrade so the MCP server reconnects with the new icon metadata.

Full details: [CHANGELOG.md](../../CHANGELOG.md)
