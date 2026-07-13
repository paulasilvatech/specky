import { describe, expect, it } from "vitest";
import {
  deriveDesignStubs,
  extractEarsProse,
  partitionFunctionalNonFunctional,
} from "../../src/utils/design-stubs.js";

const SPEC = `# Specification

## Functional Requirements

### REQ-CORE-001: (event_driven)

When a customer submits the payment form, the system shall validate the card input.

### REQ-CORE-002: (event_driven)

When an order is confirmed, the system shall persist the order in the database.

### REQ-NFR-001: (ubiquitous)

The system shall encrypt data at rest and enforce OAuth2 authentication.
`;

describe("design-stubs", () => {
  it("extractEarsProse prefers shall-lines over chrome", () => {
    const prose = extractEarsProse(
      "\n**Priority:** P1\n\nWhen a user logs in, the system shall validate credentials.\n",
    );
    expect(prose).toContain("shall validate");
  });

  it("partitionFunctionalNonFunctional splits by keywords and REQ-NFR ids", () => {
    const { functional, nonfunctional } = partitionFunctionalNonFunctional([
      { id: "REQ-CORE-001", text: "The system shall create invoices." },
      { id: "REQ-CORE-002", text: "The system shall enforce security and encrypt secrets." },
      { id: "REQ-NFR-001", text: "The system shall remain available." },
    ]);
    expect(functional.map((r) => r.id)).toEqual(["REQ-CORE-001"]);
    expect(nonfunctional.map((r) => r.id)).toEqual(["REQ-CORE-002", "REQ-NFR-001"]);
  });

  it("deriveDesignStubs builds component bullets and keyword sections from SPEC", () => {
    const stubs = deriveDesignStubs(SPEC);
    expect(stubs.component_design).toContain("REQ-CORE-001");
    expect(stubs.component_design).toContain("REQ-NFR-001");
    expect(stubs.security_architecture).toContain("REQ-NFR-001");
    expect(stubs.data_models).toContain("REQ-CORE-002");
    expect(stubs.requirement_references).not.toContain("[TODO:");
  });
});
