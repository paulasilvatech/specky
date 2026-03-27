# Auto-Checkpoint Hook

## Trigger
- **Event:** PostToolUse (Edit|Write)
- **Condition:** Spec artifact file modified (CONSTITUTION.md, SPECIFICATION.md, DESIGN.md, TASKS.md, ANALYSIS.md, CHECKLIST.md, VERIFICATION.md)

## Behavior
When a specification artifact is modified, this hook outputs a reminder to stderr suggesting the user create a checkpoint via `sdd_checkpoint`.

## Purpose
Prevents data loss by encouraging checkpoint creation before further changes to spec artifacts. Checkpoints can be restored with `sdd_restore` if changes need to be rolled back.

## Model
- claude-haiku-3.5 (deterministic, lightweight)

## Exit Code
- 0 (advisory only — does not block)

## Notes
- Only triggers for recognized spec artifact filenames
- Does not trigger for non-spec files
- Complements the checkpoint/restore system (sdd_checkpoint, sdd_restore, sdd_list_checkpoints)
