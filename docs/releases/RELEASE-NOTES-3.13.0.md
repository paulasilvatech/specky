# Specky 3.13.0 - Safe Workspace Config Upgrades

Specky 3.13.0 separates workspace config compatibility from npm package versions and adds guarded migration paths for supported Specky 3.x workspaces.

## Added

- Independent integer `schema_version` for `.specky/config.yml`.
- Automatic migration for:
  - workspaces that do not yet contain a runtime config;
  - strict allowlisted, unversioned Specky 3.x configs;
  - generated package catalogs from `v3.4.0` through `v3.11.0`;
  - complete package-versioned runtime configs from `v3.11.1` through `v3.12.0`.
- Original config backups at `.specky/config.yml.before-schema-*.bak` after successful migration.
- Explicit conflict artifacts when another process edits or recreates the config during migration.

## Safety

- Runtime config loading remains read-only. Only `specky install` and `specky upgrade` may migrate recognized legacy formats.
- Target and config validation occur before installation, and the migrated config is committed only after the asset refresh succeeds.
- Future schemas, unknown package versions, malformed documents, unknown keys, and ambiguous legacy files remain unchanged and fail with actionable compatibility messages.
- Migration uses a source-content hash, filesystem capability preflight, no-clobber replacement, metadata preservation, rollback, and conflict quarantine.
- Dry-run reports the planned migration and obsolete fields without writing files.

## Upgrade

Updating the package and refreshing a workspace remain separate operations:

```bash
# Global installation
npm install -g specky-sdd@latest
cd your-project
specky upgrade
specky doctor

# Project-local installation
npm install --save-dev specky-sdd@latest
npx specky upgrade
npx specky doctor
```

The npm command installs Specky code and dependency fixes. `specky upgrade` migrates the workspace config, refreshes generated assets, and re-pins MCP registration to the installed package version.

## Security And Delivery

- CI and publishing retain the fail-closed exact advisory policy for the complete lockfile.
- Runtime high/critical advisories are checked separately from explicitly accepted build-only advisories.
- Coverage runs sequentially by test file to prevent subprocess-heavy integration tests from timing out under parallel CPU contention.

## References

- [Installation and upgrade guide](https://github.com/paulasilvatech/specky/blob/main/docs/INSTALL.md)
- [CLI reference](https://github.com/paulasilvatech/specky/blob/main/docs/CLI.md)
- [Security policy](https://github.com/paulasilvatech/specky/blob/main/SECURITY.md)
- [npm audit documentation](https://docs.npmjs.com/cli/commands/npm-audit)
