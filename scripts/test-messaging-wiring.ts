/**
 * Mock-mode wiring test (no live Twilio). Requires DATABASE_URL.
 *
 *   npx tsx scripts/test-messaging-wiring.ts
 */
import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ||= "postgresql://postgres:postgres@127.0.0.1:5432/transovo_sms?schema=public";
process.env.APP_URL ||= "http://localhost:3000";
process.env.INTEGRATION_SECRET_KEY ||= "test-integration-secret-key";
// Ensure mock adapter (not live)
delete process.env.TWILIO_MODE;
delete process.env.MESSAGING_ADAPTER;

async function main() {
  const prisma = new PrismaClient();
  const failures: string[] = [];
  const ok = (label: string) => console.log(`✓ ${label}`);
  const fail = (label: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${label}: ${msg}`);
    console.error(`✗ ${label}: ${msg}`);
  };

  // Fresh workspace for isolation
  const workspace = await prisma.workspace.create({
    data: { name: "Wiring Test Co", slug: `wiring-test-${Date.now()}` },
  });
  const workspaceId = workspace.id;
  console.log(`workspace=${workspaceId}`);

  try {
    const { messagingOnboarding } = await import("../src/lib/messaging/service");
    const { processDueJobs } = await import("../src/lib/jobs/job-handlers");
    const { enrollContactInCampaign, validateBulkRecipients } = await import("../src/lib/campaigns/enroll-campaign");
    const { createIntegrationWebhook, processIncomingIntegrationWebhook } = await import(
      "../src/lib/integrations/webhook-process"
    );
    const { sendQuickSms } = await import("../src/lib/sms/send-quick");
    const { defaultSmsEmailSequence } = await import("../src/lib/campaigns/sequence-engine");
    const { mergeTemplate } = await import("../src/lib/messaging/template");

    // Template merge
    try {
      const merged = mergeTemplate("Hi {{name}} {{tracking_link}}", {
        name: "Jane",
        tracking_link: "https://x/r/abc",
      });
      if (!merged.includes("Jane") || !merged.includes("https://x/r/abc")) throw new Error(merged);
      ok("template merge");
    } catch (e) {
      fail("template merge", e);
    }

    // Registration start → business → use case → purchase → submit → ready
    let reg;
    try {
      reg = await messagingOnboarding.start(workspaceId);
      if (!reg.subaccountSid) throw new Error("missing subaccount");
      ok("start creates subaccount");
    } catch (e) {
      fail("start creates subaccount", e);
      throw e;
    }

    try {
      await messagingOnboarding.saveBusiness(workspaceId, {
        legalBusinessName: "Wiring Test Co LLC",
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
      ok("save_business");
    } catch (e) {
      fail("save_business", e);
    }

    try {
      await messagingOnboarding.saveUseCase(workspaceId, {
        useCase: "customer_care",
        useCaseDescription: "Appointment reminders and service updates for customers.",
        sampleMessages: [
          "Hi {{name}}, reminder for tomorrow. Reply STOP to opt out.",
          "Thanks for choosing Wiring Test. Reply STOP to unsubscribe.",
        ],
        optInDescription: "Customers opt in via website form and verbal consent.",
      });
      ok("save_use_case");
    } catch (e) {
      fail("save_use_case", e);
    }

    try {
      const numbers = await messagingOnboarding.searchNumbers(workspaceId, "415");
      if (!numbers.length) throw new Error("no numbers");
      reg = await messagingOnboarding.purchaseNumber(workspaceId, numbers[0].phoneNumber);
      if (!reg.phoneSid || !reg.phoneE164) throw new Error("purchase failed");
      ok("purchase_number");
    } catch (e) {
      fail("purchase_number", e);
    }

    try {
      reg = await messagingOnboarding.submit(workspaceId, true);
      if (!reg.ready && reg.overallStatus !== "ready") {
        // drain advance job
        await processDueJobs(10);
        reg = await messagingOnboarding.get(workspaceId);
      }
      if (!reg.ready) throw new Error(`not ready: ${reg.overallStatus} enabled=${reg.messagingEnabled}`);
      ok("submit → ready (mock)");
    } catch (e) {
      fail("submit → ready (mock)", e);
    }

    try {
      const test = await messagingOnboarding.sendTest(workspaceId, "+14155550999", "Wiring test {{ok}}");
      if (!test.result?.sid) throw new Error("no sid");
      ok("send_test");
    } catch (e) {
      fail("send_test", e);
    }

    try {
      const quick = await sendQuickSms({
        workspaceId,
        to: "+14155550888",
        body: "Hi {{name}}, leave a review {{tracking_link}}",
        customerName: "Maya Chen",
        destinationUrl: "https://example.com/review",
      });
      if (!quick.trackingToken) throw new Error("no tracking token");
      const stored = await prisma.message.findUnique({ where: { trackingToken: quick.trackingToken } });
      if (!stored) throw new Error("tracking token not persisted");
      if (!stored.body.includes("/r/")) throw new Error("body missing tracked url");
      ok("quick send + tracking persist");
    } catch (e) {
      fail("quick send + tracking persist", e);
    }

    // Campaign sequence + wait + drain
    let campaignId = "";
    try {
      const campaign = await prisma.campaign.create({
        data: {
          workspaceId,
          name: "Wiring Campaign",
          type: "Sequence",
          audience: "Test",
          body: "Hi {{name}}, please review us {{tracking_link}} Reply STOP to opt out.",
          status: "SENDING",
          sequenceJson: [
            { step_key: "sms_1", step_type: "send_sms", config: {} },
            { step_key: "wait_1m", step_type: "wait", config: { minutes: 1 } },
            { step_key: "end", step_type: "end", config: {} },
          ],
          successMode: "click",
        },
      });
      campaignId = campaign.id;

      const validation = await validateBulkRecipients(workspaceId, campaignId, [
        { phone: "+14155550701", displayName: "One" },
        { phone: "+14155550701", displayName: "Dupe" },
        { phone: "bad", displayName: "Bad" },
      ]);
      if (validation.accepted.length !== 1) throw new Error(`accepted=${validation.accepted.length}`);
      if (validation.rejected.length < 2) throw new Error(`rejected=${validation.rejected.length}`);

      const recipient = await enrollContactInCampaign({
        workspaceId,
        campaignId,
        phone: "+14155550701",
        displayName: "One",
      });

      const queued = await prisma.campaignMessage.findMany({ where: { recipientId: recipient.id } });
      if (!queued.length) throw new Error("no queued message after enroll");
      if (!queued[0].body.includes("/r/")) throw new Error("campaign body missing tracking link");
      if (!queued[0].trackingToken) throw new Error("missing tracking token");

      await processDueJobs(20);
      const sent = await prisma.campaignMessage.findUnique({ where: { id: queued[0].id } });
      if (sent?.status !== "sent") throw new Error(`expected sent got ${sent?.status}`);

      ok("campaign enroll + send via job drain");
    } catch (e) {
      fail("campaign enroll + send via job drain", e);
    }

    // send → end completes without click
    try {
      const campaign = await prisma.campaign.create({
        data: {
          workspaceId,
          name: "Send End Campaign",
          type: "Sequence",
          audience: "Test",
          body: "Bye {{tracking_link}}",
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
        phone: "+14155550702",
        displayName: "Ender",
      });
      await processDueJobs(20);
      const after = await prisma.campaignRecipient.findUnique({ where: { id: recipient.id } });
      if (after?.workflowStatus !== "completed") {
        throw new Error(`expected completed got ${after?.workflowStatus} step=${after?.currentStep}`);
      }
      ok("send → end completes recipient");
    } catch (e) {
      fail("send → end completes recipient", e);
    }

    // Click tracking completes recipient
    try {
      const msg = await prisma.campaignMessage.findFirst({
        where: { campaignId, status: "sent" },
      });
      if (!msg?.trackingToken) throw new Error("no message to click");
      const { GET } = await import("../src/app/r/[trackingToken]/route");
      const res = await GET(new Request("http://localhost/r/x"), {
        params: Promise.resolve({ trackingToken: msg.trackingToken }),
      });
      if (res.status < 300 || res.status >= 400) throw new Error(`redirect status ${res.status}`);
      const recipient = await prisma.campaignRecipient.findUnique({ where: { id: msg.recipientId } });
      if (recipient?.workflowStatus !== "completed") {
        throw new Error(`expected completed got ${recipient?.workflowStatus}`);
      }
      ok("click tracking completes recipient");
    } catch (e) {
      fail("click tracking completes recipient", e);
    }

    // STOP opts out future
    try {
      const campaign2 = await prisma.campaign.create({
        data: {
          workspaceId,
          name: "Stop Campaign",
          type: "Sequence",
          audience: "Test",
          body: "Hi {{tracking_link}}",
          status: "SENDING",
          sequenceJson: defaultSmsEmailSequence() as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });
      // Ensure phone number row matches To for inbound routing
      const regNow = await messagingOnboarding.get(workspaceId);
      await prisma.phoneNumber.upsert({
        where: { workspaceId_e164: { workspaceId, e164: regNow.phoneE164! } },
        create: {
          workspaceId,
          e164: regNow.phoneE164!,
          type: "Local",
          twilioSid: regNow.phoneSid,
          status: "Active",
        },
        update: { status: "Active" },
      });

      const recipient = await enrollContactInCampaign({
        workspaceId,
        campaignId: campaign2.id,
        phone: "+14155550777",
        displayName: "Stopper",
        sendDelayMinutes: 60, // waiting — STOP should cancel
      });

      const { POST } = await import("../src/app/api/twilio/inbound/route");
      const form = new FormData();
      form.set("From", "+14155550777");
      form.set("To", regNow.phoneE164!);
      form.set("Body", "STOP");
      await POST(new Request("http://localhost/api/twilio/inbound", { method: "POST", body: form }));

      const after = await prisma.campaignRecipient.findUnique({ where: { id: recipient.id } });
      if (after?.workflowStatus !== "opted_out") throw new Error(`got ${after?.workflowStatus}`);
      const suppressed = await prisma.suppression.findFirst({
        where: { workspaceId, phone: "+14155550777" },
      });
      if (!suppressed) throw new Error("suppression missing");
      ok("STOP opts out recipient + suppression");

      const helpForm = new FormData();
      helpForm.set("From", "+14155550778");
      helpForm.set("To", regNow.phoneE164!);
      helpForm.set("Body", "HELP");
      const helpRes = await POST(
        new Request("http://localhost/api/twilio/inbound", { method: "POST", body: helpForm }),
      );
      const helpXml = await helpRes.text();
      if (!/Message/.test(helpXml)) throw new Error(`HELP response unexpected: ${helpXml}`);
      ok("HELP replies with message");
    } catch (e) {
      fail("STOP/HELP inbound", e);
    }

    // Integration webhook enroll + idempotency
    try {
      const campaign3 = await prisma.campaign.create({
        data: {
          workspaceId,
          name: "Webhook Campaign",
          type: "Sequence",
          audience: "Zapier",
          body: "Thanks {{name}} {{tracking_link}}",
          status: "SENDING",
          sequenceJson: [
            { step_key: "sms_1", step_type: "send_sms", config: {} },
            { step_key: "end", step_type: "end", config: {} },
          ],
        },
      });
      const endpoint = await createIntegrationWebhook({
        workspaceId,
        name: "Job completed",
        campaignId: campaign3.id,
        sendDelayMinutes: 0,
      });
      const first = await processIncomingIntegrationWebhook(
        endpoint.token,
        { phone: "+14155550666", name: "Webhook User", id: "evt_1" },
        "evt_1",
      );
      const second = await processIncomingIntegrationWebhook(
        endpoint.token,
        { phone: "+14155550666", name: "Webhook User", id: "evt_1" },
        "evt_1",
      );
      if (!first.recipientId) throw new Error("no enroll");
      if (!second.duplicate) throw new Error("expected duplicate");
      ok("integration webhook enroll + idempotency");
    } catch (e) {
      fail("integration webhook enroll + idempotency", e);
    }

    // Pause / resume
    try {
      await messagingOnboarding.handleAction(workspaceId, "pause", {});
      const paused = await messagingOnboarding.get(workspaceId);
      if (!paused.paused || paused.messagingEnabled) throw new Error("pause failed");
      await messagingOnboarding.handleAction(workspaceId, "resume", {});
      const resumed = await messagingOnboarding.get(workspaceId);
      if (resumed.paused || !resumed.messagingEnabled) throw new Error("resume failed");
      ok("pause / resume");
    } catch (e) {
      fail("pause / resume", e);
    }
  } finally {
    // cleanup
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    await prisma.$disconnect();
  }

  console.log("\n---");
  if (failures.length) {
    console.error(`${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("All wiring checks passed (mock mode)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
