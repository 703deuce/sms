import "server-only";

import { getPrisma } from "@/lib/db";
import {
  createVoiceAgent,
  updateVoiceAgentDraft,
} from "@/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { agentTypeFromOutcomeSlug } from "@/lib/agents/types";
import type { AppointmentReceptionistWizardState } from "./types";
import {
  loadAppointmentReceptionistSetup,
  outcomeSlugFromWizard,
  upsertAppointmentReceptionistSetup,
} from "./save-setup";
import { uniqueAgentDisplayName } from "./wizard-presets";
import { validateReceptionistPhoneSelection } from "./validate-phone-selection";
import {
  nextWizardConfigRevision,
  patchAuthoritativeWizardOntoDraftConfig,
} from "./wizard-config-lifecycle";

export type WizardDraftPersistResult = {
  agentId: string;
  setupId: string;
  outcomeSlug: string;
  configRevision: number;
  state: AppointmentReceptionistWizardState;
  warnings: string[];
  issues: [];
  healthStatus: string | null;
  healthMessage: string | null;
};

/**
 * Lightweight Save Draft / Create Draft — persist authoritative wizard configuration only.
 * No activation hooks, KB crawl, workflow compile, Telnyx/live sync, or runtime recompile.
 */
export async function persistAppointmentReceptionistWizardDraft(input: {
  workspaceId: string;
  state: AppointmentReceptionistWizardState;
  action: "save_draft" | "create_draft";
}): Promise<WizardDraftPersistResult> {
  const warnings: string[] = [];
  let state = input.state;

  const rawName =
    (state.solutionName || "Appointment Receptionist").trim() ||
    "Appointment Receptionist";
  const name = state.agentId ? rawName : uniqueAgentDisplayName(rawName);
  if (!state.agentId && name !== state.solutionName) {
    state = { ...state, solutionName: name };
  }

  const outcomeSlug = outcomeSlugFromWizard(state);
  const productAgentType = agentTypeFromOutcomeSlug(outcomeSlug);

  let agentId = state.agentId ?? "";
  if (!agentId) {
    const created = await createVoiceAgent(input.workspaceId, {
      name,
      agentType: productAgentType,
      templateId: "appointment_booking",
      description: `${productAgentType} — wizard setup`,
    });
    agentId = created.id;
    state = { ...state, agentId };
  }

  const prisma = getPrisma();
  const existingAgent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId: input.workspaceId },
    select: { status: true, publishedVersionId: true, phoneNumberId: true, draftConfig: true },
  });
  const preserveActiveOnDraftSave = existingAgent?.status === "ACTIVE";

  const { isAppointmentReceptionistAgent } = await import(
    "@/lib/voice-v3/config/from-published-agent"
  );
  const prevConfig = parseVoiceAgentConfig(existingAgent?.draftConfig);
  const receptionistAgent = isAppointmentReceptionistAgent(prevConfig);

  if (state.phoneNumberId && receptionistAgent) {
    const phoneValidation = await validateReceptionistPhoneSelection({
      workspaceId: input.workspaceId,
      phoneNumberId: state.phoneNumberId,
      agentId,
      allowTakeoverFromOtherAgent: false,
    });
    if (!phoneValidation.ok) {
      throw new WizardDraftPersistError(phoneValidation.error, {
        agentId,
        code: phoneValidation.code,
      });
    }
    if (
      preserveActiveOnDraftSave &&
      existingAgent?.phoneNumberId &&
      state.phoneNumberId !== existingAgent.phoneNumberId
    ) {
      warnings.push(
        "Live phone assignment was not changed — use Activate to switch numbers. Other settings were saved.",
      );
      const keptPhone = await prisma.phoneNumber.findFirst({
        where: { id: existingAgent.phoneNumberId, workspaceId: input.workspaceId },
        select: { id: true, e164: true },
      });
      state = {
        ...state,
        phoneNumberId: existingAgent.phoneNumberId,
        phoneNumberE164: keptPhone?.e164 ?? state.phoneNumberE164,
      };
    }
  }

  const revision = nextWizardConfigRevision(prevConfig);
  const draftConfig = patchAuthoritativeWizardOntoDraftConfig(prevConfig, state, revision);

  const phonePatchForDraft =
    preserveActiveOnDraftSave && state.phoneNumberId === existingAgent?.phoneNumberId
      ? undefined
      : state.phoneNumberId;

  await updateVoiceAgentDraft(input.workspaceId, agentId, {
    name,
    description: `${productAgentType} — wizard setup`,
    agentType: productAgentType,
    displayName: state.agentName || name,
    purpose: "appointment_receptionist",
    phoneNumberId: phonePatchForDraft,
    draftConfig,
    status: preserveActiveOnDraftSave ? undefined : "DRAFT",
  });

  const setup = await upsertAppointmentReceptionistSetup({
    workspaceId: input.workspaceId,
    agentId,
    state: { ...state, agentId },
    published: preserveActiveOnDraftSave,
    compileWorkflow: false,
    links: {},
  });

  const authoritative = await loadAppointmentReceptionistSetup(input.workspaceId, {
    agentId,
    setupId: setup.setupId,
  });

  const savedState = (authoritative?.state ?? state) as AppointmentReceptionistWizardState;

  return {
    agentId,
    setupId: setup.setupId,
    outcomeSlug: setup.outcomeSlug,
    configRevision: revision,
    state: savedState,
    warnings,
    issues: [],
    healthStatus: authoritative?.healthStatus ?? null,
    healthMessage: authoritative?.healthMessage ?? null,
  };
}

export class WizardDraftPersistError extends Error {
  constructor(
    message: string,
    readonly data: { agentId?: string; code?: string },
  ) {
    super(message);
    this.name = "WizardDraftPersistError";
  }
}
