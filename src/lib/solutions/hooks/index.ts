import type { CapabilityHookModule, CapabilityRegistration } from "./types";
import * as afterHours from "./after-hours";
import * as overflow from "./overflow";
import * as missedCall from "./missed-call";
import * as leadQualification from "./lead-qualification";
import * as customerSupport from "./customer-support";
import * as medical from "./medical";
import * as legal from "./legal";
import * as propertyManagement from "./property-management";
import * as outbound from "./outbound";
import * as campaigns from "./campaigns";
import * as payments from "./payments";
import * as surveys from "./surveys";
import * as reviews from "./reviews";
import * as reminders from "./reminders";

export type { CapabilityHookContext, CapabilityRegistration, CapabilityHookStatus } from "./types";
export { markCapabilityHook, defineCapabilityHook, applyCapabilityDraftPatch } from "./mark-capability";
export { runSharedReceptionistHooks } from "./shared-receptionist";

/** All known capability hook modules. */
export const CAPABILITY_HOOKS: CapabilityHookModule[] = [
  afterHours,
  overflow,
  missedCall,
  leadQualification,
  customerSupport,
  medical,
  legal,
  propertyManagement,
  outbound,
  campaigns,
  payments,
  surveys,
  reviews,
  reminders,
];

export function listCapabilityRegistrations(): CapabilityRegistration[] {
  return CAPABILITY_HOOKS.map((h) => h.registerCapability());
}

export {
  afterHours,
  overflow,
  missedCall,
  leadQualification,
  customerSupport,
  medical,
  legal,
  propertyManagement,
  outbound,
  campaigns,
  payments,
  surveys,
  reviews,
  reminders,
};
