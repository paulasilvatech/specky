/**
 * CodebaseScanner — Project structure and tech stack detection.
 */

import { PACKAGE_MANIFESTS, DEFAULT_SCAN_DEPTH, DEFAULT_EXCLUDE_PATTERNS } from "../constants.js";
import type { CodebaseSummary, TechStack, DirectoryTree } from "../types.js";
import type { FileManager } from "./file-manager.js";

export class CodebaseScanner {
  constructor(private fileManager: FileManager) {}

  /**
   * Full codebase scan: directory tree + tech stack detection.
   */
  async scan(
    depth: number = DEFAULT_SCAN_DEPTH,
    exclude: readonly string[] = DEFAULT_EXCLUDE_PATTERNS
  ): Promise<CodebaseSummary> {
    const tree = await this.fileManager.scanDirectory(".", depth, exclude);
    const techStack = await this.detectTechStack();
    const counts = this.countNodes(tree);

    return {
      tree,
      tech_stack: techStack,
      total_files: counts.files,
      total_dirs: counts.dirs,
    };
  }

  /**
   * Detect tech stack by reading package manifests.
   */
  async detectTechStack(): Promise<TechStack> {
    for (const manifest of PACKAGE_MANIFESTS) {
      try {
        const content = await this.fileManager.readProjectFile(manifest);
        const result = this.detectFromManifest(manifest, content);
        if (result) {
          return result;
        }
      } catch {
        // Manifest doesn't exist, try next
        continue;
      }
    }

    return {
      language: "unknown",
      package_manager: "unknown",
      runtime: "unknown",
    };
  }

  private detectFromManifest(manifestName: string, content: string): TechStack | null {
    switch (manifestName) {
      case "package.json":
        return this.detectFromPackageJson(content);
      case "requirements.txt":
        return this.detectFromRequirementsTxt(content);
      case "pyproject.toml":
        return this.detectFromPyprojectToml(content);
      case "go.mod":
        return this.detectFromGoMod(content);
      case "Cargo.toml":
        return {
          language: "Rust",
          package_manager: "cargo",
          runtime: "Rust",
        };
      case "pom.xml":
        return {
          language: "Java",
          package_manager: "maven",
          runtime: "JVM",
        };
      case "build.gradle":
        return {
          language: "Java",
          package_manager: "gradle",
          runtime: "JVM",
        };
      default:
        return null;
    }
  }

  private detectFromPackageJson(content: string): TechStack {
    try {
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const deps = {
        ...(pkg["dependencies"] as Record<string, string> | undefined),
        ...(pkg["devDependencies"] as Record<string, string> | undefined),
      };

      const hasTypeScript = "typescript" in deps || "ts-node" in deps || "tsx" in deps;
      const language = hasTypeScript ? "TypeScript" : "JavaScript";

      let framework: string | undefined;
      if ("next" in deps) framework = "Next.js";
      else if ("express" in deps) framework = "Express";
      else if ("fastify" in deps) framework = "Fastify";
      else if ("react" in deps) framework = "React";
      else if ("vue" in deps) framework = "Vue";
      else if ("@angular/core" in deps) framework = "Angular";
      else if ("svelte" in deps) framework = "Svelte";

      return {
        language,
        framework,
        package_manager: "npm",
        runtime: "Node.js",
      };
    } catch {
      return {
        language: "JavaScript",
        package_manager: "npm",
        runtime: "Node.js",
      };
    }
  }

  private detectFromRequirementsTxt(content: string): TechStack {
    let framework: string | undefined;
    const lower = content.toLowerCase();
    if (lower.includes("django")) framework = "Django";
    else if (lower.includes("flask")) framework = "Flask";
    else if (lower.includes("fastapi")) framework = "FastAPI";

    return {
      language: "Python",
      framework,
      package_manager: "pip",
      runtime: "Python",
    };
  }

  private detectFromPyprojectToml(content: string): TechStack {
    let framework: string | undefined;
    const lower = content.toLowerCase();
    if (lower.includes("django")) framework = "Django";
    else if (lower.includes("flask")) framework = "Flask";
    else if (lower.includes("fastapi")) framework = "FastAPI";

    const usesPoetry = lower.includes("[tool.poetry]");

    return {
      language: "Python",
      framework,
      package_manager: usesPoetry ? "poetry" : "pip",
      runtime: "Python",
    };
  }

  private detectFromGoMod(content: string): TechStack {
    let framework: string | undefined;
    if (content.includes("gin-gonic")) framework = "Gin";
    else if (content.includes("gorilla/mux")) framework = "Gorilla Mux";
    else if (content.includes("echo")) framework = "Echo";

    return {
      language: "Go",
      framework,
      package_manager: "go modules",
      runtime: "Go",
    };
  }

  private countNodes(tree: DirectoryTree): { files: number; dirs: number } {
    let files = 0;
    let dirs = 0;

    if (tree.type === "file") {
      files = 1;
    } else {
      dirs = 1;
      if (tree.children) {
        for (const child of tree.children) {
          const counts = this.countNodes(child);
          files += counts.files;
          dirs += counts.dirs;
        }
      }
    }

    return { files, dirs };
  }
}
