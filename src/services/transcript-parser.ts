/**
 * TranscriptParser — Parses VTT, SRT, TXT, and MD meeting transcripts.
 * Extracts speakers, topics, decisions, action items, and raw requirements.
 */

import type { FileManager } from "./file-manager.js";
import type {
  TranscriptSegment,
  TranscriptAnalysis,
  TranscriptTopic,
} from "../types.js";

/** Supported transcript formats */
type TranscriptFormat = "vtt" | "srt" | "txt" | "md";

/** Strip HTML tags iteratively until none remain (CodeQL-safe) */
function stripHtmlTags(input: string): string {
  let result = input;
  let prev = "";
  while (result !== prev) {
    prev = result;
    result = result.replace(/<[^<]*>/g, "");
  }
  return result;
}

export class TranscriptParser {
  constructor(private fileManager: FileManager) {}

  /**
   * Parse a transcript file and extract structured data.
   */
  async parseFile(filePath: string): Promise<TranscriptAnalysis> {
    const content = await this.fileManager.readProjectFile(filePath);
    const format = this.detectFormat(filePath, content);
    return this.parse(content, format, filePath);
  }

  /**
   * Parse raw transcript text.
   */
  parse(
    content: string,
    format: TranscriptFormat = "txt",
    _source: string = "inline"
  ): TranscriptAnalysis {
    let segments: TranscriptSegment[];

    switch (format) {
      case "vtt":
        segments = this.parseVTT(content);
        break;
      case "srt":
        segments = this.parseSRT(content);
        break;
      case "md":
        segments = this.parseMD(content);
        break;
      default:
        segments = this.parsePlainText(content);
    }

    // Extract structured data from segments
    const participants = this.extractParticipants(segments);
    const fullText = segments.map((s) => s.text).join(" ");
    const topics = this.extractTopics(segments);
    const decisions = this.extractDecisions(segments);
    const actionItems = this.extractActionItems(segments);
    const requirementsRaw = this.extractRequirements(segments);
    const constraints = this.extractConstraints(segments);
    const openQuestions = this.extractQuestions(segments);
    const duration = this.estimateDuration(segments);

    // Derive title: from meta tag, or first topic, or first segment
    const metaTitle = segments.find((s) => s.speaker === "__META_TITLE__");
    const title = metaTitle
      ? metaTitle.text
      : topics.length > 0
        ? topics[0].name
        : segments.length > 0
          ? segments[0].text.slice(0, 80)
          : "Meeting Transcript";

    return {
      title,
      participants,
      duration_estimate: duration,
      segments,
      topics,
      decisions,
      action_items: actionItems,
      requirements_raw: requirementsRaw,
      constraints_mentioned: constraints,
      open_questions: openQuestions,
      full_text: fullText,
    };
  }

  /**
   * Convert a TranscriptAnalysis into clean Markdown.
   */
  toMarkdown(analysis: TranscriptAnalysis): string {
    const lines: string[] = [
      `# Meeting Transcript: ${analysis.title}`,
      "",
      `**Participants:** ${analysis.participants.join(", ")}`,
      `**Duration:** ${analysis.duration_estimate}`,
      "",
    ];

    if (analysis.topics.length > 0) {
      lines.push("## Topics Discussed", "");
      for (const topic of analysis.topics) {
        lines.push(`### ${topic.name}`, "");
        lines.push(topic.summary, "");
        if (topic.key_points.length > 0) {
          lines.push("**Key Points:**");
          for (const point of topic.key_points) {
            lines.push(`- ${point}`);
          }
          lines.push("");
        }
      }
    }

    if (analysis.decisions.length > 0) {
      lines.push("## Decisions", "");
      for (const d of analysis.decisions) {
        lines.push(`- ${d}`);
      }
      lines.push("");
    }

    if (analysis.action_items.length > 0) {
      lines.push("## Action Items", "");
      for (const a of analysis.action_items) {
        lines.push(`- [ ] ${a}`);
      }
      lines.push("");
    }

    if (analysis.requirements_raw.length > 0) {
      lines.push("## Requirements Identified", "");
      for (const r of analysis.requirements_raw) {
        lines.push(`- ${r}`);
      }
      lines.push("");
    }

    if (analysis.constraints_mentioned.length > 0) {
      lines.push("## Constraints Mentioned", "");
      for (const c of analysis.constraints_mentioned) {
        lines.push(`- ${c}`);
      }
      lines.push("");
    }

    if (analysis.open_questions.length > 0) {
      lines.push("## Open Questions", "");
      for (const q of analysis.open_questions) {
        lines.push(`- ${q}`);
      }
      lines.push("");
    }

    lines.push("## Full Transcript", "");
    for (const seg of analysis.segments) {
      if (seg.speaker) {
        lines.push(`**${seg.speaker}:** ${seg.text}`, "");
      } else {
        lines.push(`${seg.text}`, "");
      }
    }

    return lines.join("\n");
  }

