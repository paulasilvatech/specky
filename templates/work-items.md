# Work Items Export: {{title}}

**Feature**: {{feature_id}}
**Platform**: {{platform}}
**Date**: {{date}}
**Total Items**: {{total_items}}

---

## Export Summary

| Task ID | Title | Traces To | Effort |
|---------|-------|-----------|--------|
{{#each items}}
| {{task_id}} | {{title}} | {{traces_to}} | {{effort}} |
{{/each}}

## Routing Instructions

- **MCP Server**: {{mcp_server}}
- **Tool**: {{tool_name}}
- **Note**: {{routing_note}}

## Next Steps

The AI client should call the {{platform}} MCP server for each work item above.
