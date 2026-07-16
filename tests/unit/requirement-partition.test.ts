import { describe, expect, it } from "vitest";
import { partitionFunctionalNonFunctional } from "../../src/utils/requirement-partition.js";

describe("partitionFunctionalNonFunctional", () => {
  it("uses explicit NFR IDs and evidence keywords without generating design content", () => {
    const { functional, nonfunctional } = partitionFunctionalNonFunctional([
      { id: "REQ-CORE-001", text: "The system shall create invoices." },
      { id: "REQ-CORE-002", text: "The system shall encrypt stored secrets." },
      { id: "REQ-NFR-001", text: "The system shall remain available." },
    ]);
    expect(functional.map((requirement) => requirement.id)).toEqual(["REQ-CORE-001"]);
    expect(nonfunctional.map((requirement) => requirement.id)).toEqual([
      "REQ-CORE-002",
      "REQ-NFR-001",
    ]);
  });
});