  // ─── Format Parsers ───

  private parseVTT(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    // Remove WEBVTT header and NOTE blocks
    const cleaned = content
      .replace(/^WEBVTT.*$/m, "")
      .replace(/^NOTE[\s\S]*?(?=\n\n)/gm, "")
      .trim();

    // VTT blocks: optional id, timestamp line, text lines
    const blocks = cleaned.split(/\n\n+/).filter((b) => b.trim());

    for (const block of blocks) {
      const lines = block.trim().split("\n");

      // Find timestamp line
      const tsLineIdx = lines.findIndex((l) =>
        /\d{2}:\d{2}[.:]\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}[.:]\d{2}\.\d{3}/.test(l)
      );
      if (tsLineIdx === -1) continue;

      const timestamp = lines[tsLineIdx].trim();
      const textLines = lines.slice(tsLineIdx + 1);
      const rawText = textLines.join(" ").trim();

      // Extract speaker from <v SpeakerName> tag or "SpeakerName:" prefix
      const vTagMatch = rawText.match(/^<v\s+([^>]+)>(.*?)(?:<\/v>)?$/s);
      const colonMatch = rawText.match(/^([A-Z][a-zA-ZÀ-ú\s.]+?):\s*(.+)$/s);

      let speaker = "";
      let text = rawText;

      if (vTagMatch) {
        speaker = vTagMatch[1].trim();
        text = vTagMatch[2].trim();
      } else if (colonMatch) {
        speaker = colonMatch[1].trim();
        text = colonMatch[2].trim();
      }

      // Clean HTML tags iteratively (CodeQL-safe)
      text = stripHtmlTags(text).trim();

      if (text) {
        segments.push({ speaker, text, timestamp });
      }
    }

