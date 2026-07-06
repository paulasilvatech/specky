---
description: Reset an SDD pipeline phase by restoring the checkpoint taken before it
agent: agent
argument-hint: <feature-number> <phase 0-9 or phase name>
---
Reset an SDD pipeline phase for feature [FEATURE NUMBER].

**Phase to reset:** [0-9 or phase name]

Resetting a phase rewinds the pipeline to the checkpoint captured before that
phase started. Any artifacts produced after that checkpoint are reverted, so
this is a destructive operation that requires explicit confirmation.

Steps:
1. Call `sdd_get_status` to confirm the current feature and phase.
2. Call `sdd_list_checkpoints` to list the checkpoints available for the feature.
3. Identify the checkpoint taken immediately before the target phase.
4. Show which checkpoint will be restored and which artifacts will be reverted
   or regenerated, then ask the developer to confirm.
5. After explicit confirmation, call `sdd_restore` with the selected checkpoint
   to rewind the state machine and artifacts to that phase.
6. Report the restored phase and the next recommended action.

Never call `sdd_restore` without explicit confirmation.
