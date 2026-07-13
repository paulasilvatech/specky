# Specky 3.7.3 — APM governance layer

> Copy-paste body for the GitHub Release `v3.7.3`.

Specky now ships a first-class APM governance layer on top of the platform-native primitive compiler introduced in 3.7.2.

## Highlights

### APM package governance

The package now includes governance files alongside the canonical `.apm` primitive source:

- `apm.yml` declares the package name, version, primitive source paths, supported harness targets, and Specky MCP runtime.
- `apm.lock.yaml` pins SHA256 hashes for the packaged primitive and governance files.
- `apm-policy.yml` enforces MCP allowlists, allowed hook events, and per-harness tool-name isolation.

### New `specky apm` commands

Maintainers and CI can validate the package before publishing or installing:

```bash
specky apm validate      # validate apm.yml against package.json and primitive paths
specky apm lock          # write apm.lock.yaml with SHA256 per primitive
specky apm verify-lock   # diff current primitives against apm.lock.yaml
specky apm policy        # enforce apm-policy.yml governance rules
specky apm audit         # run the primitive frontmatter/tool audit
specky apm sbom          # emit a CycloneDX SBOM for packaged primitives
```

### Build and package checks

`npm run build` now checks `apm.yml` name/version parity with `package.json` before compiling. `npm pack --dry-run` includes the APM manifest, lockfile, policy file, and compiled `specky apm` command/modules.

## Validation

- `npm run build` passed.
- `specky apm validate` passed.
- `specky apm policy` passed.
- `specky apm verify-lock` passed.
- `specky apm sbom` emitted CycloneDX with 65 primitive/governance components.
- `npm test` passed: 38 test files, 355 tests.

## Upgrade

```bash
npm install -g specky-sdd@latest
cd your-project
specky upgrade
```

For project-local installs:

```bash
npm install --save-dev specky-sdd@latest
npx specky upgrade
```

Full details: [CHANGELOG.md](../../CHANGELOG.md)
