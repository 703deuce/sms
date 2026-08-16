import type { AgentSession } from "@livekit/agents";
import { buildReceptionistConversationRecap } from "@/lib/voice/receptionist/conversation-recap";
import type { ReceptionistCollectionPurpose } from "@/lib/voice/receptionist/field-collection-scope";
import type { FrontDeskUserData } from "../userdata";
import { injectAuthoritativeToolOutcome } from "../../tool-outcome-context";

/** Push full-call caller thread + saved fields into Realtime after task handoffs. */
export async function injectReceptionistConversationState(
  session: AgentSession<FrontDeskUserData>,
  purpose?: ReceptionistCollectionPurpose,
): Promise<void> {
  const ud = session.userData;
  const manifest = ud.receptionistCompiled?.fieldManifest;
  const recap = buildReceptionistConversationRecap({
    chatCtx: session.chatCtx,
    receptionistFields: ud.receptionistFields,
    fieldManifest: manifest,
    purpose,
  });
  await injectAuthoritativeToolOutcome(session, {
    headline: "CONVERSATION_STATE",
    detail: recap,
  });
}
