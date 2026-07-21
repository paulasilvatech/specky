import { describe, expect, it } from "vitest";
import {
  discoveryQuestionsForContract,
  renderWorkloadDesign,
  workloadDesignInputSchema,
} from "../../src/contracts/pipeline-profiles.js";
import {
  type Lifecycle,
  resolveUseCaseContract,
  type Workload,
} from "../../src/contracts/use-case.js";

const workloads: Workload[] = [
  "api",
  "web-application",
  "service",
  "cli",
  "library",
  "infrastructure",
];

const designInputs = {
  api: {
    type: "api",
    versioning_strategy: "URI major versions remain compatible for twelve months.",
    error_model: "Problem Details responses use stable machine-readable codes.",
    authentication: "OAuth 2.1 tokens map scopes to operation permissions.",
    rate_limits: "Per-client quotas use response headers and retry-after semantics.",
  },
  "web-application": {
    type: "web-application",
    user_journeys: "Checkout covers entry, validation, confirmation and abandonment.",
    ui_states: "Every view defines loading, empty, error, success and disabled states.",
    accessibility: "WCAG 2.2 AA, keyboard order and screen-reader announcements are required.",
    responsive_behavior: "Layouts define compact, medium and wide viewport behavior.",
    api_integration: "Session-bound HTTPS calls use typed responses and cache invalidation.",
  },
  service: {
    type: "service",
    protocols: "Versioned HTTPS and event schemas identify each caller.",
    dependencies: "Database and queue ownership are named with timeout budgets.",
    failure_modes: "Retries, idempotency and circuit breaking are bounded per dependency.",
    operability: "Health probes, scaling and rollback criteria are release gates.",
    observability: "Trace, metric and log fields map to owned alerts.",
  },
  cli: {
    type: "cli",
    command_grammar: "Commands and subcommands have a versioned grammar.",
    arguments: "Required arguments, typed options and conflicts are enumerated.",
    exit_codes: "Stable exit codes distinguish input, auth and remote failures.",
    standard_streams: "Machine output uses stdout and diagnostics use stderr.",
    shell_compatibility: "macOS zsh, Linux bash and PowerShell are tested explicitly.",
  },
  library: {
    type: "library",
    public_api: "Exported functions and types carry documented stability levels.",
    compatibility: "Node runtimes and package-manager ranges are tested.",
    versioning: "Semantic versioning and deprecation windows govern changes.",
    error_surface: "Typed errors define ownership and resource cleanup.",
    consumer_examples: "Executable examples cover initialization, success and failure.",
  },
  infrastructure: {
    type: "infrastructure",
    topology: "Environment and regional resource topology is enumerated.",
    provider: "Provider versions and allowed regions are pinned by policy.",
    state_management: "Remote state, locking and drift review are mandatory.",
    identity: "Deployment and runtime identities have separate least-privilege roles.",
    network_security: "Ingress, egress and private endpoint paths are documented.",
  },
} as const;

function contract(lifecycle: Lifecycle, workload: Workload) {
  return resolveUseCaseContract({
    lifecycle,
    workload,
    execution_mode: "full",
    capabilities: [],
    capability_config: {},
  });
}

describe("lifecycle and workload pipeline profiles", () => {
  it("materializes a distinct evidence-oriented discovery pack for every workload", () => {
    const firstQuestions = new Set<string>();
    const diagramManifests = new Set<string>();
    for (const workload of workloads) {
      const resolved = contract("greenfield", workload);
      const questions = discoveryQuestionsForContract(resolved, {
        projectIdea: `Build ${workload}`,
      });
      expect(questions).toHaveLength(5);
      expect(questions.every((question) => question.required_evidence.length > 20)).toBe(true);
      expect(questions.map((question) => question.id)).toEqual([
        "DQ-001",
        "DQ-002",
        "DQ-003",
        "DQ-004",
        "DQ-005",
      ]);
      firstQuestions.add(questions[2].question);
      expect(resolved.required_diagrams).toHaveLength(3);
      diagramManifests.add(
        resolved.required_diagrams.map((diagram) => `${diagram.type}:${diagram.source}`).join("|"),
      );
    }
    expect(firstQuestions).toHaveLength(workloads.length);
    expect(diagramManifests).toHaveLength(workloads.length);
  });

  it("requires a codebase baseline for brownfield discovery", () => {
    expect(() =>
      discoveryQuestionsForContract(contract("brownfield", "service"), {
        projectIdea: "Extend orders",
      }),
    ).toThrow(/requires codebase_summary/);

    const questions = discoveryQuestionsForContract(contract("brownfield", "service"), {
      projectIdea: "Extend orders",
      codebaseSummary: "TypeScript monolith with PostgreSQL and an owned order module.",
    });
    expect(questions[0].category).toBe("Brownfield baseline");
    expect(questions.some((question) => question.category === "Brownfield compatibility")).toBe(
      true,
    );
  });

  it("requires explicit source and target evidence for migration discovery", () => {
    expect(() =>
      discoveryQuestionsForContract(contract("migration", "api"), {
        projectIdea: "Migrate API",
        migrationSource: "Legacy Java API",
      }),
    ).toThrow(/requires migration_source and migration_target/);

    const questions = discoveryQuestionsForContract(contract("migration", "api"), {
      projectIdea: "Migrate API",
      migrationSource: "Legacy Java API with SOAP consumers and Oracle storage.",
      migrationTarget: "TypeScript REST API on the approved container platform.",
    });
    expect(questions.slice(0, 3).map((question) => question.category)).toEqual([
      "Migration source",
      "Migration target",
      "Migration execution",
    ]);
  });

  it("validates and renders a distinct design block for each workload", () => {
    const headings = new Set<string>();
    for (const workload of workloads) {
      const parsed = workloadDesignInputSchema.parse(designInputs[workload]);
      const rendered = renderWorkloadDesign(workload, parsed);
      expect(rendered).not.toContain("undefined");
      expect(rendered).not.toContain("TODO");
      headings.add(rendered.split("\n")[0]);
    }
    expect(headings).toHaveLength(workloads.length);
  });

  it("rejects a design payload from a different workload", () => {
    const serviceDesign = workloadDesignInputSchema.parse(designInputs.service);
    expect(() => renderWorkloadDesign("api", serviceDesign)).toThrow(
      /does not match feature workload api/,
    );
  });
});
