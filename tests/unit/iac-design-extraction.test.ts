/**
 * iac-design-extraction.test.ts — canonical infrastructure extraction from
 * DESIGN.md and deterministic resolution against the signed contract.
 *
 * Every extracted service maps to a key the Terraform renderer supports, so
 * extraction can never produce a resource that renders as a generic
 * placeholder. Extraction is scoped to the infrastructure section, honors
 * negation, and reports recognized-but-unrenderable resources.
 */
import { describe, expect, it } from "vitest";
import type { InfraComponent } from "../../src/types.js";
import {
  detectUnsupportedResources,
  extractInfraComponentsForCloud,
  extractInfraComponentsFromDesign,
  extractInfrastructureSection,
  normalizeInfraComponent,
  resolveIacResources,
} from "../../src/services/iac-generator.js";

describe("extractInfraComponentsFromDesign — canonical keys", () => {
  it("maps datastores to canonical renderer services", () => {
    const design = "The system uses PostgreSQL for persistence and Redis for caching.";
    const components = extractInfraComponentsFromDesign(design);

    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components).toContainEqual({ module: "cache", service: "redis" });
  });

  it("maps NoSQL vendors (Mongo, Cosmos, DynamoDB) to database:nosql", () => {
    expect(extractInfraComponentsFromDesign("Uses MongoDB.")).toContainEqual({
      module: "database",
      service: "nosql",
    });
    expect(extractInfraComponentsFromDesign("Uses Cosmos DB.")).toContainEqual({
      module: "database",
      service: "nosql",
    });
    expect(extractInfraComponentsFromDesign("Uses DynamoDB.")).toContainEqual({
      module: "database",
      service: "nosql",
    });
  });

  it("maps serverless vendors (Functions, Lambda) to compute:serverless", () => {
    expect(extractInfraComponentsFromDesign("Azure Functions host the API.")).toContainEqual({
      module: "compute",
      service: "serverless",
    });
    expect(extractInfraComponentsFromDesign("AWS Lambda runs the handler.")).toContainEqual({
      module: "compute",
      service: "serverless",
    });
  });

  it("maps object storage (S3, Blob) to storage:object", () => {
    expect(extractInfraComponentsFromDesign("Files go to S3.")).toContainEqual({
      module: "storage",
      service: "object",
    });
    expect(extractInfraComponentsFromDesign("Files go to Blob Storage.")).toContainEqual({
      module: "storage",
      service: "object",
    });
  });

  it("maps VNet/VPC to networking:network", () => {
    expect(extractInfraComponentsFromDesign("Deploy inside a VNet.")).toContainEqual({
      module: "networking",
      service: "network",
    });
    expect(extractInfraComponentsFromDesign("Deploy inside a VPC.")).toContainEqual({
      module: "networking",
      service: "network",
    });
  });

  it("maps identity providers to identity:identity", () => {
    expect(extractInfraComponentsFromDesign("Auth via Azure AD.")).toContainEqual({
      module: "identity",
      service: "identity",
    });
    expect(extractInfraComponentsFromDesign("Auth via Cognito.")).toContainEqual({
      module: "identity",
      service: "identity",
    });
  });

  it("deduplicates repeated components", () => {
    const design = "PostgreSQL database. Postgres is used for persistence.";
    const components = extractInfraComponentsFromDesign(design);
    expect(
      components.filter((c) => c.module === "database" && c.service === "postgres"),
    ).toHaveLength(1);
  });

  it("returns empty for content with no recognized infrastructure", () => {
    expect(extractInfraComponentsFromDesign("A plain document.")).toHaveLength(0);
  });
});

describe("extractInfrastructureSection — isolation", () => {
  it("isolates the infrastructure section when a heading exists", () => {
    const design = [
      "## Overview",
      "We considered Redis but chose in-memory caching for the prototype.",
      "",
      "## Infrastructure",
      "PostgreSQL Flexible Server.",
    ].join("\n");

    const { text, isolated } = extractInfrastructureSection(design);
    expect(isolated).toBe(true);
    expect(text).toContain("PostgreSQL");
    expect(text).not.toContain("Redis");
  });

  it("does not extract resources mentioned outside the infrastructure section", () => {
    const design = [
      "## Background",
      "Redis is popular for caching.",
      "## Deployment",
      "We deploy PostgreSQL only.",
    ].join("\n");

    const components = extractInfraComponentsFromDesign(design);
    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components.find((c) => c.service === "redis")).toBeUndefined();
  });

  it("falls back to the whole document when no infra heading exists", () => {
    const { isolated } = extractInfrastructureSection("Just PostgreSQL.");
    expect(isolated).toBe(false);
  });
});

describe("negation handling", () => {
  it("skips negated resources", () => {
    const design = "## Infrastructure\nWe will not use Redis. PostgreSQL is the datastore.";
    const components = extractInfraComponentsFromDesign(design);
    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components.find((c) => c.service === "redis")).toBeUndefined();
  });

  it("honors 'without' and 'avoid'", () => {
    const design = "## Infrastructure\nRuns without Kafka. Avoid Memcached. Uses PostgreSQL.";
    const components = extractInfraComponentsFromDesign(design);
    expect(components).toContainEqual({ module: "database", service: "postgres" });
  });
});

