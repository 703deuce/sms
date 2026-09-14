#!/usr/bin/env npx tsx
import { loadLeadRecoveryConfig, saveLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  await saveLeadRecoveryConfig(WORKSPACE_ID, {
    enabled: true,
    globalMode: "STANDARD",
    intentPolicies: {
      BOOKING_REQUEST: {
        enabled: true,
        collect: ["NAME", "ADDRESS", "REASON"],
        actions: ["AI_BOOK"],
      },
      SERVICE_REQUEST: {
        enabled: true,
        collect: ["NAME", "ADDRESS", "REASON"],
        actions: ["AI_BOOK", "CUSTOMER_MESSAGE"],
        customerMessage: "Thanks — a few quick questions so we can help.",
      },
      AVAILABILITY_QUESTION: {
        enabled: true,
        collect: [],
        actions: ["AI_BOOK"],
      },
    },
    actionCapabilities: [
      "AI_BOOK",
      "CREATE_CALLBACK_REQUEST",
      "CUSTOMER_MESSAGE",
      "SEND_OWNER_SMS",
      "ESCALATE_HUMAN",
      "SUPPRESS_CONTACT",
    ],
  });
  const lr = await loadLeadRecoveryConfig(WORKSPACE_ID);
  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        enabled: lr.enabled,
        policyHealth: lr.policyHealth,
        bookingPolicy: lr.intentPolicies.BOOKING_REQUEST,
      },
      null,
      2,
    ),
  );
}

main();
