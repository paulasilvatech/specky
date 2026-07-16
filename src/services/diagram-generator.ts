/**
 * DiagramGenerator retains only explicit user-story flow assembly.
 * Architecture diagrams are validated from caller-provided Mermaid/FigJam
 * payloads by visualization tools and are never synthesized from prose.
 */
export class DiagramGenerator {
    generateUserStoryFlow(storyTitle: string, steps: string[]): string {
        if (steps.length === 0) {
            throw new Error(`User story "${storyTitle}" requires at least one explicit flow step.`);
        }
        const nodes = steps.map((step, index) => {
            const id = `S${index + 1}`;
            const label = this.escapeLabel(step);
            return `  ${id}["${label}"]`;
        });
        const edges = steps.slice(1).map((_, index) => `  S${index + 1} --> S${index + 2}`);
        return ["flowchart TD", ...nodes, ...edges].join("\n");
    }

    private escapeLabel(value: string): string {
        return value
            .replaceAll("\\", "\\\\")
            .replaceAll('"', "'")
            .replaceAll("\r", " ")
            .replaceAll("\n", " ")
            .trim();
    }
}
