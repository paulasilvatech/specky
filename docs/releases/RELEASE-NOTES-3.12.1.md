# Specky 3.12.1 - Signed Contract Amendments

Specky 3.12.1 removes two blockers for repositories that use feature-scoped task IDs and evolve executable TDD evidence after implementation.

## Added

- Task IDs in `T-NNN-NNN` form, including parsing from tables and checkboxes and use in dependency lists.
- Optional `tdd_amendment` payload on `sdd_amend` for replacing TDD imports, executable bindings, property imports, and property bindings.

## Safety

- Replacement bindings must cover every active requirement exactly once.
- Unknown requirements, duplicate requirement bindings, duplicate test names, trivial tests, and invalid properties fail before artifacts are written.
- Contract fingerprints and signed state are regenerated through the existing atomic state machine.
- Existing phase status, gate decisions, gate history, drift history, and non-TDD capability configuration are preserved.
- TDD amendments are rejected after a feature enters the Release phase.

## Compatibility

Existing `T-001` and legacy `T001` task IDs remain supported. Existing `sdd_amend` calls without `tdd_amendment` retain their previous behavior.
