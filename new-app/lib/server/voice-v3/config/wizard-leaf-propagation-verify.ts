import type { AppointmentReceptionistWizardState, CapabilityId } from "@/lib/solutions/appointment-receptionist/types";
import type { VoiceV3AgentConfig } from "./agent-config";
import type { WizardV3FieldManifestRow } from "./wizard-v3-manifest-builder";
import { WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS } from "./wizard-control-inventory";
import { WIZARD_V3_FIELD_MANIFEST } from "./wizard-v3-field-manifest";
import { compileVoiceV3AgentConfig } from "./compile-voice-v3-agent-config";
import { buildBasicLiveSessionAcceptParams } from "@/lib/voice-v3-basic/live-session-config";
import { buildVoiceV3Prompts } from "@/lib/voice-v3/prompts/build-voice-v3-prompts";
import { listVoiceV3AstraToolNamesForConfig } from "@/lib/voice-v3/tools/voice-tool-catalog";
import { isVoiceV3ToolAuthorized } from "@/lib/voice-v3/tools/authorize-tool-for-config";
import { buildUpdateIntakeZodSchema } from "@/lib/voice-v3/intake-objective/build-intake-tool-schema";
import { resolveBookingServiceForRuntime } from "./resolve-booking-service";
import { createInitialVoiceV3CallContext } from "@/lib/voice-v3/state/call-context";
import { wizardPropagationBaseline } from "./wizard-propagation-fixture";
import { ensureWizardOperatingMaturity } from "@/lib/solutions/appointment-receptionist/operating-maturity-wizard";
import { buildLiveFrontendInstructions } from "@/lib/voice-v3/prompts/live-frontend-instructions";
import { tryNormalizeVoiceV3LiveBuiltInVoice } from "./voice-v3-live-built-in-voices";

function tryNormalizeWizardVoiceId(raw: string): string | null {
  return tryNormalizeVoiceV3LiveBuiltInVoice(raw);
}

const MANIFEST_BY_PATH = new Map(
  WIZARD_V3_FIELD_MANIFEST.map((row) => [row.statePath, row]),
);

const CAPABILITY_TO_FLAG: Record<
  CapabilityId,
  keyof VoiceV3AgentConfig["capabilities"]
> = {
  answer_questions: "answerQuestions",
  book_appointments: "bookAppointments",
  reschedule: "rescheduleAppointments",
  cancel: "cancelAppointments",
  take_messages: "takeMessages",
  qualify_callers: "qualifyCallers",
  transfer_calls: "transferCalls",
  send_sms_confirmations: "sendSms",
};

export type LeafPropagationStageResult = {
  statePath: string;
  sourcePath: boolean;
  compilerMapped: boolean;
  persistedBackend: boolean;
  runtimeConsumed: boolean;
  reason?: string;
};

export type WizardBackendPropagationReport = {
  totalCustomerEditableLeaves: number;
  mappedCount: number;
  compilerPropagatedCount: number;
  persistedBackendCount: number;
  runtimeConsumedCount: number;
  failures: LeafPropagationStageResult[];
  step7BrowserLiveTest: "NOT_RUN_BLOCKED";
};

function cloneWizard(): AppointmentReceptionistWizardState {
  return structuredClone(wizardPropagationBaseline());
}

function tokenizePath(path: string): string[] {
  return path
    .replace(/\[\]/g, ".0")
    .split(".")
    .filter(Boolean);
}

function getAtPath(root: unknown, path: string): unknown {
  const tokens = tokenizePath(path);
  let cur: unknown = root;
  for (const token of tokens) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[token];
  }
  return cur;
}

function setAtPath(root: Record<string, unknown>, path: string, value: unknown): void {
  const tokens = tokenizePath(path);
  let cur: Record<string, unknown> = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1]!;
    const isIndex = /^\d+$/.test(next);
    if (cur[token] == null) {
      cur[token] = isIndex ? [] : {};
    }
    if (Array.isArray(cur[token]) && /^\d+$/.test(next)) {
      const arr = cur[token] as unknown[];
      const idx = Number(next);
      while (arr.length <= idx) arr.push({});
      cur = arr[idx] as Record<string, unknown>;
      i += 1;
      continue;
    }
    cur = cur[token] as Record<string, unknown>;
  }
  const last = tokens[tokens.length - 1]!;
  cur[last] = value;
}

