/**
 * routing-helper.test.ts — appending model_routing_hint to tool responses.
 */
import { describe, expect, it } from "vitest";
import { appendRoutingHint, routingEngine } from "../../src/utils/routing-helper.js";

describe("appendRoutingHint", () => {
  it("appends a routing hint for a known phase", () => {
    const response = { status: "ok" };
    const result = appendRoutingHint(response, "design");

    expect(result.model_routing_hint).toBeDefined();
    expect(result.model_routing_hint.model).toBeDefined();
    expect(result.model_routing_hint.mode).toBeDefined();
    expect(result.status).toBe("ok");
  });

  it("uses the implement fallback for unknown phases", () => {
    const response = { status: "ok" };
    const result = appendRoutingHint(response, "unknown-phase");

    expect(result.model_routing_hint).toBeDefined();
    // implement fallback uses the same model as implement
    const implementHint = routingEngine.getHint("implement");
    expect(result.model_routing_hint.model).toBe(implementHint.model);
  });

  it("escalates to Opus when complexity signals exceed threshold", () => {
    const response = { status: "ok" };
    const result = appendRoutingHint(response, "design", { file_count: 15 });

    expect(result.model_routing_hint.model).toBe("claude-opus-4-7");
    expect(result.model_routing_hint.premium_multiplier).toBe("3x");
  });

  it("does not escalate for non-design/implement phases", () => {
    const response = { status: "ok" };
    const result = appendRoutingHint(response, "init", { file_count: 15 });

    expect(result.model_routing_hint.model).toBe("claude-haiku-4-5");
  });

  it("mutates the original response object", () => {
    const response = { status: "ok" };
    appendRoutingHint(response, "design");

    expect(response).toHaveProperty("model_routing_hint");
  });
});
