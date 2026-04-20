# Publishing Specky to npm

> Audience: maintainer (Paula Silva).
> This doc is intentionally short and prescriptive. Follow it step by step.

---

## Prerequisites (one-time)

1. **npm account** with publish rights to `specky-sdd`
   ```bash
   npm whoami
   # must print your npm username
   ```
2. **2FA enabled** on npm (required for publishing — enforce with `--access public --otp=<code>`)
3. **gh CLI authenticated** (`gh auth status`) — used to verify CI status
4. **Clean working tree**, on `main` or a release branch

---

## Release procedure

### Step 0 — Decide release type

| Release type | package.json version | npm dist-tag |
|---|---|---|
| Prerelease (beta) | `3.4.0-rc.6` (or `3.4.0-beta.1`) | `next` |
| Stable | `3.4.0` | `latest` |

**Recommendation for the v3.4 series:** publish as `@next` first, let at least one pilot customer (e.g., SIFAP) install and run for 48 hours, then promote to `@latest`.

### Step 1 — Verify CI green

```bash
# On the branch being released, require ALL of these green:
gh run list --branch main --limit 5
#  ✓ Hooks Compatibility
#  ✓ Install Smoke Test  (matrix: ubuntu + macos + windows × node 20/22)
#  ✓ CI
```

Do NOT proceed if any required workflow is red.

### Step 2 — Local pre-flight

```bash
node scripts/release.mjs
```

This runs:
- `git` working tree clean + in sync with remote
- Clean build
- All tests (unit + integration)
- `npm pack --dry-run` verifies all assets ship
- Fresh install from packed tarball into `/tmp/` + `specky init` + `specky doctor`
- Version sanity check (semver + dist-tag match)

Must exit `0`. Do NOT proceed otherwise.

### Step 3 — Tag the release

```bash
VERSION=$(node -p "require('./package.json').version")
git tag "v$VERSION" -m "release $VERSION"
git push origin "v$VERSION"
```

### Step 4 — Publish

**Prerelease:**

```bash
npm publish --tag next --access public
# npm will prompt for 2FA OTP
```

Users install with:
```bash
npm install -g specky-sdd@next
```

**Stable:**

```bash
# First: bump package.json version to strip -rc suffix
# e.g., 3.4.0-rc.6 → 3.4.0
# Commit the version bump, push, rerun release.mjs, then:

npm publish --tag latest --access public
```

Users install with:
```bash
npm install -g specky-sdd           # gets @latest by default
```

### Step 5 — Promote a prerelease to stable

```bash
# After soak time, without republishing:
npm dist-tag add specky-sdd@3.4.0-rc.6 latest
```

(Users already on `@next` don't get auto-upgraded; they upgrade on their next `npm install`.)

### Step 6 — Post-publish verification

```bash
# Wait ~60s for npm CDN propagation, then:
mkdir /tmp/verify && cd /tmp/verify && npm init -y
npm install specky-sdd@<version> --silent
npx specky --version
npx specky init --dry-run
```

If the install fails, you have ~72 hours to unpublish (`npm unpublish specky-sdd@<version>`). After 72h, unpublish is blocked by npm policy — the only fix is a new version bump.

### Step 7 — GitHub Release

```bash
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --notes-file CHANGELOG.md \
  --target main
```

Or use the GitHub UI: Releases → Draft new release.

---

## Rollback

If a bad version shipped and customers are affected:

1. **Within 72h** of publish:
   ```bash
   npm unpublish specky-sdd@<bad-version>
   ```
2. **After 72h**: cannot unpublish. Ship a patch release:
   ```bash
   # Fix the bug, bump to x.y.z+1, republish
   npm version patch
   node scripts/release.mjs
   npm publish --tag latest
   # Move @latest back to a known-good version if needed:
   npm dist-tag add specky-sdd@<good-version> latest
   ```
3. **Deprecate** the bad version with a notice:
   ```bash
   npm deprecate specky-sdd@<bad-version> "Critical bug; upgrade to <good-version>"
   ```

---

## Release checklist (copy into PR description)

```
- [ ] CI green on all required workflows
- [ ] `node scripts/release.mjs` exits 0
- [ ] CHANGELOG.md entry for this version
- [ ] README install section still accurate
- [ ] Version is correct semver (no typos)
- [ ] dist-tag decision made (next vs latest)
- [ ] 2FA device ready
- [ ] Git tag pushed (v<version>)
- [ ] npm publish ran successfully
- [ ] Post-publish smoke test from npm registry passed
- [ ] GitHub Release created
- [ ] (If stable) pilot customer notified
```

---

## Common mistakes to avoid

| ❌ Mistake | ✅ Instead |
|---|---|
| Publish without `node scripts/release.mjs` | Always run pre-flight |
| Forget `--access public` on first publish | Specky is MIT; always public |
| Use `@latest` for a prerelease | Use `@next` and promote later |
| Strip `-rc` suffix AFTER publishing | Bump version BEFORE `npm publish` |
| Forget to push the git tag | `git push origin v<version>` after `npm publish` |
| Ignore a failing smoke test because "works locally" | Fix the test; don't bypass |
