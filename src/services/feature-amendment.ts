import type { ResolvedUseCaseContract } from "../contracts/use-case.js";
import type { FeatureContext } from "../types.js";
import type { FileManager } from "./file-manager.js";
import type { IntentDriftEngine } from "./intent-drift-engine.js";
import type { StateMachine } from "./state-machine.js";
import {
  prepareTddContractAmendment,
  type TddAmendment,
  type TddAmendmentResult,
} from "./tdd-contract-amendment.js";

export interface FeatureAmendmentInput {
  rationale: string;
  articlesAffected: string[];
  changesDescription: string;
  force: boolean;
  tddAmendment?: TddAmendment;
}

export interface FeatureAmendmentResult {
  status: "amendment_added";
  amendment_number: number;
  rationale: string;
  articles_affected: string[];
  changes_description: string;
  tdd_amendment?: TddAmendmentResult;
  drift_amendment_suggestion?: Record<string, unknown>;
}

interface AmendmentRecord {
  number: number;
  date: string;
  updatedConstitution: string;
}

async function readSpecOrEmpty(
  fileManager: FileManager,
  featureDirectory: string,
  fileName: string,
): Promise<string> {
  try {
    return await fileManager.readSpecFile(featureDirectory, fileName);
  } catch {
    return "";
  }
}

async function readRequiredConstitution(
  fileManager: FileManager,
  featureDirectory: string,
): Promise<string> {
  const constitution = await readSpecOrEmpty(fileManager, featureDirectory, "CONSTITUTION.md");
  if (!constitution) {
    throw new Error(
      `CONSTITUTION.md not found in ${featureDirectory}.\n→ Fix: Run sdd_init first.`,
    );
  }
  return constitution;
}

function renderAmendment(
  constitution: string,
  rationale: string,
  articlesAffected: string[],
): AmendmentRecord {
  const number = (constitution.match(/^\| \d+ \|/gm) ?? []).length + 1;
  const date = new Date().toISOString().split("T")[0];
  const row = `| ${number} | ${date} | SDD Pipeline | ${rationale} | ${articlesAffected.join(", ")} |`;
  const marker = "| — | — | — | Initial version | All |";
  let updatedConstitution = constitution.includes(marker)
    ? constitution.replace(marker, `${marker}\n${row}`)
    : `${constitution}\n${row}\n`;
  const countPattern = /amendment_count:\s*(\d+)/;
  updatedConstitution = countPattern.test(updatedConstitution)
    ? updatedConstitution.replace(countPattern, `amendment_count: ${number}`)
    : updatedConstitution.replace(/^(---\n)/m, `---\namendment_count: ${number}\n`);
  return { number, date, updatedConstitution };
}

async function persistAmendment(
  fileManager: FileManager,
  stateMachine: StateMachine,
  context: FeatureContext,
  originalConstitution: string,
  record: AmendmentRecord,
  contract: ResolvedUseCaseContract,
  input: FeatureAmendmentInput,
): Promise<void> {
  await fileManager.writeSpecFile(
    context.feature.directory,
    "CONSTITUTION.md",
    record.updatedConstitution,
    input.force,
  );
  try {
    context.state.contract = contract;
    context.state.amendments.push({
      number: record.number,
      date: record.date,
      author: "SDD Pipeline",
      rationale: input.rationale,
      articles_affected: input.articlesAffected,
    });
    await stateMachine.saveState(context.stateDir, context.state);
  } catch (error) {
    await fileManager.writeSpecFile(
      context.feature.directory,
      "CONSTITUTION.md",
      originalConstitution,
      true,
    );
    throw error;
  }
}

async function driftSuggestion(
  fileManager: FileManager,
  stateMachine: StateMachine,
  intentDriftEngine: IntentDriftEngine | undefined,
  context: FeatureContext,
  constitution: string,
): Promise<Record<string, unknown> | undefined> {
  if (!intentDriftEngine) return undefined;
  try {
    const freshState = await stateMachine.loadState(context.stateDir);
    const lastSnapshot = (freshState.drift_history ?? []).at(-1);
    if (!lastSnapshot || lastSnapshot.score <= 40) return undefined;
    const principles = intentDriftEngine.extractPrinciples(constitution);
    const [specContent, tasksContent] = await Promise.all([
      readSpecOrEmpty(fileManager, context.feature.directory, "SPECIFICATION.md"),
      readSpecOrEmpty(fileManager, context.feature.directory, "TASKS.md"),
    ]);
    const report = intentDriftEngine.computeCoverage(principles, specContent, tasksContent);
    return {
      current_drift_score: lastSnapshot.score,
      drift_label: report.intent_drift_label,
      orphaned_principles: report.orphaned_principles.map((principle) => principle.heading),
      recommended_actions: report.orphaned_principles.map(
        (principle) => `Add requirement referencing "${principle.heading}" to SPECIFICATION.md`,
      ),
      note: "High intent drift detected. Consider adding requirements that address orphaned constitutional principles.",
    };
  } catch {
    return undefined;
  }
}

export async function amendFeature(
  fileManager: FileManager,
  stateMachine: StateMachine,
  intentDriftEngine: IntentDriftEngine | undefined,
  context: FeatureContext,
  input: FeatureAmendmentInput,
): Promise<FeatureAmendmentResult> {
  return stateMachine.withStateLock(context.stateDir, async () => {
    const state = await stateMachine.loadState(context.stateDir);
    if (
      state.contract.fingerprint !== context.state.contract.fingerprint ||
      state.amendments.length !== context.state.amendments.length
    ) {
      throw new Error("Feature contract changed concurrently; reload state and retry amendment.");
    }
    const lockedContext: FeatureContext = { ...context, state };
    const constitution = await readRequiredConstitution(fileManager, context.feature.directory);
    const preparedTdd = input.tddAmendment
      ? await prepareTddContractAmendment(fileManager, lockedContext, input.tddAmendment)
      : undefined;
    const record = renderAmendment(constitution, input.rationale, input.articlesAffected);
    await persistAmendment(
      fileManager,
      stateMachine,
      lockedContext,
      constitution,
      record,
      preparedTdd?.contract ?? state.contract,
      input,
    );
    const suggestion = await driftSuggestion(
      fileManager,
      stateMachine,
      intentDriftEngine,
      lockedContext,
      constitution,
    );
    return {
      status: "amendment_added",
      amendment_number: record.number,
      rationale: input.rationale,
      articles_affected: input.articlesAffected,
      changes_description: input.changesDescription,
      ...(preparedTdd ? { tdd_amendment: preparedTdd.result } : {}),
      ...(suggestion ? { drift_amendment_suggestion: suggestion } : {}),
    };
  });
}
