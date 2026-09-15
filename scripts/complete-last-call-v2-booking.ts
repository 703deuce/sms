#!/usr/bin/env npx tsx
/**
 * Complete booking for the 2026-09-15 ~13:06 UTC PSTN call after intake gate blocked.
 */
import { executeVoiceV2SaveIntakeFields } from "../src/lib/voice-v2/intake/save-intake-fields";
import { executeVoiceV2BookOfferedSlot } from "../src/lib/voice-v2/book-offered-slot";
import { getPrisma } from "../src/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const CALL_CONTROL_ID =
  process.env.CALL_CONTROL_ID ||
  "v3:a074SHPPff_JIrty5FVNe4mRp23RwchF7CUVwMsmfkX8PHK_db8HgQ";
const OFFER_SET_ID = process.env.OFFER_SET_ID || "v2offer_cmu2oq28v262p0e391p341n42";
const SLOT_ID = process.env.SLOT_ID || "slot_cee0b8667879e278";

async function main() {
  const save = await executeVoiceV2SaveIntakeFields(
    {
      call_id: CALL_CONTROL_ID,
      fields: {
        name: process.env.RECOVERY_INTAKE_NAME || "Anthony Johnson",
        service_reason: process.env.RECOVERY_INTAKE_SERVICE || "kitchen leak",
        ...(process.env.RECOVERY_INTAKE_PHONE
          ? { phone: process.env.RECOVERY_INTAKE_PHONE }
          : {}),
      },
    },
    WORKSPACE_ID,
    AGENT_ID,
  );
  console.log("INTAKE_SAVE:", JSON.stringify(save, null, 2));

  const book = await executeVoiceV2BookOfferedSlot(
    {
      call_id: CALL_CONTROL_ID,
      offer_set_id: OFFER_SET_ID,
      selected_slot_id: SLOT_ID,
      tool_invocation_id: "book-slot-recovery-1",
    },
    WORKSPACE_ID,
    { agentId: AGENT_ID },
  );
  console.log("BOOK:", JSON.stringify(book, null, 2));

  if (book.status === "BOOKING_CONFIRMED") {
    const prisma = getPrisma();
    const appt = await prisma.voiceAppointment.findFirst({
      where: { workspaceId: WORKSPACE_ID, externalId: book.event_id },
      select: { id: true, startsAt: true, timezone: true, metadata: true },
    });
    console.log("APPOINTMENT:", appt);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
