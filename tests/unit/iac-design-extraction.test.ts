/**
 * iac-design-extraction.test.ts — extractInfraComponentsFromDesign and cloud filtering.
 */
import { describe, expect, it } from "vitest";
import {
  extractInfraComponentsForCloud,
  extractInfraComponentsFromDesign,
} from "../../src/services/iac-generator.js";

describe("extractInfraComponentsFromDesign", () => {
  it("extracts database components", () => {
    const design = "The system uses PostgreSQL for persistence and Redis for caching.";
    const components = extractInfraComponentsFromDesign(design);

    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components).toContainEqual({ module: "cache", service: "redis" });
  });

  it("extracts compute components", () => {
    const design = "Deploy to Azure Container Apps with Kubernetes orchestration.";
    const components = extractInfraComponentsFromDesign(design);

    expect(components).toContainEqual({ module: "compute", service: "container" });
    expect(components).toContainEqual({ module: "compute", service: "kubernetes" });
  });

  it("extracts messaging components", () => {
    const design = "Use Kafka for event streaming and Service Bus for messaging.";
    const components = extractInfraComponentsFromDesign(design);

    expect(components).toContainEqual({ module: "messaging", service: "kafka" });
    expect(components).toContainEqual({ module: "messaging", service: "queue" });
  });

  it("extracts storage components", () => {
    const design = "Store files in S3 blob storage with CDN distribution.";
    const components = extractInfraComponentsFromDesign(design);

    expect(components).toContainEqual({ module: "storage", service: "objectstorage" });
    expect(components).toContainEqual({ module: "networking", service: "cdn" });
  });

  it("extracts security components", () => {
    const design = "Secrets in Key Vault with Azure AD authentication.";
    const components = extractInfraComponentsFromDesign(design);

    expect(components).toContainEqual({ module: "security", service: "keyvault" });
    expect(components).toContainEqual({ module: "security", service: "identity" });
  });

  it("deduplicates repeated components", () => {
    const design = "PostgreSQL database. Postgres is used for persistence.";
    const components = extractInfraComponentsFromDesign(design);

    const postgresCount = components.filter(
      (c) => c.module === "database" && c.service === "postgres",
    ).length;
    expect(postgresCount).toBe(1);
  });

  it("returns empty array for unrecognized content", () => {
    const design = "A simple application with no specific infrastructure.";
    const components = extractInfraComponentsFromDesign(design);

    expect(components).toHaveLength(0);
  });
});

describe("extractInfraComponentsForCloud", () => {
  it("filters for azure-compatible components", () => {
    const design = "PostgreSQL, Redis, RabbitMQ, and Memcached.";
    const components = extractInfraComponentsForCloud(design, "azure");

    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components).toContainEqual({ module: "cache", service: "redis" });
    // RabbitMQ and Memcached are not in azure mapping
    expect(components.find((c) => c.service === "rabbitmq")).toBeUndefined();
    expect(components.find((c) => c.service === "memcached")).toBeUndefined();
  });

  it("filters for aws-compatible components", () => {
    const design = "PostgreSQL, Redis, RabbitMQ, and Memcached.";
    const components = extractInfraComponentsForCloud(design, "aws");

    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components).toContainEqual({ module: "cache", service: "redis" });
    expect(components).toContainEqual({ module: "cache", service: "memcached" });
    expect(components).toContainEqual({ module: "messaging", service: "rabbitmq" });
  });

  it("filters for gcp-compatible components", () => {
    const design = "PostgreSQL, Redis, RabbitMQ, and Memcached.";
    const components = extractInfraComponentsForCloud(design, "gcp");

    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components).toContainEqual({ module: "cache", service: "redis" });
    expect(components).toContainEqual({ module: "cache", service: "memcached" });
    // RabbitMQ not in gcp mapping
    expect(components.find((c) => c.service === "rabbitmq")).toBeUndefined();
  });

  it("handles complex design documents", () => {
    const design = `
      ## Infrastructure
      The application uses Azure Container Apps for hosting.
      PostgreSQL Flexible Server for the database.
      Azure Cache for Redis for session storage.
      Azure Service Bus for messaging.
      Azure Blob Storage for file uploads.
      Azure Key Vault for secrets management.
      Azure Front Door for CDN and load balancing.
    `;

    const components = extractInfraComponentsForCloud(design, "azure");

    expect(components).toContainEqual({ module: "compute", service: "container" });
    expect(components).toContainEqual({ module: "database", service: "postgres" });
    expect(components).toContainEqual({ module: "cache", service: "redis" });
    expect(components).toContainEqual({ module: "messaging", service: "queue" });
    expect(components).toContainEqual({ module: "storage", service: "objectstorage" });
    expect(components).toContainEqual({ module: "security", service: "keyvault" });
    expect(components).toContainEqual({ module: "networking", service: "cdn" });
  });
});