    return segments;
  }

  private parseSRT(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const blocks = content.trim().split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.trim().split("\n");
      if (lines.length < 3) continue;

      // SRT: index, timestamp, text
      const timestamp = lines[1].trim();
      const rawText = lines.slice(2).join(" ").trim();

      const colonMatch = rawText.match(/^([A-Z][a-zA-ZÀ-ú\s.]+?):\s*(.+)$/s);
      let speaker = "";
      let text = rawText;

      if (colonMatch) {
        speaker = colonMatch[1].trim();
        text = colonMatch[2].trim();
      }

      text = stripHtmlTags(text).trim();
      if (text) {
        segments.push({ speaker, text, timestamp });
      }
    }

    return segments;
  }

  private parseMD(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const lines = content.split("\n");

    // Detect Copilot Studio / Power Automate agent format:
    // Has YAML frontmatter with type: "meeting-transcription"
    // OR has numbered sections like ## 1. Executive Summary, ## 4. Complete Transcription
    // OR has ## Executive Summary + ## Action Items
    const hasFrontmatter = /^---\s*\n[\s\S]*?\n---/m.test(content);
    const hasNumberedSections = /^##\s+\d+\.\s+(Executive Summary|Complete Transcription|Action Items)/im.test(content);
    const hasSimpleSections = /^##\s+(Executive Summary|Transcription|Action Items)/im.test(content);
    const isPowerAutomateFormat = hasFrontmatter || hasNumberedSections || hasSimpleSections;

    if (isPowerAutomateFormat) {
      return this.parsePowerAutomateMD(content);
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("---")) continue;

      // Markdown bold speaker: **Speaker:** text
      const boldMatch = trimmed.match(/^\*\*([^*]+?):?\*\*:?\s*(.+)$/);
      // Plain speaker: Speaker: text
      const plainMatch = trimmed.match(/^([A-Z][a-zA-ZÀ-ú\s.]+?):\s*(.+)$/);
      // Bullet points
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);

      if (boldMatch) {
        segments.push({ speaker: boldMatch[1].trim(), text: boldMatch[2].trim() });
      } else if (plainMatch) {
        segments.push({ speaker: plainMatch[1].trim(), text: plainMatch[2].trim() });
      } else if (bulletMatch) {
        segments.push({ speaker: "", text: bulletMatch[1].trim() });
      } else {
        segments.push({ speaker: "", text: trimmed });
      }
    }

    return segments;
  }

  /**
   * Parse Markdown generated by Copilot Studio / Power Automate transcription agent.
   *
   * Handles the full format with:
   * - YAML frontmatter (title, date, author, version, language, tags, etc.)
   * - Numbered sections: ## 1. Executive Summary, ## 2. Meeting Details,
   *   ## 3. Main Topics, ## 4. Complete Transcription, ## 5. Action Items
   * - Change Log table
   * - Meeting Details table
   * - File naming: {MeetingTitle}_v{version}_{YYYY-MM-DD}.md
   *
   * Also handles simpler formats without frontmatter or numbering.
   */
  private parsePowerAutomateMD(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];

    // ── Step 1: Extract YAML frontmatter ──
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/m);
    if (frontmatterMatch) {
      const yaml = frontmatterMatch[1];
      const yamlFields = this.parseSimpleYaml(yaml);

      if (yamlFields["title"]) {
        segments.push({ speaker: "__META_TITLE__", text: yamlFields["title"] });
      }
      if (yamlFields["date"]) {
        segments.push({ speaker: "__META_DATE__", text: yamlFields["date"] });
      }
      if (yamlFields["language"]) {
        segments.push({ speaker: "__META_LANGUAGE__", text: yamlFields["language"] });
      }
      if (yamlFields["author"]) {
        segments.push({ speaker: "__META_AUTHOR__", text: yamlFields["author"] });
      }
      if (yamlFields["version"]) {
        segments.push({ speaker: "__META_VERSION__", text: yamlFields["version"] });
      }
      if (yamlFields["description"]) {
        segments.push({ speaker: "__META_DESCRIPTION__", text: yamlFields["description"] });
      }
      if (yamlFields["tags"]) {
        segments.push({ speaker: "__META_TAGS__", text: yamlFields["tags"] });
      }
    }

    // ── Step 2: Parse sections ──
    // Remove frontmatter from content for section parsing
    const body = frontmatterMatch
      ? content.slice(frontmatterMatch[0].length).trim()
      : content.trim();

    const lines = body.split("\n");
    let currentSection = "pre";
    let h1Title = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === "---") continue;

      // H1 — meeting title
      const h1Match = trimmed.match(/^#\s+(.+)$/);
      if (h1Match) {
        h1Title = h1Match[1].trim();
        // If no title from frontmatter, use H1
        if (!segments.some((s) => s.speaker === "__META_TITLE__")) {
          segments.push({ speaker: "__META_TITLE__", text: h1Title });
        }
        continue;
      }

      // > blockquote — meeting purpose statement
      if (trimmed.startsWith("> ") && currentSection === "pre") {
        segments.push({ speaker: "__SUMMARY__", text: trimmed.slice(2).trim() });
        continue;
      }

      // H2 sections — detect by name (with or without numbering)
      const h2Match = trimmed.match(/^##\s+(?:\d+\.\s*)?(.+)$/);
      if (h2Match) {
        const sectionName = h2Match[1].toLowerCase().trim();

        if (sectionName.includes("executive summary") || sectionName.includes("resumo")) {
          currentSection = "summary";
        } else if (sectionName.includes("meeting details") || sectionName.includes("detalhes")) {
          currentSection = "details";
        } else if (sectionName.includes("main topics") || sectionName.includes("tópicos") || sectionName.includes("topicos")) {
          currentSection = "topics";
        } else if (sectionName.includes("complete transcription") || sectionName.includes("transcription") || sectionName.includes("transcript") || sectionName.includes("transcrição")) {
          currentSection = "transcription";
        } else if (sectionName.includes("action item") || sectionName.includes("ações") || sectionName.includes("acoes")) {
          currentSection = "actions";
        } else if (sectionName.includes("reference") || sectionName.includes("referência")) {
          currentSection = "references";
        } else if (sectionName.includes("change log") || sectionName.includes("changelog")) {
          currentSection = "changelog";
        } else if (sectionName.includes("table of contents") || sectionName.includes("índice")) {
          currentSection = "toc";
        } else {
          currentSection = sectionName;
        }
        continue;
      }

      // H3 subsections
      if (trimmed.startsWith("### ")) continue;

      // Skip table of contents and changelog
      if (currentSection === "toc" || currentSection === "changelog") continue;

      // ── Section-specific parsing ──

      // Executive Summary — bullet points and paragraphs
      if (currentSection === "summary") {
        const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
        if (bulletMatch) {
          segments.push({ speaker: "__SUMMARY__", text: bulletMatch[1].trim() });
        } else if (trimmed.length > 5 && !trimmed.startsWith("|")) {
          segments.push({ speaker: "__SUMMARY__", text: trimmed });
        }
        continue;
      }

      // Meeting Details — parse table rows for participants
      if (currentSection === "details") {
        // Table row: | Key | Value |
        const tableRowMatch = trimmed.match(/^\|\s*\*?\*?([^|*]+)\*?\*?\s*\|\s*([^|]+)\s*\|/);
        if (tableRowMatch) {
          const key = tableRowMatch[1].toLowerCase().trim();
          const value = tableRowMatch[2].trim();

          if (key.includes("participant") || key.includes("attendee") || key.includes("participante")) {
            segments.push({ speaker: "__META_PARTICIPANTS__", text: value });
          } else if (key.includes("date") || key.includes("data") || key.includes("fecha")) {
            if (!segments.some((s) => s.speaker === "__META_DATE__")) {
              segments.push({ speaker: "__META_DATE__", text: value });
            }
          } else if (key.includes("organizer") || key.includes("organizador")) {
            // Organizer is also a participant
            const existing = segments.find((s) => s.speaker === "__META_PARTICIPANTS__");
            if (existing) {
              existing.text = `${value}, ${existing.text}`;
            } else {
              segments.push({ speaker: "__META_PARTICIPANTS__", text: value });
            }
          }
        }
        // Also handle **Key:** Value format in details section
        const boldMeta = trimmed.match(/^\*\*([^*]+?):?\*\*:?\s*(.+)$/);
        if (boldMeta) {
          const key = boldMeta[1].toLowerCase().trim();
          const value = boldMeta[2].trim();
          if (key.includes("participant") || key.includes("participante")) {
            segments.push({ speaker: "__META_PARTICIPANTS__", text: value });
          }
        }
        continue;
      }

      // Main Topics — numbered or bulleted list
      if (currentSection === "topics") {
        const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
        const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
        if (bulletMatch) {
          segments.push({ speaker: "__TOPIC__", text: bulletMatch[1].trim() });
        } else if (numberedMatch) {
          segments.push({ speaker: "__TOPIC__", text: numberedMatch[1].trim() });
        } else if (trimmed.length > 5) {
          segments.push({ speaker: "__TOPIC__", text: trimmed });
        }
        continue;
      }

      // Complete Transcription — speaker-attributed text
      if (currentSection === "transcription") {
        // **Speaker Name:** text (bold speaker — colon may be inside or outside **)
        const boldSpeaker = trimmed.match(/^\*\*([^*]+?):?\*\*:?\s*(.+)$/);
        // Speaker Name: text (plain)
        const plainSpeaker = trimmed.match(/^([A-Z][a-zA-ZÀ-ú\s.]+?):\s*(.+)$/);
        // [HH:MM:SS] **Speaker:** text (with timestamp)
        const timestampSpeaker = trimmed.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*\*?\*?([^*:]+)\*?\*?:?\s*(.+)$/);

        if (timestampSpeaker) {
          segments.push({
            speaker: timestampSpeaker[2].trim(),
            text: timestampSpeaker[3].trim(),
            timestamp: timestampSpeaker[1],
          });
        } else if (boldSpeaker) {
          segments.push({ speaker: boldSpeaker[1].trim(), text: boldSpeaker[2].trim() });
        } else if (plainSpeaker) {
          segments.push({ speaker: plainSpeaker[1].trim(), text: plainSpeaker[2].trim() });
        } else if (trimmed.length > 5) {
          segments.push({ speaker: "", text: trimmed });
        }
        continue;
      }

      // Action Items
      if (currentSection === "actions") {
        // - [ ] Owner: task description
        // - [ ] task description
        // - task description
        const checkboxMatch = trimmed.match(/^[-*]\s+\[.\]\s*(.+)$/);
        const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
        const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);

        if (checkboxMatch) {
          segments.push({ speaker: "__ACTION__", text: checkboxMatch[1].trim() });
        } else if (bulletMatch) {
          segments.push({ speaker: "__ACTION__", text: bulletMatch[1].trim() });
        } else if (numberedMatch) {
          segments.push({ speaker: "__ACTION__", text: numberedMatch[1].trim() });
        }
        continue;
      }

      // References section
      if (currentSection === "references") {
        if (trimmed.length > 5 && !trimmed.startsWith("|")) {
          segments.push({ speaker: "__REFERENCE__", text: trimmed });
        }
        continue;
      }

      // Pre-section content (between H1 and first H2)
      if (currentSection === "pre") {
        const boldMeta = trimmed.match(/^\*\*([^*]+?):?\*\*:?\s*(.+)$/);
        if (boldMeta) {
          const key = boldMeta[1].toLowerCase().trim();
          const value = boldMeta[2].trim();
          if (key.includes("date") || key.includes("data")) {
            segments.push({ speaker: "__META_DATE__", text: value });
          } else if (key.includes("participant") || key.includes("participante")) {
            segments.push({ speaker: "__META_PARTICIPANTS__", text: value });
          }
        }
        continue;
      }

      // Any other section — include as general content
      const boldMatch = trimmed.match(/^\*\*([^*]+?):?\*\*:?\s*(.+)$/);
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);

      if (boldMatch) {
        segments.push({ speaker: boldMatch[1].trim(), text: boldMatch[2].trim() });
      } else if (bulletMatch) {
        segments.push({ speaker: "", text: bulletMatch[1].trim() });
      } else if (trimmed.length > 5) {
        segments.push({ speaker: "", text: trimmed });
      }
    }

    return segments;
  }

  /**
   * Simple YAML frontmatter parser — extracts key: "value" pairs.
   * Handles quoted strings, arrays (as comma-separated), and bare values.
   */
  private parseSimpleYaml(yaml: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const lines = yaml.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // key: "value" or key: value or key: [array]
      const match = trimmed.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes
        value = value.replace(/^["']|["']$/g, "");

        // Handle YAML arrays: ["a", "b"] → "a, b"
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value
            .slice(1, -1)
            .split(",")
            .map((v) => v.trim().replace(/^["']|["']$/g, ""))
            .join(", ");
        }

        fields[key] = value;
      }
    }

    return fields;
  }

  private parsePlainText(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const colonMatch = trimmed.match(/^([A-Z][a-zA-ZÀ-ú\s.]+?):\s*(.+)$/);

      if (colonMatch) {
        segments.push({ speaker: colonMatch[1].trim(), text: colonMatch[2].trim() });
      } else {
        segments.push({ speaker: "", text: trimmed });
      }
    }

    return segments;
  }

  // ─── Extraction Methods ───

  private extractParticipants(segments: TranscriptSegment[]): string[] {
    const speakers = new Set<string>();

    for (const seg of segments) {
      // Power Automate metadata: __META_PARTICIPANTS__ contains comma-separated names
      if (seg.speaker === "__META_PARTICIPANTS__") {
        for (const name of seg.text.split(/[,;]+/)) {
          const trimmed = name.trim();
          if (trimmed) speakers.add(trimmed);
        }
        continue;
      }

      // Regular speakers (skip meta markers, strip trailing colon)
      if (seg.speaker && !seg.speaker.startsWith("__")) {
        speakers.add(seg.speaker.replace(/:$/, "").trim());
      }
    }
    return [...speakers].sort();
  }

  /** Filter out internal meta segments used for Power Automate format parsing */
  private contentSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
    return segments.filter((s) => !s.speaker?.startsWith("__"));
  }

  private extractTopics(segments: TranscriptSegment[]): TranscriptTopic[] {
    const topics: TranscriptTopic[] = [];
    const topicKeywords = new Map<string, TranscriptSegment[]>();
    const realSegments = this.contentSegments(segments);

    // If explicit topics were parsed from "Main Topics" section, use those first
    const explicitTopics = segments.filter((s) => s.speaker === "__TOPIC__");
    if (explicitTopics.length > 0) {
      for (const topic of explicitTopics) {
        topics.push({
          name: topic.text.slice(0, 80),
          summary: topic.text,
          speakers: [],
          key_points: [topic.text],
        });
      }
      // Still scan content segments for additional detail per topic
      return topics;
    }

    // Include executive summary as context for topic extraction
    const summarySegments = segments.filter((s) => s.speaker === "__SUMMARY__");
    if (summarySegments.length > 0) {
      for (const summary of summarySegments) {
        realSegments.unshift({ speaker: "", text: summary.text });
      }
    }

    // Group segments into topic clusters based on content similarity
    let currentTopic = "General Discussion";
    let currentSegments: TranscriptSegment[] = [];

    for (const seg of realSegments) {

      // Detect topic transitions
      const topicSignals = [
        { pattern: /\b(login|auth|authentica|sso|oauth|azure ad|entra)\b/i, topic: "Authentication & Authorization" },
        { pattern: /\b(api|endpoint|rest|graphql|grpc|webhook)\b/i, topic: "API Design" },
        { pattern: /\b(database|db|sql|postgres|mongo|cosmos|storage)\b/i, topic: "Data Storage" },
        { pattern: /\b(deploy|ci\/cd|pipeline|github actions|azure devops|kubernetes|docker|container)\b/i, topic: "Deployment & Infrastructure" },
        { pattern: /\b(security|encrypt|ssl|tls|compliance|gdpr|lgpd|hipaa)\b/i, topic: "Security & Compliance" },
        { pattern: /\b(performance|latenc|speed|cache|redis|cdn|scale|concurrent)\b/i, topic: "Performance & Scalability" },
        { pattern: /\b(ui|ux|frontend|react|angular|vue|design|layout|component)\b/i, topic: "User Interface" },
        { pattern: /\b(test|testing|unit test|integration|e2e|qa|quality)\b/i, topic: "Testing & Quality" },
        { pattern: /\b(monitor|observ|log|metric|alert|grafana|datadog|app insights)\b/i, topic: "Monitoring & Observability" },
        { pattern: /\b(user|persona|stakeholder|customer|role|permission)\b/i, topic: "Users & Personas" },
        { pattern: /\b(budget|cost|pricing|timeline|deadline|sprint|milestone)\b/i, topic: "Project Constraints" },
        { pattern: /\b(integration|third.party|external|partner|vendor)\b/i, topic: "Integrations" },
        { pattern: /\b(notification|email|sms|push|alert|message)\b/i, topic: "Notifications" },
        { pattern: /\b(report|dashboard|analytics|chart|graph|insight)\b/i, topic: "Reporting & Analytics" },
      ];

      for (const signal of topicSignals) {
        if (signal.pattern.test(seg.text)) {
          if (signal.topic !== currentTopic) {
            if (currentSegments.length > 0) {
              topicKeywords.set(currentTopic, [...currentSegments]);
            }
            currentTopic = signal.topic;
            currentSegments = [];
          }
          break;
        }
      }

      currentSegments.push(seg);
    }

    if (currentSegments.length > 0) {
      topicKeywords.set(currentTopic, [...currentSegments]);
    }

    // Build topic objects
    for (const [name, segs] of topicKeywords) {
      const speakers = [...new Set(segs.filter((s) => s.speaker).map((s) => s.speaker))];
      const keyPoints = segs
        .map((s) => s.text)
        .filter((t) => t.length > 20)
        .slice(0, 5);

      topics.push({
        name,
        summary: keyPoints.slice(0, 2).join(" ").slice(0, 300),
        speakers,
        key_points: keyPoints,
      });
    }

    return topics;
  }

  private extractDecisions(segments: TranscriptSegment[]): string[] {
    this.contentSegments(segments);
    const decisions: string[] = [];
    const decisionPatterns = [
      /\b(decid|decided|decision|let's go with|we'll use|vamos com|decidimos|ficou decidido|a decisão é|definimos que)\b/i,
      /\b(agreed|agreement|consensus|concordamos|aprovado|approved)\b/i,
      /\b(will be|vai ser|será|chosen|escolhido|selected|selecionado)\b/i,
    ];

    for (const seg of segments) {
      for (const pattern of decisionPatterns) {
        if (pattern.test(seg.text)) {
          const clean = seg.speaker
            ? `[${seg.speaker}] ${seg.text}`
            : seg.text;
          decisions.push(clean);
          break;
        }
      }
    }

    return [...new Set(decisions)];
  }

  private extractActionItems(segments: TranscriptSegment[]): string[] {
    const actions: string[] = [];

    // First: collect explicit action items from Power Automate format
    for (const seg of segments) {
      if (seg.speaker === "__ACTION__") {
        actions.push(seg.text);
      }
    }

    // Then: detect action items from regular speech
    const actionPatterns = [
      /\b(action item|todo|to.do|task|precisa|needs? to|should|must|vai fazer|tem que|have to|assigned to)\b/i,
      /\b(follow.up|next step|próximo passo|ação|responsável|owner)\b/i,
      /\b(deadline|prazo|until|até|by (monday|tuesday|wednesday|thursday|friday|next week))\b/i,
    ];

    for (const seg of segments) {
      if (seg.speaker?.startsWith("__")) continue; // Skip meta segments

      for (const pattern of actionPatterns) {
        if (pattern.test(seg.text)) {
          const clean = seg.speaker
            ? `[${seg.speaker}] ${seg.text}`
            : seg.text;
          actions.push(clean);
          break;
        }
      }
    }

    return [...new Set(actions)];
  }

  private extractRequirements(segments: TranscriptSegment[]): string[] {
    const reqs: string[] = [];
    const reqPatterns = [
      /\b(must|should|shall|needs? to|has to|required|requirement|precisa|deve|necessário|obrigatório)\b/i,
      /\b(the system|the app|the platform|the server|the api|o sistema|a aplicação|a plataforma)\b/i,
      /\b(feature|functionality|capability|funcionalidade|recurso|capacidade)\b/i,
      /\b(support|suportar|handle|tratar|manage|gerenciar|enable|habilitar|allow|permitir)\b/i,
    ];

    for (const seg of this.contentSegments(segments)) {
      let matchCount = 0;
      for (const pattern of reqPatterns) {
        if (pattern.test(seg.text)) {
          matchCount++;
        }
      }
      // Require at least 1 pattern match and minimum text length
      if (matchCount >= 1 && seg.text.length > 15) {
        reqs.push(seg.text);
      }
    }

    return [...new Set(reqs)];
  }

  private extractConstraints(segments: TranscriptSegment[]): string[] {
    const constraints: string[] = [];
    const constraintPatterns = [
      /\b(constraint|limitation|restrict|budget|timeline|deadline|cannot|can't|won't|não pode|restrição|limitação|prazo|orçamento)\b/i,
      /\b(must use|has to be|needs to be|only|mandator|obrigatório|somente|apenas)\b/i,
      /\b(compliance|regulation|policy|lei|regulamento|norma|lgpd|gdpr|hipaa|sox|pci)\b/i,
    ];

    for (const seg of this.contentSegments(segments)) {
      for (const pattern of constraintPatterns) {
        if (pattern.test(seg.text) && seg.text.length > 15) {
          constraints.push(seg.text);
          break;
        }
      }
    }

    return [...new Set(constraints)];
  }

  private extractQuestions(segments: TranscriptSegment[]): string[] {
    const questions: string[] = [];

    for (const seg of this.contentSegments(segments)) {
      // Detect questions by "?" or question-word patterns
      if (
        seg.text.includes("?") ||
        /^(how|what|when|where|why|who|which|como|qual|quando|onde|por que|quem)\b/i.test(seg.text)
      ) {
        const clean = seg.speaker
          ? `[${seg.speaker}] ${seg.text}`
          : seg.text;
        questions.push(clean);
      }
    }

    return [...new Set(questions)].slice(0, 15);
  }

  private estimateDuration(segments: TranscriptSegment[]): string {
    // Try to calculate from timestamps
    if (segments.length >= 2) {
      const first = segments[0].timestamp;
      const last = segments[segments.length - 1].timestamp;
      if (first && last) {
        const start = this.parseTimestamp(first);
        const end = this.parseTimestamp(last);
        if (start !== null && end !== null) {
          const diffSec = end - start;
          const mins = Math.round(diffSec / 60);
          if (mins > 0) {
            return `~${mins} minutes`;
          }
        }
      }
    }

    // Estimate from text volume (~150 words per minute speaking)
    const totalWords = segments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
    const estimatedMins = Math.max(1, Math.round(totalWords / 150));
    return `~${estimatedMins} minutes (estimated from text volume)`;
  }

  private parseTimestamp(ts: string): number | null {
    // Handles "HH:MM:SS.mmm" or "MM:SS.mmm" or "HH:MM:SS.mmm --> ..."
    const clean = ts.split("-->")[0].trim();
    const parts = clean.split(/[:.]/);
    if (parts.length >= 3) {
      if (parts.length === 4) {
        // HH:MM:SS.mmm
        return (
          parseInt(parts[0], 10) * 3600 +
          parseInt(parts[1], 10) * 60 +
          parseInt(parts[2], 10)
        );
      }
      // MM:SS.mmm
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return null;
  }

  private detectFormat(filePath: string, content: string): TranscriptFormat {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".vtt")) return "vtt";
    if (lower.endsWith(".srt")) return "srt";
    if (lower.endsWith(".md")) return "md";

    // Auto-detect from content
    if (content.trimStart().startsWith("WEBVTT")) return "vtt";
    if (/^\d+\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/m.test(content)) return "srt";

    return "txt";
  }
}
