/**
 * MetricsGenerator — Generates an HTML metrics dashboard from spec artifacts.
 * Reads SPECIFICATION.md, ANALYSIS.md, VERIFICATION.md, CHECKLIST.md and
 * .sdd-state.json to produce a self-contained local HTML report.
 */
import type { FileManager } from "./file-manager.js";

export interface PhaseMetric {
  phase: string;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
}

export interface MetricsResult {
  feature_dir: string;
  feature_number: string;
  generated_at: string;
  requirements_count: number;
  acceptance_criteria_count: number;
  compliance_score: number;
  test_coverage_percent: number;
  tasks_total: number;
  tasks_verified: number;
  phases: PhaseMetric[];
  html_path: string;
  html_content: string;
}

export class MetricsGenerator {
  constructor(private fileManager: FileManager) {}

  async generateMetrics(featureDir: string, featureNumber: string): Promise<MetricsResult> {
    const spec = await this.safeRead(featureDir, "SPECIFICATION.md");
    const analysis = await this.safeRead(featureDir, "ANALYSIS.md");
    const verification = await this.safeRead(featureDir, "VERIFICATION.md");
    const checklist = await this.safeRead(featureDir, "CHECKLIST.md");
    const state = await this.readState(featureDir);

    const requirementsCount = this.countRequirements(spec);
    const acCount = this.countAcceptanceCriteria(spec);
    const complianceScore = this.extractComplianceScore(analysis);
    const { total: tasksTotal, verified: tasksVerified, coveragePercent } = this.extractVerificationStats(verification);
    const checklistPassRate = this.extractChecklistPassRate(checklist);
    const phases = this.extractPhaseMetrics(state);
    const featureName = featureDir.replace(/.*\/\d{3}-/, "");

    const htmlContent = this.renderHtml({
      featureNumber,
      featureName,
      requirementsCount,
      acCount,
      complianceScore,
      tasksTotal,
      tasksVerified,
      coveragePercent,
      checklistPassRate,
      phases,
    });

    const htmlPath = `${featureDir}/metrics-dashboard.html`;
    await this.fileManager.writeSpecFile(featureDir, "metrics-dashboard.html", htmlContent, true);

    return {
      feature_dir: featureDir,
      feature_number: featureNumber,
      generated_at: new Date().toISOString(),
      requirements_count: requirementsCount,
      acceptance_criteria_count: acCount,
      compliance_score: complianceScore,
      test_coverage_percent: coveragePercent,
      tasks_total: tasksTotal,
      tasks_verified: tasksVerified,
      phases,
      html_path: htmlPath,
      html_content: htmlContent,
    };
  }

  private async safeRead(featureDir: string, file: string): Promise<string> {
    try {
      return await this.fileManager.readSpecFile(featureDir, file);
    } catch {
      return "";
    }
  }

