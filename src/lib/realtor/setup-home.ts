import { getPrisma } from "@/lib/db";
import { isMessagingReady } from "@/lib/messaging/status";
import type { RealtorAmyMode, RealtorProductConfig } from "./types";
import { configNeedsBooking } from "./wizard-steps";

export type SetupStepStatus =
  | "complete"
  | "ready"
  | "pending"
  | "not_started";

export type SetupHomeStep = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  status: SetupStepStatus;
  statusLabel: string;
  actionLabel: string;
  href: string;
  required: boolean;
  stepNumber?: number;
};

export type SetupHomeState = {
  steps: SetupHomeStep[];
  requiredComplete: number;
  requiredTotal: number;
  readyToGoLive: boolean;
};

function hasFrontDesk(mode: RealtorAmyMode): boolean {
  return mode === "front_desk" || mode === "both";
}

function hasSpeedToLead(mode: RealtorAmyMode): boolean {
  return mode === "speed_to_lead" || mode === "both";
}

function statusLabel(status: SetupStepStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "ready":
      return "Ready to configure";
    case "pending":
      return "Pending";
    default:
      return "Not started";
  }
}

export async function loadSetupHomeState(
  workspaceId: string,
  config: RealtorProductConfig,
): Promise<SetupHomeState> {
  const prisma = getPrisma();
  const [phone, messagingReg, calendlyConn] = await Promise.all([
    prisma.phoneNumber.findFirst({
      where: { workspaceId },
      select: { e164: true },
    }),
    prisma.messagingRegistration.findUnique({
      where: { workspaceId },
    }),
    prisma.integrationConnection.findFirst({
      where: { workspaceId, provider: "calendly", status: "connected" },
      select: { id: true },
    }),
  ]);

  const businessComplete =
    Boolean(config.business.teamName?.trim()) || Boolean(config.business.brokerage?.trim());
  const phoneComplete =
    Boolean(phone?.e164) ||
    Boolean(config.phone.transferNumber?.trim()) ||
    Boolean(config.phone.outboundNumberE164?.trim());

  const frontDeskComplete =
    config.live &&
    config.frontDeskPublishedVersionId &&
    hasFrontDesk(config.amyMode);
  const frontDeskReady =
    hasFrontDesk(config.amyMode) &&
    (config.frontDeskTemplateAgentId || config.deployedAgentId || config.onboardingComplete);

  const speedComplete =
    config.live &&
    config.outboundPublishedVersionId &&
    hasSpeedToLead(config.amyMode);
  const speedReady =
    hasSpeedToLead(config.amyMode) &&
    (config.outboundTemplateAgentId || config.deployedOutboundAgentId || config.onboardingComplete);

  const leadSourcesComplete = config.leadSources.length > 0;
  const needsCalendar = configNeedsBooking(config);
  const calendarComplete =
    !needsCalendar ||
    Boolean(calendlyConn) ||
    Object.keys(config.calendlyEventMappings || {}).length > 0;

  const messagingReady = isMessagingReady(messagingReg);
  const messagingPending =
    messagingReg &&
    !messagingReady &&
    messagingReg.overallStatus !== "not_started";

  const testComplete = config.onboardingComplete && config.live;

  let stepNum = 0;
  const nextNum = () => {
    stepNum += 1;
    return stepNum;
  };

  const steps: SetupHomeStep[] = [
    {
      id: "business",
      title: "Business Profile",
      description: "Team name, brokerage, service areas, and hours Amy uses on calls.",
      status: businessComplete ? "complete" : "not_started",
      statusLabel: businessComplete ? "Complete" : "Not started",
      actionLabel: businessComplete ? "Complete" : "Set up",
      href: "/realtor/onboarding?step=business",
      required: true,
      stepNumber: nextNum(),
    },
    {
      id: "phone",
      title: "Set Up Your Phone",
      description: "Inbound number, after-hours routing, and transfer destinations.",
      status: phoneComplete ? "complete" : "not_started",
      statusLabel: phoneComplete ? "Complete" : "Not started",
      actionLabel: phoneComplete ? "Complete" : "Configure",
      href: "/realtor/onboarding?step=phone",
      required: true,
      stepNumber: nextNum(),
    },
  ];

  if (hasFrontDesk(config.amyMode)) {
    steps.push({
      id: "front_desk",
      title: "Front Desk",
      subtitle: "Inbound AI Agent",
      description: "Inbound call handling — intents, qualification, booking, and transfer.",
      status: frontDeskComplete ? "complete" : frontDeskReady ? "ready" : "not_started",
      statusLabel: frontDeskComplete ? "Complete" : frontDeskReady ? "Ready" : "Not started",
      actionLabel: frontDeskComplete ? "Complete" : "Configure",
      href: "/realtor/agents/front-desk",
      required: true,
      stepNumber: nextNum(),
    });
  }

  if (hasSpeedToLead(config.amyMode)) {
    steps.push({
      id: "speed_to_lead",
      title: "Speed-to-Lead",
      subtitle: "Outbound AI Agent",
      description: "Outbound qualification and follow-up for new leads.",
      status: speedComplete ? "complete" : speedReady ? "ready" : "not_started",
      statusLabel: speedComplete ? "Complete" : speedReady ? "Ready" : "Not started",
      actionLabel: speedComplete ? "Complete" : "Configure",
      href: "/realtor/agents/speed-to-lead",
      required: true,
      stepNumber: nextNum(),
    });
  }

  steps.push(
    {
      id: "lead_sources",
      title: "Connect Lead Sources",
      description: "Facebook, Zillow, website forms, CRM, and webhook ingress.",
      status: leadSourcesComplete ? "complete" : "not_started",
      statusLabel: leadSourcesComplete ? "Complete" : "Not started",
      actionLabel: leadSourcesComplete ? "Complete" : "Connect",
      href: "/realtor/leads/sources",
      required: true,
      stepNumber: nextNum(),
    },
    {
      id: "calendar",
      title: "Connect Calendar",
      description: "Calendly event types for buyer and seller consultations.",
      status: calendarComplete ? "complete" : needsCalendar ? "not_started" : "complete",
      statusLabel: calendarComplete ? "Complete" : "Not started",
      actionLabel: calendarComplete ? "Complete" : "Connect",
      href: "/integrations/native/calendly",
      required: needsCalendar,
      stepNumber: nextNum(),
    },
    {
      id: "messaging",
      title: "Messaging",
      subtitle: "SMS",
      description: "SMS registration and number attachment for confirmations and follow-up.",
      status: messagingReady ? "complete" : messagingPending ? "pending" : "not_started",
      statusLabel: messagingReady
        ? "Complete"
        : messagingPending
          ? "Pending"
          : "Not started",
      actionLabel: messagingReady ? "Complete" : "Complete",
      href: "/settings/messaging",
      required: true,
      stepNumber: nextNum(),
    },
  );

  for (const step of steps) {
    if (!step.statusLabel) step.statusLabel = statusLabel(step.status);
  }

  const required = steps.filter((s) => s.required);
  const requiredComplete = required.filter((s) => s.status === "complete").length;

  return {
    steps,
    requiredComplete,
    requiredTotal: required.length,
    readyToGoLive: required.every((s) => s.status === "complete") && !config.live,
  };
}