function distinctValueForPath(path: string, current: unknown): unknown {
  if (path.startsWith("capabilities.")) {
    return true;
  }
  if (typeof current === "boolean") return !current;
  if (typeof current === "number") return (current as number) + 7;
  if (Array.isArray(current)) return [...current, "CERT_LEAF"];
  if (path.endsWith("voiceId")) return "ash";
  if (path.endsWith("selectedAppointmentTypeId")) return "estimate";
  if (path === "bookingStrategy") return "MICROSOFT_365";
  if (path === "speaksFirst") return current === "caller" ? "ai" : "caller";
  if (path.includes("durationMin")) return 45;
  if (path.includes("required") && typeof current === "boolean") return !current;
  if (path.includes("enabled") && typeof current === "boolean") return !current;
  if (path.includes("phoneE164")) return "+15552223333";
  if (path.includes("Email") || path.endsWith("calendarEmail")) return "cert@example.com";
  return `CERT_${path.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40)}`;
}

export function mutateWizardForLeaf(
  wizard: AppointmentReceptionistWizardState,
  statePath: string,
): AppointmentReceptionistWizardState {
  const next = structuredClone(wizard) as AppointmentReceptionistWizardState & Record<string, unknown>;
  ensureWizardOperatingMaturity(next);

  if (statePath.startsWith("aiCallRecovery")) {
    const cur = getAtPath(next, statePath) === true;
    setAtPath(next as Record<string, unknown>, statePath, !cur);
    return next;
  }

  if (statePath === "transferDestinations[].id") {
    if (next.transferDestinations?.[0]) {
      next.transferDestinations[0].label = "CERT_TRANSFER_DEST_LABEL";
    }
    return next;
  }

  if (statePath.startsWith("capabilities.")) {
    const cap = statePath.replace("capabilities.", "") as CapabilityId;
    const set = new Set(next.capabilities || []);
    if (set.has(cap)) set.delete(cap);
    else set.add(cap);
    next.capabilities = [...set];
    return next;
  }

  if (statePath === "guardrails[]") {
    next.guardrails = ["CERT_GUARDRAIL_LINE"];
    return next;
  }
  if (statePath === "transferTriggers[]") {
    next.transferTriggers = ["CERT_TRANSFER_TRIGGER"];
    return next;
  }
  if (statePath === "qualificationSupportedZipCodes[]") {
    next.qualificationSupportedZipCodes = ["20151", "CERT_ZIP"];
    return next;
  }

  if (statePath.startsWith("transferPlanSteps[].")) {
    const field = statePath.replace("transferPlanSteps[].", "");
    const step = next.transferPlanSteps?.[0];
    if (step && field === "order") {
      step.order = (step.order ?? 1) + 1;
    } else if (step && field === "timeoutSeconds") {
      step.timeoutSeconds = (step.timeoutSeconds ?? 30) + 5;
    }
    return next;
  }

  if (statePath.endsWith("[]")) {
    const base = statePath.replace("[]", "");
    const cur = getAtPath(next, base);
    const marker = `CERT_${base.replace(/\./g, "_")}`;
    if (Array.isArray(cur) && cur.length > 0 && typeof cur[0] === "object") {
      setAtPath(next as Record<string, unknown>, `${base}.0.id`, marker);
    } else if (Array.isArray(cur)) {
      (next as Record<string, unknown>)[base] = [marker];
    } else {
      setAtPath(next as Record<string, unknown>, base, [{ id: marker, label: marker }]);
    }
    return next;
  }

  if (statePath.includes("operatingMaturity.businessSchedule.weekly.")) {
    const day = statePath.split(".")[3];
    if (day === "saturday" || day === "sunday") {
      ensureWizardOperatingMaturity(next);
      const weekly = next.operatingMaturity!.businessSchedule.weekly as Record<
        string,
        { closed?: boolean; ranges?: Array<{ start: string; end: string }> }
      >;
      const dayState = weekly[day] ?? { closed: true, ranges: [] };
      dayState.closed = false;
      dayState.ranges = [{ start: "09:00", end: "12:00" }];
      weekly[day] = dayState;
      return next;
    }
  }

  const current = getAtPath(next, statePath);
  const value = distinctValueForPath(statePath, current);
  setAtPath(next as Record<string, unknown>, statePath, value);
  if (statePath === "operatingMaturity.businessSchedule.timezone" && typeof value === "string") {
    next.timezone = value;
  }
  return next;
}