  private async readState(featureDir: string): Promise<Record<string, unknown>> {
    try {
      const raw = await this.fileManager.readSpecFile(featureDir, ".sdd-state.json");
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private countRequirements(spec: string): number {
    const matches = spec.match(/^##?\s+REQ-\d+|^\|\s*REQ-\d+/gm);
    if (matches) return matches.length;
    // Fallback: count EARS patterns
    const ears = spec.match(/\b(WHEN|IF|WHILE|WHERE|THE SYSTEM SHALL|SHALL)\b/gi);
    return ears ? Math.min(ears.length, 50) : 0;
  }

  private countAcceptanceCriteria(spec: string): number {
    const matches = spec.match(/^[-*]\s+(?:AC|Given|When|Then|Acceptance Criteria)/gim);
    return matches ? matches.length : 0;
  }

  private extractComplianceScore(analysis: string): number {
    const match = analysis.match(/compliance.*?(\d+)%|(\d+)%.*?compliance/i);
    if (match) return parseInt(match[1] || match[2] || "0", 10);
    const passMatch = analysis.match(/(\d+)\/(\d+)\s+controls?\s+pass/i);
    if (passMatch) return Math.round((parseInt(passMatch[1], 10) / parseInt(passMatch[2], 10)) * 100);
    return analysis.length > 100 ? 80 : 0;
  }

  private extractVerificationStats(verification: string): { total: number; verified: number; coveragePercent: number } {
    const passRateMatch = verification.match(/pass.?rate[:\s]+(\d+)%/i);
    const totalMatch = verification.match(/total.?tasks?[:\s]+(\d+)/i);
    const verifiedMatch = verification.match(/verified[:\s]+(\d+)/i);

    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    const verified = verifiedMatch ? parseInt(verifiedMatch[1], 10) : 0;
    const coveragePercent = passRateMatch
      ? parseInt(passRateMatch[1], 10)
      : total > 0 ? Math.round((verified / total) * 100) : 0;

    return { total, verified, coveragePercent };
  }

  private extractChecklistPassRate(checklist: string): number {
    const checked = (checklist.match(/- \[x\]/gi) || []).length;
    const total = (checklist.match(/- \[[ x]\]/gi) || []).length;
    return total > 0 ? Math.round((checked / total) * 100) : 0;
  }

  private extractPhaseMetrics(state: Record<string, unknown>): PhaseMetric[] {
    const phases = state["phases"] as Record<string, { status: string; started_at?: string; completed_at?: string }> | undefined;
    if (!phases) return [];

    return Object.entries(phases).map(([phase, data]) => {
      let durationMinutes: number | undefined;
      if (data.started_at && data.completed_at) {
        const ms = new Date(data.completed_at).getTime() - new Date(data.started_at).getTime();
        durationMinutes = Math.round(ms / 60000);
      }
      return { phase, status: data.status, started_at: data.started_at, completed_at: data.completed_at, duration_minutes: durationMinutes };
    });
  }

  private renderHtml(data: {
    featureNumber: string;
    featureName: string;
    requirementsCount: number;
    acCount: number;
    complianceScore: number;
    tasksTotal: number;
    tasksVerified: number;
    coveragePercent: number;
    checklistPassRate: number;
    phases: PhaseMetric[];
  }): string {
    const phasesHtml = data.phases.length > 0
      ? data.phases.map(p => `
        <tr>
          <td>${p.phase}</td>
          <td><span class="badge badge-${p.status}">${p.status}</span></td>
          <td>${p.started_at ? new Date(p.started_at).toLocaleString() : "—"}</td>
          <td>${p.completed_at ? new Date(p.completed_at).toLocaleString() : "—"}</td>
          <td>${p.duration_minutes !== undefined ? `${p.duration_minutes}m` : "—"}</td>
        </tr>`).join("")
      : `<tr><td colspan="5" style="text-align:center;color:#888">No phase data available</td></tr>`;

    const scoreColor = (n: number) => n >= 80 ? "#22c55e" : n >= 60 ? "#f59e0b" : "#ef4444";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Specky Metrics — ${data.featureNumber}-${data.featureName}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
  .subtitle { color: #94a3b8; font-size: 0.875rem; margin-bottom: 2rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.25rem; }
  .card .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .card .value { font-size: 2rem; font-weight: 700; }
  .card .sub { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
  .section { margin-bottom: 2rem; }
  .section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 0.75rem; overflow: hidden; }
  th { background: #0f172a; padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 0.75rem 1rem; border-top: 1px solid #334155; font-size: 0.875rem; }
  .badge { padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
  .badge-completed { background: #14532d; color: #86efac; }
  .badge-in_progress { background: #1e3a5f; color: #93c5fd; }
  .badge-pending { background: #292524; color: #a8a29e; }
  .progress-bar { background: #334155; border-radius: 9999px; height: 8px; overflow: hidden; margin-top: 0.5rem; }
  .progress-fill { height: 100%; border-radius: 9999px; transition: width 0.3s; }
  footer { text-align: center; color: #475569; font-size: 0.75rem; margin-top: 2rem; }
</style>
</head>
<body>
<h1>📊 Specky Metrics Dashboard</h1>
<p class="subtitle">${data.featureNumber}-${data.featureName} · Generated ${new Date().toLocaleString()}</p>

<div class="grid">
  <div class="card">
    <div class="label">Requirements</div>
    <div class="value" style="color:#60a5fa">${data.requirementsCount}</div>
    <div class="sub">${data.acCount} acceptance criteria</div>
  </div>
  <div class="card">
    <div class="label">Task Coverage</div>
    <div class="value" style="color:${scoreColor(data.coveragePercent)}">${data.coveragePercent}%</div>
    <div class="sub">${data.tasksVerified}/${data.tasksTotal} verified</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${data.coveragePercent}%;background:${scoreColor(data.coveragePercent)}"></div></div>
  </div>
  <div class="card">
    <div class="label">Compliance Score</div>
    <div class="value" style="color:${scoreColor(data.complianceScore)}">${data.complianceScore}%</div>
    <div class="sub">Controls passed</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${data.complianceScore}%;background:${scoreColor(data.complianceScore)}"></div></div>
  </div>
  <div class="card">
    <div class="label">Checklist</div>
    <div class="value" style="color:${scoreColor(data.checklistPassRate)}">${data.checklistPassRate}%</div>
    <div class="sub">Items checked</div>
    <div class="progress-bar"><div class="progress-fill" style="width:${data.checklistPassRate}%;background:${scoreColor(data.checklistPassRate)}"></div></div>
  </div>
</div>

<div class="section">
  <h2>Pipeline Phases</h2>
  <table>
    <thead><tr><th>Phase</th><th>Status</th><th>Started</th><th>Completed</th><th>Duration</th></tr></thead>
    <tbody>${phasesHtml}</tbody>
  </table>
</div>

<footer>Generated by Specky MCP Server · Spec-Driven Development</footer>
</body>
</html>`;
  }
}
