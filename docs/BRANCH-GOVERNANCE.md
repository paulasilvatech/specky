# Branch Governance

This document defines the branch policy for Specky after the 2026-06-17 repository reset.

## Source Of Truth

`main` is the production source of truth. A new `develop` branch is maintained as the integration branch and must be created from the current `main` head after any branch reset.

As of the reset, all branch refs below pointed to the same commit:

```text
main           4225130af2780f44bc3a3825e5db275879f6b111
develop        4225130af2780f44bc3a3825e5db275879f6b111
origin/main    4225130af2780f44bc3a3825e5db275879f6b111
origin/develop 4225130af2780f44bc3a3825e5db275879f6b111
```

## Branch Policy

Only these long-lived branches are allowed:

| Branch | Purpose | Rule |
| --- | --- | --- |
| `main` | Production source of truth | Protected. Releases and npm publish must trace to this branch. |
| `develop` | Integration branch | Recreated from `main` during reset; used for active hardening work before promotion. |

All feature, dependency, experiment, and temporary branches are short-lived. They must be removed after merge, close, or reset.

## Reset Procedure

Use this procedure only when intentionally resetting repository branch state.

```bash
git fetch origin --prune
git status --short
git switch main
git pull --ff-only origin main
gh pr list --state open --json number,headRefName,baseRefName,url
git ls-remote --heads origin
npm view specky-sdd dist-tags --json

git push origin --delete develop
git push origin "$(git rev-parse origin/main):refs/heads/develop"

# Delete every remaining remote branch except main and develop.
# Delete every local branch except main and develop.
```

## 2026-06-17 Reset Evidence

Preflight found that old `develop` was divergent from `main`:

```text
origin/main...origin/develop: 32 behind, 1 ahead
```

The remote cleanup removed the old `develop` branch and all Dependabot branches, then recreated `develop` from `origin/main`. Open PRs were empty after cleanup.

A dirty local `develop` working tree with `.apm/` deletions was preserved before local reset:

```text
stash@{0}: On develop: specky-pre-branch-reset-develop-dirty-20260617T205947Z
```

## Required Verification

After any branch reset, verify:

```bash
git ls-remote --heads origin
git branch --format='%(refname:short) %(objectname)'
git rev-list --left-right --count origin/main...origin/develop
gh pr list --state open --json number,headRefName,baseRefName,url
```

Expected remote branches:

```text
main
develop
```

Expected comparison:

```text
0 0
```

## References

- [GitHub Docs: Managing branches in your repository](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository)
- [GitHub Docs: About protected branches](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [npm Docs: npm view](https://docs.npmjs.com/cli/v10/commands/npm-view)