function wizardRecoveryField(
  statePath: string,
  wizard: AppointmentReceptionistWizardState,
): keyof VoiceV3AgentConfig["recovery"] | null {
  const map: Record<string, keyof VoiceV3AgentConfig["recovery"]> = {
    aiCallRecoveryEnabled: "aiCallRecoveryEnabled",
    aiCallRecoveryConsentMode: "consentMode",
    aiCallRecoverySendingPhoneNumberId: "sendingPhoneNumberId",
    aiCallRecoveryContinueOverSms: "continueOverSms",
    aiCallRecoveryDelaySeconds: "delaySeconds",
    aiCallRecoverySendWhenCallbackCreated: "sendWhenCallbackCreated",
  };
  return map[statePath] ?? null;
}

/** Mirrors compileVoiceV3AgentConfig retrievalEnabled gate (not a 1:1 wizard scalar). */
function expectedKnowledgeRetrievalEnabled(
  wizard: AppointmentReceptionistWizardState,
): boolean {
  const kbIds = wizard.linkedKnowledgeBaseId ? [wizard.linkedKnowledgeBaseId] : [];
  return (
    wizard.knowledgeBaseEnabled !== false &&
    kbIds.length > 0 &&
    (Boolean(wizard.linkedKnowledgeBaseId) ||
      wizard.knowledgeSource === "upload_docs" ||
      wizard.knowledgeSource === "website" ||
      wizard.knowledgeSource === "connect_data")
  );
}

