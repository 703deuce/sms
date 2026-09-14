#!/usr/bin/env npx tsx
/**
 * Live ws_1 profile: Lead Recovery ON (single MCTB SMS agent) + AI Booking provider wired for AI_BOOK.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-live-enable-lead-recovery.ts
 */
import { getPrisma } from "@/lib/db";
import { loadLeadRecoveryConfig, saveLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { evaluateMctbAiBookingReadiness } from "@/lib/mctb/ai-booking/readiness";
import { loadMctbAiBookingConfig, saveMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { listMctbAiBookingSchedulingTargets } from "@/lib/mctb/ai-booking/provider-targets";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function pickConnectedProvider(workspaceId: string) {
  const prisma = getPrisma();
  const connections = await prisma.integrationConnection.findMany({
    where: {
      workspaceId,
      status: "connected",
      provider: { in: ["microsoft", "calendly", "zoho"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  const row = connections[0];
  if (!row) return null;
  const provider =
    row.provider === "calendly" || row.provider === "zoho" || row.provider === "microsoft"
      ? row.provider
      : "microsoft";
  return { provider, providerConnectionId: row.id };
}

async function main() {
  const connected = await pickConnectedProvider(WORKSPACE_ID);
  if (connected) {
    const patch: Parameters<typeof saveMctbAiBookingConfig>[1] = {
      enabled: true,
      provider: connected.provider,
      providerConnectionId: connected.providerConnectionId,
    };
    const targets = await listMctbAiBookingSchedulingTargets(WORKSPACE_ID, connected.provider);
    const first = targets[0];
    if (first) {
      if (connected.provider === "calendly") {
        patch.eventTypeUri = first.id;
        patch.eventTypeId = first.id;
      } else {
        patch.calendarId = first.id;
      }
      patch.serviceName = first.label || patch.serviceName || "Consultation";
      if (typeof first.durationMinutes === "number") {
        patch.durationMinutes = first.durationMinutes;
      }
    }
    await saveMctbAiBookingConfig(WORKSPACE_ID, patch);
  } else {
    await saveMctbAiBookingConfig(WORKSPACE_ID, { enabled: true });
  }

  await saveLeadRecoveryConfig(WORKSPACE_ID, {
    enabled: true,
    globalMode: "STANDARD",
    enabledScenarios: {
      take_message: true,
      booking: true,
      emergencies: true,
      pricing: true,
      service_area: true,
      payments: false,
      existing_customer: true,
      general_faq: true,
    },
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
      SPECIFIC_TIME_REQUEST: {
        enabled: true,
        collect: [],
        actions: ["AI_BOOK"],
      },
    },
    actionCapabilities: [
      "AI_BOOK",
      "SEND_BOOKING_LINK",
      "CREATE_CALLBACK_REQUEST",
      "CUSTOMER_MESSAGE",
      "SEND_OWNER_SMS",
      "ESCALATE_HUMAN",
      "SUPPRESS_CONTACT",
    ],
  });

  const [lr, aiBooking, readiness] = await Promise.all([
    loadLeadRecoveryConfig(WORKSPACE_ID),
    loadMctbAiBookingConfig(WORKSPACE_ID),
    evaluateMctbAiBookingReadiness(WORKSPACE_ID),
  ]);

  console.log(
    JSON.stringify(
      {
        workspaceId: WORKSPACE_ID,
        leadRecovery: {
          enabled: lr.enabled,
          policyHealth: lr.policyHealth,
          bookingScenario: lr.enabledScenarios.booking,
          bookingPolicy: lr.intentPolicies.BOOKING_REQUEST,
        },
        aiBooking: {
          enabled: aiBooking.enabled,
          entitled: aiBooking.entitled,
          provider: aiBooking.provider,
          providerConnectionId: aiBooking.providerConnectionId,
        },
        readiness,
        connectedProviderFound: Boolean(connected),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
