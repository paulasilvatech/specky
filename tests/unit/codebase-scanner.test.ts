/**
 * codebase-scanner.test.ts — directory-tree scanning and manifest-based
 * tech-stack detection, exercised against real temp workspaces.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodebaseScanner } from "../../src/services/codebase-scanner.js";
import { FileManager } from "../../src/services/file-manager.js";

const workspaces: string[] = [];

function setup(): { workspace: string; scanner: CodebaseScanner } {
  const workspace = mkdtempSync(join(tmpdir(), "specky-codebase-scanner-"));
  workspaces.push(workspace);
  return { workspace, scanner: new CodebaseScanner(new FileManager(workspace)) };
}

afterEach(() => {
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe("CodebaseScanner.scan", () => {
  it("returns a sorted tree, node counts, and the detected tech stack", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({
        dependencies: { express: "^4.18.0" },
        devDependencies: { typescript: "^5.0.0" },
      }),
    );
    mkdirSync(join(workspace, "src", "lib"), { recursive: true });
    writeFileSync(join(workspace, "src", "index.ts"), "export {};\n");
    writeFileSync(join(workspace, "src", "lib", "util.ts"), "export {};\n");
    mkdirSync(join(workspace, "node_modules"));
    writeFileSync(join(workspace, "node_modules", "junk.js"), "x");

    const summary = await scanner.scan(5, ["node_modules"]);

    expect(summary.tree.type).toBe("directory");
    expect(summary.total_files).toBe(3); // package.json, index.ts, util.ts
    expect(summary.total_dirs).toBe(3); // root, src, src/lib
    expect(summary.tech_stack).toEqual({
      language: "TypeScript",
      framework: "Express",
      package_manager: "npm",
      runtime: "Node.js",
    });

    const rootChildren = summary.tree.children ?? [];
    // excluded directory is absent
    expect(rootChildren.some((c) => c.name === "node_modules")).toBe(false);
    // directories sort before files
    expect(rootChildren.map((c) => c.name)).toEqual(["src", "package.json"]);
    const srcNode = rootChildren[0];
    expect(srcNode?.type).toBe("directory");
    expect(srcNode?.children?.map((c) => c.name)).toEqual(["lib", "index.ts"]);
  });

  it("stops recursion at the requested depth", async () => {
    const { workspace, scanner } = setup();
    mkdirSync(join(workspace, "a", "b"), { recursive: true });
    writeFileSync(join(workspace, "a", "b", "deep.txt"), "x");

    const summary = await scanner.scan(1, []);

    const aNode = summary.tree.children?.find((c) => c.name === "a");
    expect(aNode?.type).toBe("directory");
    expect(aNode?.children).toBeUndefined();
    expect(summary.total_files).toBe(0);
    expect(summary.total_dirs).toBe(2); // root + a
  });

  it("skips dotfiles and dot-directories during the scan", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, ".hidden"), "x");
    mkdirSync(join(workspace, ".git"));
    writeFileSync(join(workspace, ".git", "config"), "x");
    writeFileSync(join(workspace, "visible.txt"), "x");

    const summary = await scanner.scan(3, []);

    expect(summary.total_files).toBe(1);
    expect(summary.total_dirs).toBe(1); // root only
    expect(summary.tree.children?.map((c) => c.name)).toEqual(["visible.txt"]);
  });
});

describe("CodebaseScanner.detectTechStack", () => {
  it("detects TypeScript and framework from package.json dependencies", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0", tsx: "^4.0.0" } }),
    );

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "TypeScript",
      framework: "React",
      package_manager: "npm",
      runtime: "Node.js",
    });
  });

  it("detects plain JavaScript when no TypeScript tooling is present", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({ dependencies: { fastify: "^4.0.0" } }),
    );

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("JavaScript");
    expect(stack.framework).toBe("Fastify");
    expect(stack.runtime).toBe("Node.js");
  });

  it("prefers next over react when both are dependencies", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({ dependencies: { next: "^14.0.0", react: "^18.0.0" } }),
    );

    const stack = await scanner.detectTechStack();

    expect(stack.framework).toBe("Next.js");
  });

  it("leaves framework undefined for dependency-free package.json", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "package.json"), JSON.stringify({ name: "bare" }));

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("JavaScript");
    expect(stack.framework).toBeUndefined();
    expect(stack.package_manager).toBe("npm");
  });

  it("falls back to JavaScript when package.json is invalid JSON", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "package.json"), "{ not valid json");

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "JavaScript",
      package_manager: "npm",
      runtime: "Node.js",
    });
  });

  it("gives package.json priority over later manifests", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "package.json"),
      JSON.stringify({ dependencies: { vue: "^3.0.0" } }),
    );
    writeFileSync(join(workspace, "go.mod"), "module example.com/x\n\ngo 1.21\n");

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("JavaScript");
    expect(stack.framework).toBe("Vue");
  });

  it("detects Django over Flask from requirements.txt ordering", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "requirements.txt"), "flask==2.3.0\ndjango==4.2\n");

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "Python",
      framework: "Django",
      package_manager: "pip",
      runtime: "Python",
    });
  });

  it("detects FastAPI and poetry from pyproject.toml", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "pyproject.toml"),
      '[tool.poetry]\nname = "api"\n\n[tool.poetry.dependencies]\nfastapi = "^0.100"\n',
    );

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "Python",
      framework: "FastAPI",
      package_manager: "poetry",
      runtime: "Python",
    });
  });

  it("defaults pyproject.toml without poetry to pip", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "pyproject.toml"),
      '[project]\nname = "api"\ndependencies = ["flask"]\n',
    );

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("Python");
    expect(stack.framework).toBe("Flask");
    expect(stack.package_manager).toBe("pip");
  });

  it("detects Flask from requirements.txt when Django is absent", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "requirements.txt"), "flask==2.3.0\ngunicorn==21.2\n");

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("Python");
    expect(stack.framework).toBe("Flask");
  });

  it("detects FastAPI from requirements.txt when Django and Flask are absent", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "requirements.txt"), "fastapi==0.110\nuvicorn==0.29\n");

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("Python");
    expect(stack.framework).toBe("FastAPI");
  });

  it("detects the Gin framework from go.mod", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "go.mod"),
      "module example.com/api\n\ngo 1.21\n\nrequire github.com/gin-gonic/gin v1.9.1\n",
    );

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "Go",
      framework: "Gin",
      package_manager: "go modules",
      runtime: "Go",
    });
  });

  it("detects Gorilla Mux from go.mod", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "go.mod"),
      "module example.com/api\n\ngo 1.21\n\nrequire github.com/gorilla/mux v1.8.0\n",
    );

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("Go");
    expect(stack.framework).toBe("Gorilla Mux");
  });

  it("detects the Echo framework from go.mod", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(
      join(workspace, "go.mod"),
      "module example.com/api\n\ngo 1.21\n\nrequire github.com/labstack/echo/v4 v4.11.0\n",
    );

    const stack = await scanner.detectTechStack();

    expect(stack.language).toBe("Go");
    expect(stack.framework).toBe("Echo");
  });

  it("detects Rust from Cargo.toml", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "Cargo.toml"), '[package]\nname = "cli"\n');

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "Rust",
      package_manager: "cargo",
      runtime: "Rust",
    });
  });

  it("detects Java with maven from pom.xml", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "pom.xml"), "<project></project>\n");

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "Java",
      package_manager: "maven",
      runtime: "JVM",
    });
  });

  it("detects Java with gradle from build.gradle", async () => {
    const { workspace, scanner } = setup();
    writeFileSync(join(workspace, "build.gradle"), "plugins { id 'java' }\n");

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "Java",
      package_manager: "gradle",
      runtime: "JVM",
    });
  });

  it("returns unknown for every field when no manifest exists", async () => {
    const { scanner } = setup();

    const stack = await scanner.detectTechStack();

    expect(stack).toEqual({
      language: "unknown",
      package_manager: "unknown",
      runtime: "unknown",
    });
  });
});
