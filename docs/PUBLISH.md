# Publishing Specky to npm

> Audience: maintainer (Paula Silva).
> This doc is intentionally short and prescriptive. Follow it step by step.

There are two ways to publish. **Prefer the CI route** — it publishes with npm
provenance and runs the full test matrix; the manual route is a fallback.

---

## Prerequisites (one-time)

1. **npm account** with publish rights to `specky-sdd` (`npm whoami` prints your username)
2. **`NPM_TOKEN` repo secret** (an npm *automation* token) — used by CI so the
   GitHub Release can publish without a browser/2FA prompt
3. **gh CLI authenticated** (`gh auth status`) — to create the Release / check CI
4. **Clean working tree**, changes merged to `main`

---

## Release procedure

### Step 0 — Decide release type

| Release type | package.json version | npm dist-tag |
| --- | --- | --- |
| Prerelease (rc/beta) | `X.Y.Z-rc.N` (e.g. `3.6.0-rc.1`) | `next` |
| Stable | `X.Y.Z` (e.g. `3.6.0`) | `latest` |

Optional soak: publish as `@next` first, let a pilot run for ~48h, then promote
to `@latest` (Step 5). Stable releases can go straight to `@latest`.

### Step 1 — Bump version + changelog on `main`

```bash
# on a branch off develop:
#   - package.json / package-lock.json version -> X.Y.Z
#   - apm.yml / config.yml version -> X.Y.Z
#   - CHANGELOG.md: add the [X.Y.Z] section
#   - regenerate docs/API_REFERENCE.md if tools changed
node scripts/generate-api-reference.mjs
# open a PR, get CI green, merge to main
```

`src/constants.ts` reads `VERSION` from `package.json`, so bumping
`package.json` is what drives the CLI/server version.

### Step 2 — Local pre-flight (optional but recommended)

```bash
node scripts/release.mjs
```

Runs: clean tree check, clean build, all tests, `npm pack --dry-run`, a fresh
install from the packed tarball + `specky init` + `specky doctor`, and a
version/dist-tag sanity check. Must exit `0`.

### Step 3 — Publish (CANONICAL: GitHub Release triggers CI)

Creating a **published** GitHub Release is the trigger. `.github/workflows/publish.yml`
runs on `release: published`, builds, audits, tests, and then runs an
**idempotent** `npm publish --provenance --access public` (it skips if that
version is already on npm).

```bash
VERSION=$(node -p "require('./package.json').version")
gh release create "v$VERSION" \
  --target main \
  --title "v$VERSION" \
  --notes-file docs/releases/RELEASE-NOTES-$VERSION.md   # or CHANGELOG.md
```

Or via the UI: **Releases → Draft a new release** → tag `vX.Y.Z` (create on
publish) → target `main` → paste the release notes → **Publish** (must be
*Publish*, not *Draft* — a draft does not fire the workflow).

> The Release also creates the `vX.Y.Z` git tag, so there is no separate
> `git tag` step. CI provenance requires this route (a laptop cannot mint
> provenance).

### Step 3b — Manual publish (fallback only)

Use only if CI is unavailable. This publishes **without** provenance.

```bash
git checkout main && git pull origin main
node -p "require('./package.json').version"     # confirm it is X.Y.Z
npm login --auth-type=web                        # browser + passkey/Touch ID
npm ci && npm run build
npm publish --tag latest --access public         # or --tag next for a prerelease
```

If you publish manually, still create the GitHub Release (Step 3) for the tag +
notes — the workflow will detect the version is already on npm and skip the
publish (idempotent), so there is no double-publish.

### Step 4 — Post-publish verification

```bash
# ~60s for npm CDN propagation, then (bypass local cache):
npm view specky-sdd version --prefer-online       # -> X.Y.Z
npm view specky-sdd dist-tags --json
```

Deeper check:

```bash
mkdir /tmp/verify && cd /tmp/verify && npm init -y
npm install specky-sdd@X.Y.Z --silent
npx specky --version && npx specky init --dry-run
```

If the install is broken you have ~72h to `npm unpublish specky-sdd@X.Y.Z`;
after 72h npm blocks unpublish and the only fix is a new patch version.

### Step 5 — Promote a prerelease to stable (if you soaked on `@next`)

```bash
npm dist-tag add specky-sdd@X.Y.Z-rc.N latest
```

(Users already on `@next` upgrade on their next `npm install`.)

### Step 6 — Container image (optional, GHCR)

