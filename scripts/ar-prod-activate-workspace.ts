/**
 * Production: activate Appointment Reminders + ensure AI reschedule mode for live SMS test.
 * Does NOT send SMS.
 *
 *   WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-prod-activate-workspace.ts
 */
import { getPrisma } from "../src/lib/db";
import {
  evaluateAppointmentRemindersSetupReadiness,
  loadAppointmentRemindersActivation,
  saveAppointmentRemindersActivation,
} from "../src/lib/appointment-reminders/activation";
import { loadAppointmentPlatformConfig, saveAppointmentPlatformConfig } from "../src/lib/appointments/settings";
import { resolveAiReschedulerConfig } from "../src/lib/appointment-reminders/ai-rescheduler/types";
import { resolveCanonicalMctbPlatformSender } from "../src/lib/mctb/messaging/platform-sender-config";
import { resolveAppointmentOutboundSmsRoute } from "../src/lib/appointments/sms-sender";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const EMAIL = (process.env.EMAIL || "whywriteit@gmail.com").toLowerCase();
const SET_AI_MODE = process.env.SET_AI_MODE !== "0";

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${EMAIL}`);

  const member = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId: WORKSPACE_ID },
    select: { workspaceId: true },
  });
  if (!member) {
    const any = await prisma.membership.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
    });
    if (!any) throw new Error("No workspace membership for user");
    console.warn("User not on", WORKSPACE_ID, "— using", any.workspaceId);
  }
  const workspaceId = member?.workspaceId || WORKSPACE_ID;

  const before = await loadAppointmentRemindersActivation(workspaceId);
  const readiness = await evaluateAppointmentRemindersSetupReadiness(workspaceId);
  console.log("readiness_before", readiness);

  const activation = await saveAppointmentRemindersActivation(workspaceId, {
    activatedAt: before.activatedAt || new Date().toISOString(),
    activatedByUserId: before.activatedByUserId || user.id,
  });
  console.log("activation_after", activation);

  if (SET_AI_MODE) {
    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const ar = resolveAiReschedulerConfig(platform);
    if (ar.mode !== "ai") {
      await saveAppointmentPlatformConfig(workspaceId, {
        aiRescheduler: {
          ...ar,
          mode: "ai",
          approval: ar.approval || "automatic",
        },
      });
      console.log("ai_rescheduler_patched", { mode: "ai", approval: ar.approval || "automatic" });
    } else {
      console.log("ai_rescheduler_already", ar);
    }
  }

  const platformSender = await resolveCanonicalMctbPlatformSender();
  const route = await resolveAppointmentOutboundSmsRoute(workspaceId);
  console.log("platform_sender", {
    mctbPlatformE164: platformSender?.e164 ?? null,
    appointmentRouteE164: route?.fromE164 ?? null,
  });

  const after = await evaluateAppointmentRemindersSetupReadiness(workspaceId);
  console.log("readiness_after", { activated: after.activated, blockers: after.blockers });
  console.log("\nDone. No SMS sent. Use production reminder send only after deploy has platform-sender fix.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
