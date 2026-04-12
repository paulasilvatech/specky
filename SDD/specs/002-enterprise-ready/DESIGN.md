---
title: "Specky v3.0 Enterprise-Ready — Design"
feature_id: "002-enterprise-ready"
version: 1.0.0
date: 2026-03-21
author: "Paula Silva @paulasilvatech @paulanunes85 | Americas Software GBB"
status: Draft
---

# Specky v3.0 Enterprise-Ready — Design

---

## 1. Architecture Overview

This feature adds a **testing layer** and **trust signals** to the existing Specky architecture without modifying the core pipeline. All additions follow the established patterns: thin tools, fat services, FileManager owns I/O.

```
┌─────────────────────────────────────────────────────────────┐
│                    Specky MCP Server v3.0                     │
│                                                              │
│  ┌─── Existing Tool Layer (43 tools) ─────────────────────┐ │
│  │  pipeline.ts │ utility.ts │ quality.ts │ integration.ts │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── NEW: Testing Tool Layer ────────────────────────────┐ │
│  │  testing.ts (2 tools: sdd_generate_tests,              │ │
│  │                        sdd_verify_tests)                │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── NEW: Testing Schema ────────────────────────────────┐ │
│  │  schemas/testing.ts (Zod schemas for test tools)        │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── Existing Service Layer (14 services) ───────────────┐ │
│  │  FileManager │ StateMachine │ EarsValidator │ ...        │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── NEW: Test Generator Service ────────────────────────┐ │
│  │  test-generator.ts                                      │ │
│  │  - readSpecification(specDir) → RequirementWithAC[]     │ │
│  │  - generateStubs(reqs, framework, outputDir) → files[]  │ │
│  │  - mapToPlaywright(userStories) → PlaywrightTest[]      │ │
│  │  - mapToApiContract(endpoints) → ContractTest[]         │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── NEW: Audit Service (optional) ──────────────────────┐ │
│  │  audit-logger.ts                                        │ │
│  │  - log(tool, specDir, result) → append .audit.jsonl     │ │
│  │  - isEnabled(config) → boolean                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│  ┌─── Existing Template Layer (21 templates) ─────────────┐ │
│  │  + NEW: test-stub.md (test stub template)               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. New Files

### 2.1 Source Files

| File | Type | Purpose |
|------|------|---------|
| `src/services/test-generator.ts` | Service | Reads specs, generates test stubs for 6 frameworks |
| `src/services/audit-logger.ts` | Service | Optional audit trail logging |
| `src/schemas/testing.ts` | Schema | Zod schemas for `sdd_generate_tests` and `sdd_verify_tests` |
| `src/tools/testing.ts` | Tools | 2 thin tools: `sdd_generate_tests`, `sdd_verify_tests` |
| `vitest.config.ts` | Config | Vitest configuration with ESM + coverage |

### 2.2 Test Files

| File | Tests |
|------|-------|
| `src/services/__tests__/ears-validator.test.ts` | 6 valid + 6 invalid EARS patterns + edge cases |
| `src/services/__tests__/state-machine.test.ts` | 10 transitions + skip blocking + persistence + reset |
| `src/services/__tests__/compliance-engine.test.ts` | 6 frameworks × N controls with fixture specs |
| `src/services/__tests__/file-manager.test.ts` | Path traversal + CRUD + atomic ops |
| `src/services/__tests__/template-engine.test.ts` | 21 templates + placeholder substitution |
| `src/services/__tests__/codebase-scanner.test.ts` | Tech stack detection with fixtures |
| `src/services/__tests__/transcript-parser.test.ts` | VTT + SRT + MD + TXT parsing |
| `src/services/__tests__/test-generator.test.ts` | Multi-framework stub generation |
| `src/__tests__/mcp-integration.test.ts` | MCP handshake + tool calls |
| `src/__tests__/pipeline-e2e.test.ts` | Full 7-phase pipeline |

### 2.3 Documentation Files

| File | Purpose |
|------|---------|
| `SECURITY.md` | Vulnerability disclosure + OWASP controls |
| `CHANGELOG.md` | Retroactive changelog v1.0.0 → v2.1.0 |
| `docs/integration-cookbook.md` | Recipes for GitHub, Azure DevOps, Jira, Terraform, Figma, Docker |
| `docs/enterprise-deployment.md` | Docker, HTTP mode, CI/CD, multi-team setup |

### 2.4 Configuration Files

| File | Purpose |
|------|---------|
| `.github/dependabot.yml` | Weekly npm dependency updates |
| `.github/workflows/codeql.yml` | CodeQL security analysis |
| `templates/test-stub.md` | Template for generated test files |

---

## 3. TestGenerator Service Interface

```typescript
interface RequirementWithAC {
  id: string;              // e.g., "REQ-TEST-001"
  description: string;     // EARS requirement text
  acceptanceCriteria: string[];  // List of AC items
  tracesTo: string[];      // Constitution success criteria
}

interface GeneratedTest {
  filePath: string;        // e.g., "tests/req-test-001.test.ts"
  framework: TestFramework;
  requirementId: string;
  content: string;         // Generated test code
}

type TestFramework = "vitest" | "jest" | "playwright" | "pytest" | "junit" | "xunit";

class TestGenerator {
  constructor(private fileManager: FileManager) {}

  // Parse SPECIFICATION.md → extract requirements with acceptance criteria
  async readSpecification(specDir: string): Promise<RequirementWithAC[]>;

  // Generate test stubs for each requirement
  async generateStubs(
    requirements: RequirementWithAC[],
    framework: TestFramework,
    outputDir: string
  ): Promise<GeneratedTest[]>;