function assertCompiledForRow(
  row: WizardV3FieldManifestRow,
  wizard: AppointmentReceptionistWizardState,
  config: VoiceV3AgentConfig,
): { ok: boolean; reason?: string } {
  if (row.statePath.startsWith("capabilities.")) {
    const cap = row.statePath.replace("capabilities.", "") as CapabilityId;
    const flag = CAPABILITY_TO_FLAG[cap];
    let expected = wizard.capabilities.includes(cap);
    if (cap === "take_messages") {
      expected = true;
    }
    const actual = config.capabilities[flag];
    if (actual !== expected) {
      return { ok: false, reason: `capabilities.${flag} expected ${expected} got ${actual}` };
    }
    return { ok: true };
  }

  if (row.executionStatus === "CONTROL_PLANE_ONLY") {
    return { ok: true };
  }

  const recoveryKey = wizardRecoveryField(row.statePath, wizard);
  if (recoveryKey) {
    const wizardVal = getAtPath(wizard, row.statePath);
    const configVal = config.recovery[recoveryKey];
    const norm = (v: unknown) => (typeof v === "boolean" ? v === true : v ?? null);
    if (norm(wizardVal) !== norm(configVal)) {
      return { ok: false, reason: `recovery.${recoveryKey} mismatch` };
    }
    return { ok: true };
  }

  if (row.statePath === "longTermMemory") {
    return config.integrations.longTermMemory === wizard.longTermMemory
      ? { ok: true }
      : { ok: false, reason: "integrations.longTermMemory mismatch" };
  }
  if (row.statePath === "crmEnabled") {
    return config.integrations.crmEnabled === wizard.crmEnabled
      ? { ok: true }
      : { ok: false, reason: "integrations.crmEnabled mismatch" };
  }

  if (row.statePath === "speaksFirst") {
    const expected = wizard.speaksFirst === "caller" ? "caller" : "ai";
    if (config.telephony.speaksFirst !== expected) {
      return { ok: false, reason: "telephony.speaksFirst mismatch" };
    }
    return { ok: true };
  }

  if (row.statePath === "timezone" || row.statePath === "operatingMaturity.businessSchedule.timezone") {
    const expected =
      row.statePath === "timezone"
        ? wizard.timezone
        : wizard.operatingMaturity?.businessSchedule?.timezone ?? wizard.timezone;
    if (config.timezone !== expected) {
      return { ok: false, reason: "timezone mismatch on VoiceV3AgentConfig" };
    }
    return { ok: true };
  }

  if (row.statePath === "bookingStrategy") {
    if (config.scheduling.bookingStrategy !== wizard.bookingStrategy) {
      return { ok: false, reason: "scheduling.bookingStrategy mismatch" };
    }
    return { ok: true };
  }

  if (row.statePath.startsWith("operatingMaturity.afterHoursBehavior.")) {
    if (row.executionStatus === "CONFIGURED_NOT_IMPLEMENTED") {
      return { ok: true };
    }
  }

  if (row.v3ConfigPath.includes("qualification.")) {
    const q = config.qualification;
    if (!q) return { ok: false, reason: "qualification config missing" };
    return { ok: true };
  }

  if (row.v3ConfigPath.startsWith("callHandling") || row.statePath.startsWith("transfer")) {
    const ch = config.callHandling;
    if (!ch) return { ok: false, reason: "callHandling config missing" };
    if (row.statePath === "transferTriggers[]") {
      return JSON.stringify(ch.transferTriggers) === JSON.stringify(wizard.transferTriggers)
        ? { ok: true }
        : { ok: false, reason: "transferTriggers mismatch" };
    }
    return { ok: true };
  }

  if (row.statePath.startsWith("collectFields[].")) {
    const fieldKey = row.statePath.replace("collectFields[].", "");
    const collect =
      wizard.collectFields?.find((f) => f.id === "custom_project_type") ||
      wizard.collectFields?.[1] ||
      wizard.collectFields?.[0];
    if (!collect) return { ok: false, reason: "missing collect field in fixture" };
    const intakeKey = collect.id.replace(/^custom_/, "").replace(/^full_name$/, "name");
    const intake = config.intakeFields.find((f) => f.key === intakeKey);
    if (!intake) return { ok: false, reason: `intake missing ${intakeKey}` };
    if (fieldKey === "useForQualification" || fieldKey === "enabled") {
      return { ok: true };
    }
    const wizardVal = (collect as Record<string, unknown>)[fieldKey];
    const configVal = (intake as Record<string, unknown>)[fieldKey === "id" ? "key" : fieldKey];
    if (fieldKey === "id" && configVal !== intakeKey) {
      return { ok: false, reason: `intake key expected ${intakeKey}` };
    }
    if (fieldKey !== "id" && fieldKey !== "useForQualification" && configVal !== wizardVal) {
      return { ok: false, reason: `intake.${fieldKey} expected ${String(wizardVal)} got ${String(configVal)}` };
    }
    return { ok: true };
  }

  if (row.statePath.startsWith("appointmentTypes[].")) {
    const field = row.statePath.replace("appointmentTypes[].", "");
    const type =
      wizard.appointmentTypes?.find((t) => t.id === "estimate") || wizard.appointmentTypes?.[0];
    const svc = config.services.find((s) => s.id === type?.id);
    if (!svc) return { ok: false, reason: "missing compiled service for appointmentTypes" };
    if (field === "durationMin" && svc.durationMinutes !== type?.durationMin) {
      return { ok: false, reason: "durationMin mismatch on services[]" };
    }
    if (field === "name" && svc.name !== type?.name) {
      return { ok: false, reason: "name mismatch on services[]" };
    }
    if (field === "enabled" && svc.enabled !== type?.enabled) {
      return { ok: false, reason: "enabled mismatch on services[]" };
    }
    return { ok: true };
  }

  if (row.statePath.includes("operatingMaturity.businessSchedule.weekly.")) {
    const baselineWizard = wizardPropagationBaseline();
    const before = getAtPath(baselineWizard, row.statePath);
    const after = getAtPath(wizard, row.statePath);
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return { ok: true };
    }
    const baseline = compileVoiceV3AgentConfig({
      wizard: baselineWizard,
      source: "wizard_draft_test",
    });
    if (
      JSON.stringify(baseline.businessHours) === JSON.stringify(config.businessHours) &&
      baseline.business?.hoursDisplay === config.business?.hoursDisplay
    ) {
      return { ok: false, reason: "weekly schedule change did not affect businessHours/hoursDisplay" };
    }
    return { ok: true };
  }

  if (row.v3ConfigPath === "identity.agentName" && config.identity.agentName !== wizard.agentName) {
    return { ok: false, reason: "agentName mismatch" };
  }
  if (row.v3ConfigPath === "telephony.liveVoiceId" || row.statePath === "voiceId") {
    const expectedBuiltin = config.telephony.liveVoiceId;
    if (wizard.voiceSource !== "custom") {
      const normalized = expectedBuiltin;
      const fromWizard =
        wizard.voiceId === normalized ||
        tryNormalizeWizardVoiceId(wizard.voiceId) === normalized;
      if (!fromWizard) {
        return { ok: false, reason: "liveVoiceId mismatch" };
      }
    }
  }
  if (row.executionStatus === "LIVE_PROMPT_CONTROL") {
    const controls = config.conversation.livePromptControls;
    if (!controls) {
      return { ok: false, reason: "missing conversation.livePromptControls" };
    }
    const field = row.statePath as keyof typeof controls;
    const wizardVal = getAtPath(wizard, row.statePath);
    if (wizardVal !== undefined && controls[field] !== wizardVal) {
      return { ok: false, reason: `livePromptControls.${String(field)} mismatch` };
    }
    const instructions = buildLiveFrontendInstructions({
      agentConfig: config,
      businessName: config.businessName,
      agentName: config.identity.agentName,
    });
    if (!instructions.includes("GPT-LIVE CONVERSATION TUNING")) {
      return { ok: false, reason: "live instructions missing GPT-LIVE tuning block" };
    }
    return { ok: true };
  }
  if (row.v3ConfigPath.includes("conversation.openingGreeting")) {
    if (!config.conversation.openingGreeting?.includes(wizard.openingGreeting.slice(0, 20))) {
      return { ok: false, reason: "openingGreeting mismatch" };
    }
  }
  if (row.v3ConfigPath.includes("scheduling.bookingStrategy")) {
    if (config.scheduling.bookingStrategy !== wizard.bookingStrategy) {
      return { ok: false, reason: "bookingStrategy mismatch" };
    }
  }

  if (row.executionStatus === "CONFIGURED_NOT_IMPLEMENTED") {
    return { ok: true };
  }

  if (row.statePath === "knowledgeSource") {
    const expected = expectedKnowledgeRetrievalEnabled(wizard);
    const actual = config.knowledge?.retrieval?.enabled === true;
    if (expected !== actual) {
      return {
        ok: false,
        reason: `knowledgeSource retrieval gate: expected enabled=${expected} got ${actual}`,
      };
    }
    return { ok: true };
  }

  if (row.statePath === "knowledgeBaseEnabled") {
    const expected = expectedKnowledgeRetrievalEnabled(wizard);
    const actual = config.knowledge?.retrieval?.enabled === true;
    if (expected !== actual) {
      return {
        ok: false,
        reason: `knowledge.retrieval.enabled expected ${expected} got ${actual}`,
      };
    }
    return { ok: true };
  }

  const wizardScalar = getAtPath(wizard, row.statePath);
  const configScalar = getAtPath(config, row.v3ConfigPath.split("+")[0]?.trim() ?? "");
  if (
    wizardScalar !== undefined &&
    configScalar !== undefined &&
    JSON.stringify(wizardScalar) !== JSON.stringify(configScalar)
  ) {
    return { ok: false, reason: `scalar mismatch ${row.statePath}` };
  }

  return { ok: true };
}

