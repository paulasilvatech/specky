# Specky 3.11.0 - Target-Correct Agent Capabilities

> Copy-paste body for the GitHub Release `v3.11.0`.

Specky 3.11.0 makes agent permissions explicit, portable, and testable across GitHub Copilot, Claude Code, Cursor, and OpenCode.

## Highlights

### Canonical Capabilities

Agents now declare canonical `capabilities:` in the APM source. Installation compiles them to the target-native tool vocabulary, so workflows receive the tools they actually require rather than relying on prose or cross-target tokens.

The verifier can run the detected test command, and release workflows have explicit Git, release-gate, and GitHub MCP capabilities. The implementer remains scaffold-only and does not receive production-code edit access.

### Scoped or Prompted Permissions

Use the default scoped mode for narrow Claude Code allow rules:

```bash
specky install --target=claude --permission-profile=scoped
```

Or retain host confirmation for every action:

```bash
specky install --target=claude --permission-profile=prompt
```

Scoped mode never grants arbitrary shell execution, destructive shell commands, broad network access, or stored credentials.

### Optional GitHub MCP

GitHub operations are now explicit and opt-in:

```bash
specky install --target=copilot --integration=github
```

Specky generates branch, pull request, and issue payloads. The host creates external resources only after the authenticated GitHub MCP tool is invoked. `specky doctor` verifies registration but intentionally does not claim that it can verify host authentication or user approval.

### Release Integrity

Release metadata is synchronized across `package.json`, APM, `config.yml`, and the plugin MCP runtime pin. The preflight and installation CI smoke tests now cover Copilot, Claude, Cursor, OpenCode, and the skills-only `agent-skills` bundle. The publish workflow requires the GitHub Release tag to match the package version and emits OCI version/source/revision labels for GHCR images.

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
```

To enable GitHub MCP in an existing workspace, run a target-specific reinstall:

```bash
specky install --force --target=copilot --integration=github
specky doctor --verbose
```

Read [Target Capabilities](../TARGET-CAPABILITIES.md) for the target matrix, security boundaries, and runtime approval model.

## References

- [VS Code Model Context Protocol servers](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- [Claude Code permissions](https://docs.anthropic.com/en/docs/claude-code/permissions)
- [GitHub MCP Server](https://docs.github.com/en/copilot/customizing-copilot/extending-copilot-chat-with-mcp)
