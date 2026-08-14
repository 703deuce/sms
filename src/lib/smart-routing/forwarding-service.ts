export type ForwardingMode = "unconditional" | "no_answer" | "busy" | "busy_no_answer";

export type CarrierForwardingGuide = {
  carrier: string;
  modes: Record<
    ForwardingMode,
    { label: string; dialCode: string; notes?: string }
  >;
};

export const CARRIER_FORWARDING_GUIDES: CarrierForwardingGuide[] = [
  {
    carrier: "Verizon",
    modes: {
      unconditional: {
        label: "Forward all calls",
        dialCode: "*72{routingNumber}",
        notes: "Dial *72, then routing number, then #. Cancel with *73.",
      },
      no_answer: {
        label: "Forward when no answer",
        dialCode: "*71{routingNumber}",
      },
      busy: {
        label: "Forward when busy",
        dialCode: "*90{routingNumber}",
      },
      busy_no_answer: {
        label: "Busy + no answer",
        dialCode: "Use no-answer forwarding; Verizon may not combine busy + no-answer on all plans.",
      },
    },
  },
  {
    carrier: "AT&T",
    modes: {
      unconditional: {
        label: "Forward all calls",
        dialCode: "*21*{routingNumber}#",
        notes: "Cancel with #21#.",
      },
      no_answer: {
        label: "Forward when no answer",
        dialCode: "*61*{routingNumber}#",
      },
      busy: {
        label: "Forward when busy",
        dialCode: "*67*{routingNumber}#",
      },
      busy_no_answer: {
        label: "Busy + no answer",
        dialCode: "Set no-answer and busy forwarding separately.",
      },
    },
  },
  {
    carrier: "T-Mobile",
    modes: {
      unconditional: {
        label: "Forward all calls",
        dialCode: "**21*{routingNumber}#",
      },
      no_answer: {
        label: "Forward when no answer",
        dialCode: "**61*{routingNumber}#",
      },
      busy: {
        label: "Forward when busy",
        dialCode: "**67*{routingNumber}#",
      },
      busy_no_answer: {
        label: "Busy + no answer",
        dialCode: "Configure both codes if your plan supports them.",
      },
    },
  },
  {
    carrier: "Other",
    modes: {
      unconditional: {
        label: "Forward all calls",
        dialCode: "Contact your carrier for unconditional forwarding to {routingNumber}",
      },
      no_answer: {
        label: "Forward when no answer",
        dialCode: "Ask carrier for conditional no-answer forwarding to {routingNumber}",
      },
      busy: {
        label: "Forward when busy",
        dialCode: "Ask carrier for busy forwarding to {routingNumber}",
      },
      busy_no_answer: {
        label: "Busy + no answer",
        dialCode: "Ask carrier for conditional forwarding options.",
      },
    },
  },
];

export function buildForwardingInstructions(input: {
  carrier: string;
  mode: ForwardingMode;
  routingNumber: string;
}) {
  const guide =
    CARRIER_FORWARDING_GUIDES.find((g) => g.carrier === input.carrier) ??
    CARRIER_FORWARDING_GUIDES.find((g) => g.carrier === "Other")!;
  const entry = guide.modes[input.mode];
  const dialCode = entry.dialCode.replace(/\{routingNumber\}/g, input.routingNumber);
  return {
    carrier: guide.carrier,
    mode: input.mode,
    label: entry.label,
    dialCode,
    notes: entry.notes,
  };
}

export async function markForwardingVerified(
  workspaceId: string,
  flowId: string,
  meta: {
    carrier?: string;
    forwardingType?: string;
    verifiedAt?: Date;
  },
) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const flow = await prisma.smartRoutingFlow.findFirst({
    where: { id: flowId, workspaceId },
  });
  if (!flow) throw new Error("Flow not found");
  const schedule = (flow.scheduleJson as Record<string, unknown>) ?? {};
  const forwarding = (schedule.forwarding as Record<string, unknown>) ?? {};
  const next = {
    ...schedule,
    forwarding: {
      ...forwarding,
      carrier: meta.carrier ?? forwarding.carrier,
      forwardingType: meta.forwardingType ?? forwarding.forwardingType,
      verifiedAt: (meta.verifiedAt ?? new Date()).toISOString(),
      status: "verified",
    },
  };
  return prisma.smartRoutingFlow.update({
    where: { id: flowId },
    data: { scheduleJson: next as object },
  });
}
