# Operational Runbook: {{title}}

**Feature**: {{feature_id}}
**Date**: {{date}}
**Version**: {{version}}

---

## Deployment

{{deployment_steps}}

## Health Checks

| Endpoint | Expected | Interval |
|----------|----------|----------|
{{#each health_checks}}
| {{endpoint}} | {{expected}} | {{interval}} |
{{/each}}

## Monitoring & Alerts

{{monitoring}}

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|-----------|
{{#each troubleshooting}}
| {{symptom}} | {{cause}} | {{resolution}} |
{{/each}}

## Rollback Procedure

{{rollback}}

## Contacts

{{contacts}}