describe("detectUnsupportedResources", () => {
  it("reports recognized-but-unrenderable resources", () => {
    const design = "## Infrastructure\nUse an App Service, a VM, and Key Vault with PostgreSQL.";
    const unsupported = detectUnsupportedResources(design);
    expect(unsupported).toContain("app-service");
    expect(unsupported).toContain("virtual-machine");
    expect(unsupported).toContain("key-vault");
  });

  it("does not flag supported resources", () => {
    const design = "## Infrastructure\nJust PostgreSQL and Redis.";
    expect(detectUnsupportedResources(design)).toHaveLength(0);
  });
});

describe("extractInfraComponentsForCloud — collision folding", () => {
  it("keeps both compute options on azure/aws", () => {
    const design = "## Infrastructure\nContainer Apps plus Azure Functions.";
    const azure = extractInfraComponentsForCloud(design, "azure");
    expect(azure).toContainEqual({ module: "compute", service: "container" });
    expect(azure).toContainEqual({ module: "compute", service: "serverless" });
  });

  it("folds container+serverless to a single compute resource on gcp", () => {
    const design = "## Infrastructure\nCloud Run containers plus Cloud Functions.";
    const gcp = extractInfraComponentsForCloud(design, "gcp");
    expect(gcp).toContainEqual({ module: "compute", service: "container" });
    expect(gcp.find((c) => c.module === "compute" && c.service === "serverless")).toBeUndefined();
  });
});

describe("normalizeInfraComponent", () => {
  it("maps legacy aliases to canonical keys", () => {
    expect(normalizeInfraComponent({ module: "compute", service: "function" })).toEqual({
      module: "compute",
      service: "serverless",
    });
    expect(normalizeInfraComponent({ module: "database", service: "mongodb" })).toEqual({
      module: "database",
      service: "nosql",
    });
    expect(normalizeInfraComponent({ module: "storage", service: "objectstorage" })).toEqual({
      module: "storage",
      service: "object",
    });
    expect(normalizeInfraComponent({ module: "networking", service: "vnet" })).toEqual({
      module: "networking",
      service: "network",
    });
    expect(normalizeInfraComponent({ module: "security", service: "identity" })).toEqual({
      module: "identity",
      service: "identity",
    });
  });

  it("passes canonical components through unchanged", () => {
    const component: InfraComponent = { module: "database", service: "postgres" };
    expect(normalizeInfraComponent(component)).toEqual(component);
  });
});

describe("resolveIacResources — contract + design merge", () => {
  const contract: InfraComponent[] = [{ module: "database", service: "postgres" }];

  it("keeps the contract authoritative and appends design-only resources", () => {
    const design = "## Infrastructure\nPostgreSQL with Redis cache and object storage.";
    const resolved = resolveIacResources(contract, design, "azure");

    expect(resolved.contractResources).toEqual(contract);
    // postgres from contract is not duplicated by the design mention.
    expect(
      resolved.resolved.filter((c) => c.module === "database" && c.service === "postgres"),
    ).toHaveLength(1);
    expect(resolved.designResources).toContainEqual({ module: "cache", service: "redis" });
    expect(resolved.designResources).toContainEqual({ module: "storage", service: "object" });
    expect(resolved.designResources.find((c) => c.service === "postgres")).toBeUndefined();
  });

  it("produces different resolved sets for different designs (content-driven)", () => {
    const a = resolveIacResources(contract, "## Infrastructure\nRedis cache.", "azure");
    const b = resolveIacResources(contract, "## Infrastructure\nBlob storage.", "azure");
    expect(a.resolved).not.toEqual(b.resolved);
  });

  it("normalizes legacy contract aliases before merging", () => {
    const legacyContract: InfraComponent[] = [{ module: "database", service: "mongodb" }];
    const resolved = resolveIacResources(legacyContract, "## Infrastructure\nNo extras.", "azure");
    expect(resolved.resolved).toContainEqual({ module: "database", service: "nosql" });
  });

  it("reports unsupported resources without adding them", () => {
    const design = "## Infrastructure\nPostgreSQL plus a VM.";
    const resolved = resolveIacResources(contract, design, "azure");
    expect(resolved.unsupported).toContain("virtual-machine");
    expect(resolved.resolved.find((c) => c.service === "vm")).toBeUndefined();
  });

  it("folds gcp compute collision in the resolved set", () => {
    const gcpContract: InfraComponent[] = [{ module: "compute", service: "container" }];
    const design = "## Infrastructure\nAlso Cloud Functions.";
    const resolved = resolveIacResources(gcpContract, design, "gcp");
    expect(
      resolved.resolved.filter((c) => c.module === "compute"),
    ).toHaveLength(1);
  });
});