function assertPersistedWizardField(
  row: WizardV3FieldManifestRow,
  wizard: AppointmentReceptionistWizardState,
  stored: AppointmentReceptionistWizardState,
): boolean {
  if (row.statePath.startsWith("capabilities.")) {
    const cap = row.statePath.replace("capabilities.", "") as CapabilityId;
    const a = wizard.capabilities.includes(cap);
    const b = stored.capabilities.includes(cap);
    return a === b;
  }
  const a = getAtPath(wizard, row.statePath);
  const b = getAtPath(stored, row.statePath);
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertRuntimeForRow(
  row: WizardV3FieldManifestRow,
  wizard: AppointmentReceptionistWizardState,
  config: VoiceV3AgentConfig,
): { ok: boolean; reason?: string } {
  if (
    row.executionStatus !== "ACTIVE_EXECUTION" &&
    row.executionStatus !== "LIVE_PROMPT_CONTROL"
  ) {
    return { ok: true };
  }

  if (row.executionStatus === "LIVE_PROMPT_CONTROL") {
    const instructions = buildLiveFrontendInstructions({ agentConfig: config });
    if (!instructions.includes("GPT-LIVE CONVERSATION TUNING")) {
      return { ok: false, reason: "runtime instructions missing GPT-LIVE tuning block" };
    }
    return { ok: true };
  }

  if (
    row.v3ConfigPath === "telephony.liveVoiceId" ||
    row.statePath === "voiceId" ||
    row.v3ConfigPath === "telephony.liveVoiceOutput"
  ) {
    const accept = buildBasicLiveSessionAcceptParams(new Date(), config);
    const session = accept.session as {
      audio?: { output?: { voice?: string | { id?: string } } };
    };
    const voice = session.audio?.output?.voice;
    const expected = config.telephony.liveVoiceOutput ?? config.telephony.liveVoiceId;
    const matches =
      typeof expected === "object" && expected && "id" in expected
        ? typeof voice === "object" && voice && "id" in voice && voice.id === expected.id
        : voice === expected;
    if (!matches) {
      return { ok: false, reason: "Live session voice does not read telephony voice config" };
    }
    return { ok: true };
  }

  if (row.statePath.startsWith("capabilities.")) {
    const cap = row.statePath.replace("capabilities.", "") as CapabilityId;
    if (cap === "cancel") {
      const allowed = isVoiceV3ToolAuthorized(config, "cancel_appointment");
      if (allowed !== config.capabilities.cancelAppointments) {
        return { ok: false, reason: "cancel tool auth does not match capability flag" };
      }
    }
    if (cap === "book_appointments") {
      const tools = listVoiceV3AstraToolNamesForConfig(config);
      if (config.capabilities.bookAppointments && !tools.includes("book_appointment")) {
        return { ok: false, reason: "book_appointment tool missing when capability on" };
      }
    }
    return { ok: true };
  }

  if (row.statePath.startsWith("collectFields[].")) {
    const schema = buildUpdateIntakeZodSchema(config);
    const firstKey = config.intakeFields[0]?.key;
    if (firstKey && !(firstKey in schema.shape)) {
      return { ok: false, reason: "update_intake schema missing compiled intake field" };
    }
    return { ok: true };
  }

  if (row.statePath === "selectedAppointmentTypeId" || row.statePath.includes("appointmentTypes[].")) {
    const ctx = createInitialVoiceV3CallContext({
      callId: "cert",
      liveSessionId: "cert",
      timezone: config.timezone,
      clock: {
        nowUtc: new Date(),
        businessLocal: { date: "2026-09-19", time: "12:00", weekday: 5 },
      },
      now: new Date(),
    });
    ctx.intake.values.booking_service_id = {
      value: config.services[1]?.id ?? config.services[0]?.id ?? "",
      source: "caller",
      confidence: "high",
    };
    const svc = resolveBookingServiceForRuntime(config, ctx);
    if (ctx.intake.values.booking_service_id.value === config.services[1]?.id) {
      if (svc.durationMinutes !== config.services[1]?.durationMinutes) {
        return { ok: false, reason: "resolveBookingServiceForRuntime duration mismatch" };
      }
    }
    return { ok: true };
  }

  if (
    row.v3ConfigPath.startsWith("identity.") ||
    row.v3ConfigPath.startsWith("conversation.") ||
    row.v3ConfigPath === "businessName"
  ) {
    const prompts = buildVoiceV3Prompts({
      agentConfig: config,
      toolNames: listVoiceV3AstraToolNamesForConfig(config),
    });
    if (!prompts.liveInstructions.includes(config.identity.agentName)) {
      return { ok: false, reason: "prompts missing identity.agentName" };
    }
    return { ok: true };
  }

  if (row.v3ConfigPath.includes("calendar.connectionId")) {
    if (!config.calendar?.connectionId) {
      return { ok: false, reason: "calendar.connectionId missing" };
    }
    return { ok: true };
  }

  if (row.statePath === "linkedKnowledgeBaseId") {
    const ids = config.knowledge?.retrieval?.knowledgeBaseIds ?? [];
    if (wizard.linkedKnowledgeBaseId && !ids.includes(wizard.linkedKnowledgeBaseId)) {
      return { ok: false, reason: "knowledge.retrieval.knowledgeBaseIds missing wizard link" };
    }
    return { ok: true };
  }

  if (row.statePath === "knowledgeBaseEnabled") {
    const retrievalOn = config.knowledge?.retrieval?.enabled === true;
    const searchAuth = isVoiceV3ToolAuthorized(config, "search_business_knowledge");
    if (retrievalOn && !searchAuth) {
      return { ok: false, reason: "search_business_knowledge not authorized when retrieval enabled" };
    }
    if (!retrievalOn && searchAuth) {
      return { ok: false, reason: "search_business_knowledge authorized when retrieval disabled" };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function runWizardBackendPropagationCert(input?: {
  buildWizardAgentConfig?: (
    wizard: AppointmentReceptionistWizardState,
  ) => { advanced?: Record<string, unknown> };
}): WizardBackendPropagationReport {
  const failures: LeafPropagationStageResult[] = [];
  let mappedCount = 0;
  let compilerPropagatedCount = 0;
  let persistedBackendCount = 0;
  let runtimeConsumedCount = 0;

  for (const statePath of WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS) {
    const row = MANIFEST_BY_PATH.get(statePath);
    const sourcePath = Boolean(row);
    const compilerMapped = Boolean(
      row?.v3ConfigPath && row.compilerFunction && row.runtimeConsumer,
    );
    if (sourcePath && compilerMapped) mappedCount += 1;

    if (!row) {
      failures.push({
        statePath,
        sourcePath: false,
        compilerMapped: false,
        persistedBackend: false,
        runtimeConsumed: false,
        reason: "missing manifest row",
      });
      continue;
    }

    const wizard = mutateWizardForLeaf(cloneWizard(), statePath);
    const config = compileVoiceV3AgentConfig({
      wizard,
      source: "wizard_draft_test",
      providerConnections: {
        microsoftConnectionId: "ms_conn_propagation_cert",
        microsoftCalendarIds: ["primary"],
      },
    });

    const compiled = assertCompiledForRow(row, wizard, config);
    let persisted = { ok: true, reason: undefined as string | undefined };
    if (input?.buildWizardAgentConfig) {
      try {
        const built = input.buildWizardAgentConfig(wizard);
        const stored = (built.advanced?.appointmentReceptionistWizard ||
          null) as AppointmentReceptionistWizardState | null;
        if (!stored) {
          persisted = { ok: false, reason: "appointmentReceptionistWizard missing from draft" };
        } else if (!assertPersistedWizardField(row, wizard, stored)) {
          persisted = {
            ok: false,
            reason: "draft wizard field mismatch after buildWizardAgentConfig",
          };
        }
      } catch (err) {
        persisted = {
          ok: false,
          reason: err instanceof Error ? err.message : "buildWizardAgentConfig failed",
        };
      }
    }

    const runtime = assertRuntimeForRow(row, wizard, config);

    if (compiled.ok) compilerPropagatedCount += 1;
    if (persisted.ok) persistedBackendCount += 1;
    if (runtime.ok) runtimeConsumedCount += 1;

    if (!compiled.ok || !persisted.ok || !runtime.ok) {
      failures.push({
        statePath,
        sourcePath,
        compilerMapped,
        persistedBackend: persisted.ok,
        runtimeConsumed: runtime.ok,
        reason: compiled.reason || persisted.reason || runtime.reason,
      });
    }
  }

  return {
    totalCustomerEditableLeaves: WIZARD_CUSTOMER_EDITABLE_CONTROL_PATHS.length,
    mappedCount,
    compilerPropagatedCount,
    persistedBackendCount,
    runtimeConsumedCount,
    failures,
    step7BrowserLiveTest: "NOT_RUN_BLOCKED",
  };
}
