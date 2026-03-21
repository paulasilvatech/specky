/**
 * CrossAnalyzer — Cross-artifact consistency analysis.
 * Checks alignment between SPECIFICATION.md, DESIGN.md, and TASKS.md.
 */
import type { FileManager } from "./file-manager.js";
import type { CrossAnalysisResult, AlignmentCheck } from "../types.js";

export class CrossAnalyzer {
  constructor(private fileManager: FileManager) {}

  async analyze(featureDir: string): Promise<CrossAnalysisResult> {
    const specContent = await this.fileManager.readSpecFile(featureDir, "SPECIFICATION.md");
    const designContent = await this.safeRead(featureDir, "DESIGN.md");
    const tasksContent = await this.safeRead(featureDir, "TASKS.md");

    const reqIds = this.extractIds(specContent, /### (REQ-[A-Z]+-\d{3})/g);
    const designRefs = designContent ? this.extractAllRefs(designContent) : [];
    const taskRefs = tasksContent ? this.extractAllRefs(tasksContent) : [];

    const specDesign: AlignmentCheck[] = reqIds.map(id => {
      const found = designRefs.includes(id) || (designContent || "").includes(id);
      return { source_id: id, target_id: found ? id : "", status: found ? "aligned" as const : "missing" as const, detail: found ? `${id} referenced in DESIGN.md` : `${id} NOT found in DESIGN.md` };
    });

    const designTasks: AlignmentCheck[] = reqIds.map(id => {
      const found = taskRefs.includes(id) || (tasksContent || "").includes(id);
      return { source_id: id, target_id: found ? id : "", status: found ? "aligned" as const : "missing" as const, detail: found ? `${id} has implementing tasks` : `${id} has NO implementing tasks` };
    });

    const orphanedReqs = specDesign.filter(a => a.status === "missing").map(a => a.source_id);
    const orphanedTasks = this.extractTaskIds(tasksContent || "").filter(tid => {
      // A task is orphaned if it doesn't reference any REQ
      return !reqIds.some(rid => (tasksContent || "").includes(`${tid}`) && (tasksContent || "").includes(rid));
    });
    const missingDesigns = specDesign.filter(a => a.status === "missing").map(a => a.source_id);
    const totalChecks = specDesign.length + designTasks.length;
    const aligned = [...specDesign, ...designTasks].filter(a => a.status === "aligned").length;
    const score = totalChecks > 0 ? Math.round((aligned / totalChecks) * 100) : 0;

    return {
      spec_design_alignment: specDesign,
      design_tasks_alignment: designTasks,
      orphaned_requirements: orphanedReqs,
      orphaned_tasks: orphanedTasks.slice(0, 20),
      missing_designs: missingDesigns,
      consistency_score: score,
      explanation: `Cross-analysis complete. Consistency score: ${score}%. ${orphanedReqs.length} orphaned requirements, ${orphanedTasks.length} orphaned tasks.`,
      diagram: this.generateTraceabilityDiagram(reqIds, specDesign, designTasks),
    };
  }

  private extractIds(content: string, regex: RegExp): string[] {
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) ids.push(match[1]);
    return ids;
  }

  private extractAllRefs(content: string): string[] {
    return this.extractIds(content, /REQ-[A-Z]+-\d{3}/g);
  }

  private extractTaskIds(content: string): string[] {
    return this.extractIds(content, /T\d{3}/g);
  }

  private generateTraceabilityDiagram(reqIds: string[], specDesign: AlignmentCheck[], designTasks: AlignmentCheck[]): string {
    if (reqIds.length === 0) return "flowchart LR\n  A[No requirements found]";
    const lines = ["flowchart LR"];
    for (const req of reqIds.slice(0, 10)) {
      const inDesign = specDesign.find(a => a.source_id === req)?.status === "aligned";
      const inTasks = designTasks.find(a => a.source_id === req)?.status === "aligned";
      const designStyle = inDesign ? "" : ":::missing";
      const taskStyle = inTasks ? "" : ":::missing";
      lines.push(`  ${req} --> D_${req}[Design]${designStyle}`);
      lines.push(`  D_${req} --> T_${req}[Tasks]${taskStyle}`);
    }
    lines.push("  classDef missing fill:#f96,stroke:#333");
    return lines.join("\n");
  }

  private async safeRead(featureDir: string, fileName: string): Promise<string | null> {
    try { return await this.fileManager.readSpecFile(featureDir, fileName); } catch { return null; }
  }
}
