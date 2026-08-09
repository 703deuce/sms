import { getPrisma } from "@/lib/db";
import { buildWizardAgentConfig } from "@/lib/solutions/appointment-receptionist/build-agent-config";
import { createDefaultWizardState } from "@/lib/solutions/appointment-receptionist/defaults";
import { resolveServiceRequiredFields } from "@/lib/solutions/appointment-receptionist/required-fields";
import { parseDaysAhead, parseNoticeMinutes } from "@/lib/solutions/appointment-receptionist/notice-utils";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import { HOME_SERVICE_DISPATCHER_WORKFLOW_V1 } from "@/lib/voice/workflow-runtime/definitions/home-service-dispatcher";
import { persistVoiceWorkflowDefinition } from "@/lib/voice/workflow-runtime/persistence";
import { setActiveWorkflowForAgent } from "@/lib/voice/workflow-runtime/loader";
import {
  enabledRequiredFieldIds,
  resolveWizardProfileForScenario,
} from "./conversation-wizard-profiles";
import type { ConversationScenario } from "./conversation-scenarios";

const PLUMBING_APPOINTMENT_TYPE = {
  id: "plumbing_repair",
  name: "Plumbing Repair",
  durationMin: 60,
  calendar: "Main Calendar",
  status: "ready" as const,
  bookingHours: "Mon - Fri, 8:00 AM - 6:00 PM",
  minNotice: "0 hours",
  maxDaysAhead: "30 days",
  bookingPermission: "book_directly" as const,
  enabled: true,
};

export function buildSimulatorWizardState(input: {
  scenario: ConversationScenario;
  agentId: string;
  phoneNumberE164: string;
}): AppointmentReceptionistWizardState {
  const profile = resolveWizardProfileForScenario(input.scenario.id, input.scenario.wizardProfileId);
  const requiredFieldIds = enabledRequiredFieldIds(profile.collectFields);

  const state = createDefaultWizardState();
  state.agentId = input.agentId;
  state.phoneNumberE164 = input.phoneNumberE164;
  state.businessName = "Test Plumbing Co";
  state.solutionName = "Test Plumbing Receptionist";
  state.collectFields = profile.collectFields.map((field) => ({ ...field }));
  state.selectedAppointmentTypeId = PLUMBING_APPOINTMENT_TYPE.id;
  state.appointmentTypes = [
    {
      ...PLUMBING_APPOINTMENT_TYPE,
      requiredFields: requiredFieldIds,
    },
    ...state.appointmentTypes.filter((t) => t.id !== PLUMBING_APPOINTMENT_TYPE.id).map((t) => ({
      ...t,
      enabled: false,
    })),
  ];
  state.knowledgeItems = state.knowledgeItems.map((item) =>
    item.id === "pricing"
      ? {
          ...item,
          summary: "Diagnostic visit is $89.",
          status: "complete" as const,
          statusLabel: "Configured",
        }
      : item,
  );

  return state;
}

async function syncWizardServices(input: {
  workspaceId: string;
  state: AppointmentReceptionistWizardState;
}): Promise<string> {
  const prisma = getPrisma();
  const enabled = input.state.appointmentTypes.filter((t) => t.enabled);
  const primary = enabled[0];
  if (!primary) throw new Error("Simulator wizard state needs at least one enabled appointment type");

  const existing = await prisma.voiceService.findFirst({
    where: { workspaceId: input.workspaceId, name: primary.name },
  });

  const serviceConfig = {
    wizardTypeId: primary.id,
    enabled: true,
    bookingHours: primary.bookingHours || "Mon - Fri, 8:00 AM - 6:00 PM",
    minNotice: primary.minNotice || "0 hours",
    minimumBookingNoticeMinutes: parseNoticeMinutes(primary.minNotice),
    maxDaysAhead: primary.maxDaysAhead || "30 days",
    maximumBookingDaysAhead: parseDaysAhead(primary.maxDaysAhead),
    requiredFields: resolveServiceRequiredFields(
      primary.requiredFields,
      input.state.collectFields || [],
    ),
    bookingPermission: primary.bookingPermission,
    timezone: input.state.timezone || "America/New_York",
    requiredSkills: ["plumbing"],
    staffIds: [] as string[],
  };

  if (existing) {
    const updated = await prisma.voiceService.update({
      where: { id: existing.id },
      data: {
        durationMinutes: primary.durationMin || 60,
        config: { ...(existing.config as object), ...serviceConfig } as object,
      },
    });
    return updated.name;
  }

  const created = await prisma.voiceService.create({
    data: {
      workspaceId: input.workspaceId,
      name: primary.name,
      durationMinutes: primary.durationMin || 60,
      bufferMinutes: 15,
      config: serviceConfig as object,
    },
  });
  return created.name;
}

/**
 * Seeds agent config the same way POST /api/solutions/appointment-receptionist does:
 * buildWizardAgentConfig → updateVoiceAgentDraft → activate hooks (services, KB, etc.).
 */
export async function seedAgentViaFrontendWizard(input: {
  workspaceId: string;
  agentId: string;
  phoneNumberE164: string;
  scenario: ConversationScenario;
}): Promise<{ serviceName: string; wizardState: AppointmentReceptionistWizardState }> {
  const prisma = getPrisma();
  const wizardState = buildSimulatorWizardState({
    scenario: input.scenario,
    agentId: input.agentId,
    phoneNumberE164: input.phoneNumberE164,
  });

  const draftConfig = buildWizardAgentConfig(wizardState);
  await updateVoiceAgentDraft(input.workspaceId, input.agentId, { draftConfig });

  const serviceName = await syncWizardServices({
    workspaceId: input.workspaceId,
    state: wizardState,
  });

  await persistVoiceWorkflowDefinition({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    definition: HOME_SERVICE_DISPATCHER_WORKFLOW_V1,
    setActive: true,
  });
  setActiveWorkflowForAgent(input.agentId, {
    workflowId: "home_service_dispatcher",
    version: 1,
  });

  let service = await prisma.voiceService.findFirst({
    where: { workspaceId: input.workspaceId, name: serviceName },
  });
  if (!service) throw new Error(`Expected service "${serviceName}" after wizard sync`);

  const tech =
    (await prisma.voiceStaffMember.findFirst({
      where: { workspaceId: input.workspaceId, name: "Tech A" },
    })) ||
    (await prisma.voiceStaffMember.create({
      data: {
        workspaceId: input.workspaceId,
        name: "Tech A",
        config: { skills: ["plumbing"], zones: ["zone_b"], calendarConnected: true } as object,
      },
    }));

  await prisma.voiceService.update({
    where: { id: service.id },
    data: {
      config: {
        ...(service.config as object),
        staffIds: [tech.id],
        enabled: true,
      } as object,
    },
  });

  return { serviceName: service.name, wizardState };
}