  // Generate Playwright-specific E2E tests from user stories
  async mapToPlaywright(
    requirements: RequirementWithAC[],
    designComponents: string[]
  ): Promise<GeneratedTest[]>;

  // Generate API contract tests from DESIGN.md endpoints
  async mapToApiContract(
    endpoints: ApiEndpoint[],
    framework: TestFramework
  ): Promise<GeneratedTest[]>;
}
```

---

## 4. Tool Registration Pattern

```typescript
// src/tools/testing.ts — follows thin tools pattern

export function registerTestingTools(
  server: McpServer,
  fileManager: FileManager,
  testGenerator: TestGenerator
): void {

  server.registerTool(
    "sdd_generate_tests",
    {
      title: "Generate Test Stubs",
      description: "Generates test stubs from SPECIFICATION.md acceptance criteria...",
      inputSchema: generateTestsSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, ... }
    },
    async (input) => {
      // 1. Read specification
      // 2. Call testGenerator.generateStubs()
      // 3. Write files via fileManager
      // 4. Return educative output with next_steps + recommended_servers
    }
  );

  server.registerTool(
    "sdd_verify_tests",
    { ... },
    async (input) => { ... }
  );
}
```

---

## 5. Audit Logger Interface

```typescript
interface AuditEntry {
  tool: string;
  timestamp: string;      // ISO 8601
  spec_dir: string;
  result_summary: string; // "success" | "error: ..."
  metadata?: Record<string, unknown>;
}

class AuditLogger {
  constructor(private fileManager: FileManager) {}

  async isEnabled(specDir: string): Promise<boolean>;
  async log(entry: AuditEntry): Promise<void>;
  // Appends to .specs/NNN/.audit.jsonl
}
```

---

## 6. CI Pipeline Design

```yaml
# Updated .github/workflows/ci.yml
jobs:
  build-and-test:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run build
      - run: npm test                    # NEW
      - run: npm run test:coverage       # NEW
      - name: Check coverage threshold   # NEW
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "::error::Coverage $COVERAGE% is below 80% threshold"
            exit 1
          fi
      - name: Check version sync         # NEW
        run: |
          PKG_VERSION=$(node -e "console.log(require('./package.json').version)")
          CLAUDE_VERSION=$(grep -m1 'Specky v' CLAUDE.md | sed 's/.*v//' | sed 's/ .*//')
          if [ "$PKG_VERSION" != "$CLAUDE_VERSION" ]; then
            echo "::error::CLAUDE.md version ($CLAUDE_VERSION) != package.json ($PKG_VERSION)"
            exit 1
          fi
      - name: Security audit
        run: npm audit --audit-level=high
```

---

## 7. Generated Test Stub Example (Vitest)

```typescript
// Generated by sdd_generate_tests for REQ-TEST-002
// Framework: vitest
// Traces to: SC-001

import { describe, it, expect } from "vitest";
import { EarsValidator } from "../services/ears-validator.js";

describe("REQ-TEST-002: EarsValidator EARS Patterns", () => {
  const validator = new EarsValidator();

  it("validates Ubiquitous pattern", () => {
    const result = validator.validate("The system shall display a dashboard");
    expect(result.valid).toBe(true);
    expect(result.pattern).toBe("ubiquitous");
  });

  // TODO: Add remaining 5 pattern tests
  // TODO: Add 6 invalid pattern tests
  // TODO: Add edge cases (empty, whitespace, unicode)
});
```

---

## 8. Traceability Matrix

| Requirement | Design Component | Test File | Task IDs |
|-------------|-----------------|-----------|----------|
| REQ-TEST-001 | vitest.config.ts, package.json | — | T-001..T-003 |
| REQ-TEST-002 | EarsValidator | ears-validator.test.ts | T-004 |
| REQ-TEST-003 | StateMachine | state-machine.test.ts | T-005 |
| REQ-TEST-004 | ComplianceEngine | compliance-engine.test.ts | T-006 |
| REQ-TEST-005 | FileManager | file-manager.test.ts | T-008 |
| REQ-TEST-006 | TemplateEngine | template-engine.test.ts | T-007 |
| REQ-TEST-007 | MCP Integration | mcp-integration.test.ts | T-011 |
| REQ-TEST-008 | Pipeline E2E | pipeline-e2e.test.ts | T-012 |
| REQ-TEST-009 | ci.yml | — | T-013 |
| REQ-TEST-010 | README.md | — | T-014 |
| REQ-TGEN-001 | TestGenerator | test-generator.test.ts | T-020 |
| REQ-TGEN-002 | sdd_generate_tests | testing.ts | T-023 |
| REQ-TGEN-003 | TestGenerator.mapToPlaywright | test-generator.test.ts | T-024 |
| REQ-TGEN-004 | TestGenerator.mapToApiContract | test-generator.test.ts | T-025 |
| REQ-TGEN-005 | sdd_verify_tests | testing.ts | T-026 |
| REQ-TGEN-006 | recommended_servers | testing.ts | T-027 |
| REQ-DOC-001 | README.md | Manual | T-040..T-041 |
| REQ-DOC-003 | SECURITY.md | Manual | T-044 |
| REQ-DOC-004 | CHANGELOG.md | Manual | T-045 |
| REQ-DOC-006 | ci.yml version check | CI | T-015 |
| REQ-INTG-001 | .github/agents/ | Manual | T-060 |
| REQ-TRUST-001 | OpenSSF config | Scorecard | T-080 |
| REQ-TRUST-002 | publish.yml | npm | T-081 |
| REQ-TRUST-004 | ci.yml SBOM step | CI | T-083 |
| REQ-TRUST-005 | dependabot.yml, codeql.yml | GitHub | T-087 |
