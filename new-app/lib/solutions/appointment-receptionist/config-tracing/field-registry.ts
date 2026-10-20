import type { WizardStepId } from "../types";
import { wizardStepOwnedFields } from "../merge-wizard-state-on-save";

export type ConfigFieldOwner =
  | WizardStepId
  | "operational-knowledge"
  | "operational-call-handling"
  | "operational-receptionist-editor"
  | "meta";

export type ReceptionistFieldRegistryEntry = {
  path: string;
  owner: ConfigFieldOwner;
  editable: boolean;
  affectsRuntime: boolean;
  requiresExternalProcessing: boolean;
  sensitive: boolean;
  runtimeMapping?: string;
};

const RUNTIME_AFFECTING_TOP = new Set([
  "capabilities",
  "answerWhen",
  "phoneNumberId",
  "ringBehavior",
  "callRecording",
  "connectionGreeting",
  "connectionGreetingText",
  "bookingStrategy",
  "bookingBehavior",
  "appointmentTypes",
  "collectFields",
  "qualificationEnabled",
  "qualificationRules",
  "transferDestinationPhone",
  "transferTriggers",
  "warmTransfer",
  "voiceV2HumanTransferEnabled",
  "transferRouting",
  "transferDestinations",
  "transferPlanSteps",
  "callbackRequestsEnabled",
  "spamLikelyPolicy",
  "solicitorPolicy",
  "aiCallRecoveryEnabled",
  "agentName",
  "openingGreeting",
  "voiceId",
  "speakingPace",
  "language",
  "conversationBehaviors",
  "guardrails",
  "knowledgeBaseEnabled",
  "websiteUrl",
  "linkedKnowledgeBaseId",
  "operatingMaturity",
  "calendarProvider",
  "calendarConnected",
  "calendlyEventTypeUri",
  "bookingLinkUrl",
]);

const EXTERNAL_PROCESSING_TOP = new Set([
  "websiteUrl",
  "knowledgeItems",
  "linkedKnowledgeBaseId",
  "calendarProvider",
  "calendarConnected",
  "calendlyEventTypeUri",
  "phoneNumberId",
]);

const RUNTIME_MAP: Record<string, string> = {
  bookingStrategy: "receptionistCompiled.bookingStrategy / enabledBuiltinTools",
  bookingBehavior: "receptionistCompiled.bookingBehavior",
  voiceId: "realtime.voiceId / GPT-Live voice",
  openingGreeting: "receptionistCompiled.greeting",
  agentName: "receptionistCompiled.agentDisplayName",
  transferDestinationPhone: "receptionistCompiled.transferPolicy",
  capabilities: "receptionistCompiled.capabilities",
  collectFields: "receptionistCompiled.fieldManifest",
  phoneNumberId: "TriggerDeployment / inbound routing",
  connectionGreeting: "Telnyx connection greeting (publish)",
};

function leafPath(path: string): string {
  const base = path.replace(/\[\d+\]/g, "");
  const parts = base.split(".");
  return parts[parts.length - 1] ?? path;
}

function inferOwner(path: string): ConfigFieldOwner {
  const leaf = leafPath(path);
  for (const step of [
    "goals",
    "phone",
    "information",
    "appointments",
    "call-handling",
    "voice",
    "test",
    "activate",
  ] as WizardStepId[]) {
    const owned = wizardStepOwnedFields(step);
    if (owned.includes(leaf as never)) return step;
  }
  if (path.startsWith("knowledge")) return "operational-knowledge";
  return "meta";
}

export function registryEntryForPath(path: string): ReceptionistFieldRegistryEntry {
  const leaf = leafPath(path);
  const owner = inferOwner(path);
  const sensitive =
    leaf.includes("Phone") ||
    leaf.includes("E164") ||
    leaf.includes("Greeting") ||
    leaf.includes("Url") ||
    leaf === "guardrails" ||
    leaf === "knowledgeItems" ||
    leaf === "qualificationRules" ||
    leaf.includes("email");
  return {
    path,
    owner,
    editable: owner !== "meta",
    affectsRuntime: RUNTIME_AFFECTING_TOP.has(leaf) || path.includes("bookingBehavior"),
    requiresExternalProcessing: EXTERNAL_PROCESSING_TOP.has(leaf),
    sensitive,
    runtimeMapping: RUNTIME_MAP[leaf],
  };
}

/** All top-level wizard keys with registry metadata (nested paths discovered at diff time). */
export function listTopLevelRegistryEntries(): ReceptionistFieldRegistryEntry[] {
  const steps: WizardStepId[] = [
    "goals",
    "phone",
    "information",
    "appointments",
    "call-handling",
    "voice",
    "test",
    "activate",
  ];
  const paths = new Set<string>();
  for (const step of steps) {
    for (const key of wizardStepOwnedFields(step)) {
      paths.add(String(key));
    }
  }
  for (const meta of ["agentId", "setupId", "outcomeSlug", "telnyxAssistantId", "preset"]) {
    paths.add(meta);
  }
  return [...paths].sort().map((p) => registryEntryForPath(p));
}
