# Specky 3.6.0 — The delivery-honesty release

> Copy-paste body for the GitHub Release `v3.6.0`.

**We audited ourselves and published the results.** A black-box audit executed
all **65 public product promises** against the real 3.5.0 server — no claim was
accepted from docs or source reading. Verdict: 30 delivered, 29 partial, 6 not
delivered ([full record](../audits/AUDIT-DELIVERY-3.5.md)). **3.6.0 fixes every
finding.** Specky now does what it says — and says what it does.

## Highlights

### 🎯 The quality gate is honest everywhere

`sdd_auto_pipeline` was the last path still fabricating `APPROVE`/100%. It now
runs the same real `AnalysisEngine` as everything else — auto-generated
packages report `CHANGES_NEEDED` until traceability is genuinely complete.
`sdd_get_status` now tells you the true phase (it used to read a state file
nothing writes), and the phase-skip loophole in featureless workspaces is closed.

### 🧪 Generated tests compile and run

pytest was a syntax error; junit couldn't compile (filename ≠ class, duplicate
methods); xunit had duplicate members; JS suites emitted markdown ToC noise as
tests. All six frameworks now produce compilable, REQ-traceable tests — and the
PBT generators (fast-check + Hypothesis) emit runnable property tests with real
REQ IDs. `sdd_verify_tests` finally scans where the tests were written, so
coverage numbers are real.

### 📄 Docs and diagrams derive from your spec, not from templates

Generated docs contain your actual EARS requirements (the old summarizer
captured only frontmatter). The runbook reads your design; API docs extract
real request/response examples; `er`/`dfd` emit valid Mermaid;
`class`/`state`/`c4_code` are no longer byte-identical stubs;
`sdd_generate_all_diagrams` **writes `DIAGRAMS.md`** (18 diagrams). `CHECKLIST.md`
and `CROSS_ANALYSIS.md` render their real tables instead of `[TODO:]`.

### 📦 Integrations tell the truth

Work-item exports are target-specific (GitHub/Jira/Azure Boards shapes, honoring
`project_key`, `area_path`, …). Real-world PDF/DOCX/PPTX no longer import as
gibberish marked "success" — unsupported binaries fail with clear guidance
(convert to md/txt or use the MarkItDown MCP). Terraform emits real resources
from your design; devcontainer/local-env detect from `DESIGN.md` as documented.

### ✅ Opt-in server-enforced LGTM

```yaml
# .specky/config.yml
pipeline:
  require_lgtm: true
```

Makes the Specify/Design/Tasks gates **server-enforced**: `sdd_advance_phase`
refuses to pass them without an explicit `lgtm: true`. Default off — the agent
convention keeps working unchanged.

## Compatibility

- No breaking changes for the standard flow. `sdd_auto_pipeline`'s
  `gate_decision` is now an object with the computed decision (was the literal
  string `"APPROVE"`) — consumers that hard-coded that string should read
  `gate_decision.decision`.
- New config key: `pipeline.require_lgtm` (default `false`). New optional input
  `lgtm` on `sdd_advance_phase`.
- 299 tests (34 suites; +112 new locking generated-content quality).

## Install / upgrade

```bash
npm install -g specky-sdd@latest   # 3.6.0
cd your-project && specky upgrade  # refreshes assets, preserves .specs/
```

Full details: [CHANGELOG.md](../../CHANGELOG.md) · [AUDIT-DELIVERY-3.5.md](../audits/AUDIT-DELIVERY-3.5.md)