The container is opt-in. The `docker-publish` job in `publish.yml` runs only
when the repo variable `PUBLISH_DOCKER=true` and pushes a **multi-arch**
(`linux/amd64` + `linux/arm64`) image
`ghcr.io/paulasilvatech/specky:{latest,X.Y.Z}`. Every image build produces a
CycloneDX SBOM workflow artifact; Cosign signatures are added only when the
signing secrets are configured.
See [ENTERPRISE-DEPLOYMENT.md](ENTERPRISE-DEPLOYMENT.md) for the
container deployment model.

**CI setup (recommended):**

- Repository → **Settings → Secrets and variables → Actions → Variables**:
  set `PUBLISH_DOCKER=true`.
- The job authenticates with the built-in `GITHUB_TOKEN` (needs
  `packages: write`, already set in the workflow). No extra secret is required
  when the package belongs to the same org/repo.
- If GHCR rejects `GITHUB_TOKEN` with `permission_denied: write_package`, add a
  classic PAT with `write:packages` as the `GHCR_TOKEN` repo secret and,
  optionally, set `GHCR_USER` to the PAT owner.

**Manual fallback (publish from a workstation):**

Use this if you need to publish out-of-band — it matches the workflow output
(multi-arch, both tags):

```bash
VERSION=$(node -p "require('./package.json').version")

# 1. Log in with a classic PAT that has write:packages
echo "$GHCR_TOKEN" | docker login ghcr.io -u <github-user> --password-stdin

# 2. One-time multi-arch builder
docker buildx create --use --name specky 2>/dev/null || docker buildx use specky

# 3. Build + push both tags for amd64 and arm64
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/paulasilvatech/specky:$VERSION \
  -t ghcr.io/paulasilvatech/specky:latest \
  --push .
```

**Verify the published image:**

```bash
# Multi-arch manifest (expect linux/amd64 and linux/arm64)
docker buildx imagetools inspect ghcr.io/paulasilvatech/specky:$VERSION

# Anonymous pull (confirms public visibility) using a throwaway Docker config
tmp=$(mktemp -d); DOCKER_CONFIG="$tmp" docker pull ghcr.io/paulasilvatech/specky:latest; rm -rf "$tmp"

# Smoke test /health
cid=$(docker run -d -p 127.0.0.1::3200 ghcr.io/paulasilvatech/specky:$VERSION)
port=$(docker port "$cid" 3200/tcp | sed 's/.*://')
curl -s "http://127.0.0.1:$port/health"     # -> {"status":"ok","version":"X.Y.Z"}
docker rm -f "$cid"
```

**GitHub UI (one-time, after the first push):**

- **Packages → specky → Package settings → Danger Zone → Change visibility →
  Public** (if your org allows public packages; the toggle is disabled when org
  admins restrict it — then keep it private and pull with a `read:packages`
  login).
- **Connect repository** → `paulasilvatech/specky` so the package inherits repo
  access and shows on the repo page.

---

## Rollback

1. **Within 72h** of publish: `npm unpublish specky-sdd@<bad-version>`
2. **After 72h**: ship a patch (`npm version patch`, re-flight, publish), then
   `npm dist-tag add specky-sdd@<good-version> latest` to move `@latest` back.
3. **Deprecate** the bad version: `npm deprecate specky-sdd@<bad-version> "Critical bug; upgrade to <good-version>"`

---

## Release checklist (copy into the release PR description)

```text
- [ ] Version bumped in package.json / package-lock.json / apm.yml / config.yml
- [ ] CHANGELOG.md entry for this version
- [ ] docs/API_REFERENCE.md regenerated (if tools changed)
- [ ] CI green on main (all platforms + node 20/22)
- [ ] `node scripts/release.mjs` exits 0
- [ ] README install section still accurate
- [ ] dist-tag decision made (next vs latest)
- [ ] GitHub Release published on main (fires the publish workflow)
- [ ] npm shows the new version as latest (npm view --prefer-online)
- [ ] Post-publish smoke test from the npm registry passed
- [ ] (If enabling GHCR) PUBLISH_DOCKER=true + multi-arch container pushed
- [ ] (If enabling GHCR) GHCR visibility/repository access checked
```

---

## Common mistakes to avoid

| ❌ Mistake | ✅ Instead |
| --- | --- |
| `npm publish` from a laptop as the default | Create a GitHub Release; CI publishes with provenance |
| Publish while local is on the previous version | `git pull origin main` first; confirm `package.json` version |
| Create the Release as a **Draft** | Must be **Published** — a draft does not fire the workflow |
| Forget `--access public` on a manual publish | Specky is MIT; always public |
| Use `@latest` for a prerelease | Use `@next` and promote later (Step 5) |
| Skip the version bump before releasing | Bump package.json first — it drives the CLI/server version |
| Ignore a failing smoke test because "works locally" | Fix the test; don't bypass |
