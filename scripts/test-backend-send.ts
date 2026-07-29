/**
 * Backend send-pipeline test in TEST mode (Twilio test credentials + magic number).
 *
 * Proves: registration → ready (mock A2P) → ready gate → message row → real Twilio
 * Messages API call (simulated) → status recorded, for both one-off quick sends and
 * campaign enroll + worker drain, plus magic-number failure handling.
 *
 * Requires:
 *   - Supabase env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) with schema applied
 *     (run supabase/add-timestamps.sql if you see PGRST204 "updatedAt" errors).
 *   - TWILIO_TEST_ACCOUNT_SID + TWILIO_TEST_AUTH_TOKEN (Twilio Console → Test credentials).
 *
 *   npx tsx scripts/test-backend-send.ts
 */

// Force test mode BEFORE importing app modules that read these at import time.
process.env.TWILIO_MODE = "test";
process.env.MESSAGING_ADAPTER = "test";
process.env.INTEGRATION_SECRET_KEY ||= "test-integration-secret-key";

import { getPrisma } from "../src/lib/db";
import { getMessagingMode, getTwilioTestCredentials, getTestFromNumber } from "../src/lib/messaging/twilio-config";

const failures: string[] = [];
const ok = (label: string, extra = "") => console.log(`✓ ${label}${extra ? " — " + extra : ""}`);
const fail = (label: string, err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  failures.push(`${label}: ${msg}`);
  console.error(`✗ ${label}: ${msg}`);
};

async function main() {
  console.log(`messaging mode = ${getMessagingMode()} (expected "test")`);
  const { accountSid, authToken } = getTwilioTestCredentials();
  if (!accountSid || !authToken) {
    console.error(
      "\nMissing TWILIO_TEST_ACCOUNT_SID / TWILIO_TEST_AUTH_TOKEN.\n" +
        "Add them as secrets (Twilio Console → Account → API keys & tokens → Test credentials), then re-run.",
    );
    process.exit(2);
  }
  console.log(`test creds present (sid ${accountSid.slice(0, 4)}…), from = ${getTestFromNumber()}`);

  const prisma = getPrisma();
  const { messagingOnboarding } = await import("../src/lib/messaging/service");
  const { processDueJobs } = await import("../src/lib/jobs/job-handlers");
  const { enrollContactInCampaign } = await import("../src/lib/campaigns/enroll-campaign");
  const { sendQuickSms } = await import("../src/lib/sms/send-quick");

  const workspace = await prisma.workspace.create({
    data: { name: "Backend Send Test", slug: `backend-send-${Date.now()}` },
  });
  const workspaceId = workspace.id;
  console.log(`workspace=${workspaceId}`);

  try {
    // Drive registration to ready via the mock adapter (no real ISV needed in test mode).
    try {
      await messagingOnboarding.start(workspaceId);
      await messagingOnboarding.saveBusiness(workspaceId, {
        legalBusinessName: "Backend Send Test LLC",
        businessType: "llc",
        businessIndustry: "professional_services",
        businessRegistrationId: "12-3456789",
        websiteUrl: "https://example.com",
        street: "1 Main St",
        city: "San Francisco",
        region: "CA",
        postalCode: "94105",
        contactFirstName: "Alex",
        contactLastName: "Rivera",
        contactEmail: "alex@example.com",
        contactPhone: "+14155550199",
      });
      await messagingOnboarding.saveUseCase(workspaceId, {
        useCase: "customer_care",
        useCaseDescription: "Appointment reminders and service updates for customers.",
        sampleMessages: ["Hi {{name}}, reminder for tomorrow. Reply STOP to opt out."],
        optInDescription: "Customers opt in via website form and verbal consent.",
      });
      const numbers = await messagingOnboarding.searchNumbers(workspaceId, "415");
      await messagingOnboarding.purchaseNumber(workspaceId, numbers[0].phoneNumber);
      let reg = await messagingOnboarding.submit(workspaceId, true);
      if (!reg.ready) {
        await processDueJobs(10);
        reg = await messagingOnboarding.get(workspaceId);
      }
      if (!reg.ready) throw new Error(`not ready: ${reg.overallStatus}`);
      ok("registration reached ready (mock A2P)");
    } catch (e) {
      fail("registration reached ready", e);
      throw e;
    }

    // Happy path: quick send hits the real Twilio Messages API (test creds → simulated).
    try {
      const res = await sendQuickSms({
        workspaceId,
        to: "+15005550006",
        body: "Transovo backend test — hello from test mode",
      });
      if (!res.sid || !/^SM/.test(res.sid)) throw new Error(`unexpected sid: ${res.sid}`);
      const stored = await prisma.message.findUnique({ where: { id: res.messageId! } });
      if (!stored) throw new Error("message row not persisted");
      if (stored.providerId !== res.sid) throw new Error(`providerId mismatch: ${stored.providerId}`);
      ok("quick send via Twilio test creds", `sid=${res.sid} status=${res.status} dbStatus=${stored.status}`);
    } catch (e) {
      fail("quick send via Twilio test creds", e);
    }

    // Failure path: magic invalid number → Twilio rejects → pipeline records failure.
    try {
      let threw = false;
      try {
        await sendQuickSms({ workspaceId, to: "+15005550001", body: "should fail" });
      } catch {
        threw = true;
      }
      if (!threw) throw new Error("expected send to a magic invalid number to fail");
      const failed = await prisma.message.findFirst({
        where: { workspaceId, to: "+15005550001" },
        orderBy: { createdAt: "desc" },
      });
      if (failed?.status !== "failed") throw new Error(`expected failed row, got ${failed?.status}`);
      ok("invalid magic number recorded as failed", "Twilio error handled");
    } catch (e) {
      fail("invalid magic number handling", e);
    }

    // Campaign enroll + worker drain → send through test creds.
    try {
      const campaign = await prisma.campaign.create({
        data: {
          workspaceId,
          name: "Backend Send Campaign",
          type: "Sequence",
          audience: "Test",
          body: "Hi {{name}}, quick note {{tracking_link}} Reply STOP to opt out.",
          status: "SENDING",
          sequenceJson: [
            { step_key: "sms_1", step_type: "send_sms", config: {} },
            { step_key: "end", step_type: "end", config: {} },
          ],
          successMode: "manual",
        },
      });
      const recipient = await enrollContactInCampaign({
        workspaceId,
        campaignId: campaign.id,
        phone: "+15005550006",
        displayName: "Test Recipient",
      });
      const queued = await prisma.campaignMessage.findMany({ where: { recipientId: recipient.id } });
      if (!queued.length) throw new Error("no queued campaign message after enroll");
      await processDueJobs(20);
      const sent = await prisma.campaignMessage.findUnique({ where: { id: queued[0].id } });
      if (sent?.status !== "sent") throw new Error(`expected sent, got ${sent?.status} (${sent?.error})`);
      if (!/^SM/.test(sent.providerId || "")) throw new Error(`expected Twilio SID, got ${sent?.providerId}`);
      ok("campaign enroll + drain sent via test creds", `sid=${sent.providerId}`);
    } catch (e) {
      fail("campaign enroll + drain", e);
    }
  } finally {
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
  }

  console.log("\n---");
  if (failures.length) {
    console.error(`${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("All backend send-pipeline checks passed (test mode)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
