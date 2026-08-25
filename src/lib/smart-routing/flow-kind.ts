import { MCTB_CONSENT_FLOW_NAME } from "@/lib/mctb/consent-prompt/types";

export function isMctbConsentFlow(flow: {
  type?: string | null;
  name?: string | null;
}): boolean {
  return flow.type === "missed_call_recovery" || flow.name === MCTB_CONSENT_FLOW_NAME;
}

export function isCustomerSmartRoutingFlow(flow: {
  type?: string | null;
  name?: string | null;
}): boolean {
  return !isMctbConsentFlow(flow);
}

/** Prisma filter: exclude MCTB press-1 consent flows from customer SR queries. */
export const customerSmartRoutingFlowWhere = {
  NOT: {
    OR: [{ type: "missed_call_recovery" }, { name: MCTB_CONSENT_FLOW_NAME }],
  },
} as const;
