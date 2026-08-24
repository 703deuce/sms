import { buildPhoneMenuDraftFromDestinations } from "@/lib/smart-routing/ai/draft-helpers";
import { updateFlowDraft, publishFlow } from "@/lib/smart-routing/flow-service";
import { getPrisma } from "@/lib/db";

async function main() {
  const ws = "ws_e2e_test_cmt7hvpy";
  const flowId = process.argv[2] || "cmt7ii6nc421k19386t101g4y";
  const draft = buildPhoneMenuDraftFromDestinations({
    greetingText:
      "Thank you for calling. Press 1 for Sales. Press 2 for Support. Press 3 to leave a voicemail.",
    menuOptions: [
      {
        digit: "1",
        label: "Sales",
        destination: { id: "d1", label: "Sales", phoneNumber: "+15551234567" },
      },
      {
        digit: "2",
        label: "Support",
        destination: { id: "d2", label: "Support", phoneNumber: "+15559876543" },
      },
    ],
  });
  draft.greeting = { source: "telnyx_tts", text: draft.greeting?.text };
  await updateFlowDraft(ws, flowId, { draftConfig: draft });
  const row = await getPrisma().smartRoutingFlow.findUnique({ where: { id: flowId } });
  const transfers = (
    (row?.draftConfigJson as { nodes?: Array<{ type: string; config: unknown }> })?.nodes || []
  ).filter((n) => n.type === "TRANSFER_EXTERNAL");
  console.log("transfers saved", transfers.map((t) => t.config));
  const v = await publishFlow(ws, flowId, "sr-e2e");
  console.log("published version", v.versionNumber);
}

void main();
