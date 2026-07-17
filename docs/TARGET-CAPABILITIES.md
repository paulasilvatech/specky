# Target Capabilities

Specky authors agents once in `.apm/agents` with canonical `capabilities:` frontmatter. During installation, the harness compiler converts those capabilities into the native tools accepted by the selected target. A generated agent never receives a tool simply because its workflow prose mentions an action.

## Capability Model

| Canonical capability | Purpose | Copilot | Claude / Cursor | OpenCode |
| --- | --- | --- | --- | --- |
| `workspace.read` | Read and search the workspace | `search` | `Read`, `Glob`, `Grep` | `read` |
| `workspace.edit` | Edit workspace files | `edit` | `Edit`, `Write`, `MultiEdit` | `edit` |
| `workspace.command.git` | Check or create branches with Git | `runCommands` | `Bash` | `bash` |
| `workspace.command.test` | Run the project test command | `runCommands` | `Bash` | `bash` |
| `workspace.command.release-gates` | Run Specky release gate scripts | `runCommands` | `Bash` | `bash` |
| `web.fetch` | Fetch public web content | `fetch` | `WebFetch`, `WebSearch` | `fetch` |
| `agent.delegate` | Delegate to another agent | `agent` | `Task` | `agent` |
| `mcp.specky.*` | Call a Specky MCP tool | `specky/<tool>` | `mcp__specky__<tool>` | `specky/<tool>` |
| `mcp.github.*` | Call an enabled GitHub MCP tool | `github/<tool>` | `mcp__github__<tool>` | `github/<tool>` |

`agent-skills` is intentionally not in the table: it installs the shared `.agents/skills` bundle only. It does not install agents, prompts, hooks, MCP registrations, or executable permissions.

## Multi-target workspaces

`--target=both` and `--target=all` install multiple harnesses into one workspace. When Copilot is included, Specky strips Claude lifecycle hooks from `.claude/settings.json` so VS Code Copilot cannot cross-read them and block tool calls. Prefer a **single** target (`claude` alone) if you need Claude lifecycle hooks.

## Permission Profiles

`specky install` accepts `--permission-profile=scoped|prompt`.

- `scoped` is the default. For Claude Code, Specky derives `permissions.allow` from the installed agent capabilities. It grants only the native read/edit/delegate tools, exact Specky MCP tools, declared GitHub MCP tools when the GitHub integration is enabled, and narrow command prefixes for Git, the detected package manager, and the two Specky release-gate scripts.
- `prompt` writes no Specky-managed Claude allow rules. The target runtime asks for approval for each action.

Neither profile grants arbitrary shell execution, destructive shell commands, unrestricted network egress, or stored credentials. Copilot, Cursor, and OpenCode own their own confirmation experience; Specky can declare a capability but cannot bypass their approval controls.

## GitHub MCP

GitHub operations are opt-in:

```bash
specky install --target=copilot --integration=github
```

The installer writes the GitHub MCP endpoint into the selected target configuration but never writes an access token. Authentication, repository access, and approval remain responsibilities of the target runtime and the signed-in GitHub identity.

Specky tools such as `sdd_create_pr`, `sdd_create_branch`, and `sdd_export_work_items` generate validated payloads. A real branch, pull request, or GitHub Issue is created only when the agent subsequently invokes the corresponding GitHub MCP tool. When GitHub MCP is unavailable or unauthenticated, the agent must return the payload and state that no external mutation occurred.

## Validation

Run the following after installation:

```bash
specky doctor --verbose
```

`doctor` verifies generated assets, target-local Specky MCP registration, capability-derived Claude permissions, and requested GitHub MCP registration. It reports GitHub MCP as registered rather than authenticated because the CLI cannot inspect the host's credential or approval state.

## Authorization Boundaries

Specky enforces its own state-machine and optional RBAC policy when a Specky MCP tool runs. Target runtimes enforce native tool confirmation, and GitHub MCP enforces GitHub authentication and repository authorization. These are complementary boundaries; none substitutes for another.

## References

- [VS Code Model Context Protocol servers](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- [Claude Code permissions](https://docs.anthropic.com/en/docs/claude-code/permissions)
- [GitHub MCP Server](https://docs.github.com/en/copilot/customizing-copilot/extending-copilot-chat-with-mcp)
