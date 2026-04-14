---
description: Run SDD release phase
---
Run the SDD release phase for feature [FEATURE NUMBER].

**Branch:** [current spec/NNN-* branch]
**Target:** develop (then stage → main after gates pass)

@release-engineer — verify branch, run blocking gates (security-scan + release-gate), generate documentation, create PR targeting the correct branch.
