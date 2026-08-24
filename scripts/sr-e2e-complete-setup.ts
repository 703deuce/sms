/**
 * Complete SR E2E setup for a purchased number (API path mirroring UI actions).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/sr-e2e-complete-setup.ts --phone-number-id <id>
 */
import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { setCallHandlingMode } from "@/lib/numbers/call-handling-mode";
import { assignRoutingPhoneNumber } from "@/lib/smart-routing/number-provisioning";
import { createFlow, publishFlow, updateFlowDraft } from "@/lib/smart-routing/flow-service";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { templateForType } from "@/lib/smart-routing/templates";
import { buildPhoneMenuDraftFromDestinations } from "@/lib/smart-routing/ai/draft-helpers";
import type { DraftConfig } from "@/lib/smart-routing/types";

function arg(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const phoneNumberId = arg("--phone-number-id");
  if (!phoneNumberId) throw new Error("--phone-number-id required");

  const prisma = getPrisma();
  const row = await prisma.phoneNumber.findUnique({ where: { id: phoneNumberId } });
  if (!row) throw new Error("number not found");

  await grantWorkspaceProductFeature(row.workspaceId, "smart_routing", "active");
  await grantWorkspaceProductFeature(row.workspaceId, "mctb", "active");

  const tel = await telnyxRequest<{ data?: Array<{ id: string }> }>("/phone_numbers", {
    query: { "filter[phone_number]": row.e164 },
  });
  const providerNumberId = tel.data?.[0]?.id;
  if (!providerNumberId) throw new Error("Telnyx number not found");

  await prisma.phoneNumber.update({
    where: { id: phoneNumberId },
    data: { providerNumberId, provider: "telnyx" },
  });

  const { provisionPurchasedNumber } = await import("@/lib/phone/telnyx-dual-provision");
  await provisionPurchasedNumber({ workspaceId: row.workspaceId, phoneNumberId });

  await setCallHandlingMode({
    workspaceId: row.workspaceId,
    phoneNumberId,
    mode: "smart_routing",
  });
  await assignRoutingPhoneNumber(row.workspaceId, phoneNumberId);

  const draft: DraftConfig = buildPhoneMenuDraftFromDestinations({
    greetingText:
      "Thank you for calling. Press 1 for Sales. Press 2 for Support. Press 3 to leave a voicemail.",
    menuOptions: [
      {
        digit: "1",
        label: "Sales",
        destination: { id: "dest-sales", label: "Sales", phoneNumber: "+15551234567" },
      },
      {
        digit: "2",
        label: "Support",
        destination: { id: "dest-support", label: "Support", phoneNumber: "+15559876543" },
      },
    ],
  });
  draft.greeting = { source: "telnyx_tts", text: draft.greeting?.text };
  draft.menuOptions = [
    ...(draft.menuOptions ?? []),
    { digit: "3", label: "Voicemail", action: "voicemail", phoneNumber: "" },
  ];

  const flow = await createFlow(row.workspaceId, {
    name: "SR E2E Phone Menu",
    type: "phone_menu",
    createdBy: "sr-e2e-script",
  });

  await prisma.smartRoutingFlow.update({
    where: { id: flow.id },
    data: {
      assignedPhoneNumberId: phoneNumberId,
      businessNumberE164: row.e164,
      routingNumberE164: row.e164,
    },
  });

  await updateFlowDraft(row.workspaceId, flow.id, { draftConfig: draft });

  const version = await publishFlow(row.workspaceId, flow.id, "sr-e2e-script");

  console.log(
    JSON.stringify(
      {
        ok: true,
        e164: row.e164,
        phoneNumberId,
        workspaceId: row.workspaceId,
        providerNumberId,
        flowId: flow.id,
        versionNumber: version.versionNumber,
      },
      null,
      2,
    ),
  );
}

void main();
