---
name: agentic-architecture-patterns
description: "Decision framework for designing production agentic systems on GitHub platform and Azure AI Foundry. Covers model routing tiers (mini to frontier), prompt caching and semantic caching, short and long term memory, context curation and RAG, tools and MCP, identity and guardrails, evaluation, observability (OpenTelemetry GenAI), and cost control. Use when architecting an AI agent or multi-agent system, choosing a model router, deciding a caching or memory strategy, planning context windows, or reviewing an agent design for reliability, security, and cost. Pairs with azure-managed-redis-cache, foundry-agent-blueprint, azure-api-center, apim-ai-gateway, and azure-architecture-diagrams."
argument-hint: "what to design or review, for example a routing and caching strategy for an agentic RAG service"
---

# Agentic Architecture Patterns

The core decision framework for AI-native systems. It turns a use case into concrete choices for routing, caching, memory, context, tools, identity, guardrails, evaluation, observability, and cost. Keep this file as the map; load the reference files for depth.

> Never invent limits, prices, or benchmarks. Verify service limits and pricing against Microsoft Learn and the vendor model card, and cite them. Where a number has no source, state it as an explicit assumption.

## The seven decisions

Every agentic design resolves these, in order. Each links to a reference for the detail.

1. **Model routing**: match each task to the cheapest model that meets quality. See [references/model-routing.md](references/model-routing.md).
2. **Caching**: cut latency and cost with prompt caching and semantic caching. See [references/caching.md](references/caching.md).
3. **Memory**: separate short term thread state from long term durable memory. See [references/memory.md](references/memory.md).
4. **Context curation**: retrieve, rank, compact, and budget the context window (RAG). See [references/context-curation.md](references/context-curation.md).
5. **Tools and MCP**: expose capabilities as well-described tools and Model Context Protocol servers. See [references/tools-and-mcp.md](references/tools-and-mcp.md).
6. **Identity and guardrails**: agent identity, least privilege, content safety, prompt shields. See [references/guardrails-and-identity.md](references/guardrails-and-identity.md).
7. **Evaluation, observability, and cost**: measure quality, trace runs, and govern spend. See [references/evaluation-observability-cost.md](references/evaluation-observability-cost.md).

## Reference architecture (target)

```text
User / GitHub Copilot / GitHub Actions
        |
   API Management (AI gateway): authN, token limit, load balance, semantic cache
        |
   Agent runtime (Azure AI Foundry Agent Service, Container Apps, or AKS)
   |          |              |                 |
 Model      Memory        Context           Tools / MCP
 router    (Redis +      (RAG: AI Search   (API Center registry,
 (tiers)    vector)       + rerank)          MCP servers)
        |
 Guardrails (Content Safety, Prompt Shields) + Identity (Entra Agent ID, managed identity)
        |
 Observability (App Insights + OpenTelemetry GenAI) + Evaluation (Foundry evals)
```

## How to use this skill

1. Read the use case and constraints (scale, latency, cost ceiling, data sensitivity, where it runs).
2. Walk the seven decisions in order. For each, open its reference, choose an option, and record the rationale and the source.
3. Map each decision to a service. Route to the companion skills:
   - cache, semantic cache, vector store, or memory store on Redis -> `azure-managed-redis-cache`
   - agent runtime, model catalog, threads, tools on Foundry -> `foundry-agent-blueprint`
   - API and tool or MCP governance -> `azure-api-center`
   - model gateway policies (token limit, load balance, semantic cache) -> `apim-ai-gateway`
   - diagrams of the result -> `azure-architecture-diagrams`
4. Produce the decision record and hand the service map to the diagram skill.

## Anti-patterns to flag

- One frontier model for every task. Route by task class; reserve frontier for the hardest steps.
- No caching on stable system prompts or repeated retrievals. Prompt caching and semantic caching are the highest-leverage cost levers.
- Unbounded context. Always budget the window and compact history.
- Treating tool sprawl as free. Each tool adds selection cost; curate and namespace tools.
- Shared secrets instead of managed identity and agent identity.
- Shipping without evals or tracing. You cannot govern what you do not measure.

## References

- [Azure AI Foundry](https://learn.microsoft.com/azure/ai-foundry/)
- [Azure Well-Architected for AI workloads](https://learn.microsoft.com/azure/well-architected/ai/)
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub Models](https://docs.github.com/github-models)
