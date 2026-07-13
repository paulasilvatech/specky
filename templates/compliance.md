<!-- markdownlint-disable -->
# Compliance Report: {{title}}

**Feature**: {{feature_id}}
**Framework**: {{framework}}
**Date**: {{date}}
**Overall Status**: {{overall_status}}

---

## Controls Assessment

| Control ID | Name | Status | Evidence | Remediation |
|-----------|------|--------|----------|-------------|
{{#each findings}}{{this}}
{{/each}}

## Summary

- **Controls Checked**: {{controls_checked}}
- **Passed**: {{controls_passed}}
- **Failed**: {{controls_failed}}
- **N/A**: {{controls_na}}

## Recommendation

{{recommendation}}
