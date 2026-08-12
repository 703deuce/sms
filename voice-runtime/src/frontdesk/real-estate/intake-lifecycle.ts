import type { AgentSession } from "@livekit/agents";
import { searchCrmContactsForVoice } from "@/lib/voice/tools/crm-contact-search";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { missingIntakeFields } from "@/lib/voice/real-estate/fields";
import { parseLocalContactIdFromSafeId } from "@/lib/voice/real-estate/contact-id";
import type { RealEstateIntent } from "@/lib/voice/real-estate/types";
import { safeInterruptSession } from "../../session-utils";
import type { FrontDeskUserData } from "../userdata";
import { runRealEstateIntakeTaskGroup } from "./intake-task-group";

export const INTAKE_INTENTS: RealEstateIntent[] = ["buyer", "seller", "showing"];

export const TOOL_RESULT_SET_INTENT_SILENT =
  "SET_INTENT_SILENT: Intent recorded. Do not speak about routing, classification, or missing fields.";

export const TOOL_RESULT_LOOKUP_SILENT =
  "LOOKUP_SILENT: CRM lookup finished. Do not describe lookup results to the caller unless confirming one detail.";

export const TOOL_RESULT_INTAKE_ACTIVE_SILENT =
  "INTAKE_ACTIVE_SILENT: Intake task owns speech. Do not speak — questions are handled by field collection.";

export const TOOL_RESULT_INTAKE_COMPLETE_SILENT =
  "INTAKE_COMPLETE_SILENT_HANDOFF: Call list_available_slots immediately. " +
  "Do not speak a summary, transition line, or intake recap.";

export function intakeFieldsPending(userData: FrontDeskUserData): boolean {
  if (!userData.callState?.primaryIntent) return false;
  const intents: RealEstateIntent[] = [];
  if (userData.callState.primaryIntent) intents.push(userData.callState.primaryIntent);
  for (const secondary of userData.callState.secondaryIntents) {
    if (!intents.includes(secondary)) intents.push(secondary);
  }
  return (
    missingIntakeFields(
      intents,
      userData.callState.collectedFields,
      userData.realEstateCompiled,
    ).length > 0
  );
}

/** Interrupt stray root speech and run intake — one hop from set_intent to first field question. */
export async function startIntakeSequenceFromTools(
  session: AgentSession<FrontDeskUserData>,
): Promise<{ complete: boolean }> {
  const ud = session.userData;
  if (ud.intakeSequenceActive) {
    await safeInterruptSession(session);
  }
  ud.intakeSequenceActive = true;
  try {
    await safeInterruptSession(session);
    return await runRealEstateIntakeTaskGroup({ session });
  } finally {
    ud.intakeSequenceActive = false;
  }
}

/** Fire-and-forget CRM lookup on ANI so the first buy/sell turn skips lookup_contact. */
export function prefetchCallerContactFromAni(session: AgentSession<FrontDeskUserData>): void {
  const ud = session.userData;
  const phone = ud.callerE164?.trim();
  if (!phone || !ud.callState) return;
  if (ud.callerContactPrefetched || ud.callState.contactId) return;
  ud.callerContactPrefetched = true;

  void (async () => {
    try {
      const result = await searchCrmContactsForVoice({
        workspaceId: ud.workspaceId,
        phone,
        limit: 3,
      });
      if (!result.matches.length || !ud.callState) return;
      const first = result.matches[0]!;
      ud.callState.contactName = first.displayName;
      const localContactId = parseLocalContactIdFromSafeId(first.safeId);
      if (localContactId) {
        ud.callState.contactId = localContactId;
      }
      if (first.displayName) {
        ud.callState.collectedFields = {
          ...ud.callState.collectedFields,
          name: ud.callState.collectedFields.name || first.displayName,
        };
      }
      if (first.email && !ud.callState.collectedFields.email) {
        ud.callState.collectedFields.email = first.email;
      }
      if (!ud.callState.collectedFields.callback_phone) {
        try {
          ud.callState.collectedFields.callback_phone = normalizeE164(phone);
        } catch {
          ud.callState.collectedFields.callback_phone = phone;
        }
      }
    } catch {
      // lookup is optional; intake still proceeds
    }
  })();
}
