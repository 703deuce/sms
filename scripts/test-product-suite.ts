/**
 * Product suite wiring test (link clicks, surveys, media, validation, widgets).
 *
 *   npm run test:product-suite
 */
import { getPrisma } from "../src/lib/db";

process.env.NEXT_PUBLIC_SUPABASE_URL ||= process.env.SUPABASE_URL || "";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "";
process.env.APP_URL ||= "http://localhost:3000";

async function main() {
  const prisma = getPrisma();
  const failures: string[] = [];
  const ok = (label: string) => console.log(`✓ ${label}`);
  const fail = (label: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${label}: ${msg}`);
    console.error(`✗ ${label}: ${msg}`);
  };

  const workspace = await prisma.workspace.create({
    data: { name: "Product Suite Test", slug: `product-suite-${Date.now()}` },
  });
  const workspaceId = workspace.id;

  try {
    const { recordLinkClick, loadLinkClickReport } = await import("../src/lib/links/click-events");
    const { composeCampaignMessages } = await import("../src/lib/ai/campaign-composer");
    const { analyzeInboxThread } = await import("../src/lib/ai/inbox-assistant");
    const { validateWorkspaceContacts } = await import("../src/lib/contacts/validate-list");
    const { buildVCard } = await import("../src/lib/contact-cards/vcard");

    try {
      await recordLinkClick({
        workspaceId,
        trackingToken: "tok-test",
        phone: "+15551234567",
        destinationUrl: "https://example.com",
      });
      const report = await loadLinkClickReport(workspaceId, 7);
      if (report.totalClicks < 1) throw new Error("no clicks");
      ok("link click events");
    } catch (e) {
      fail("link click events", e);
    }

    try {
      const composed = await composeCampaignMessages({ goal: "book appointments", tone: "friendly" });
      if (!composed.message.includes("STOP")) throw new Error("missing compliance");
      ok("campaign composer");
    } catch (e) {
      fail("campaign composer", e);
    }

    try {
      const assist = await analyzeInboxThread(
        [{ direction: "inbound", body: "I need to book an appointment today" }],
        "Jane",
      );
      if (assist.intent !== "booking") throw new Error(JSON.stringify(assist));
      ok("inbox assistant");
    } catch (e) {
      fail("inbox assistant", e);
    }

    try {
      const survey = await prisma.survey.create({
        data: {
          workspaceId,
          name: "Test poll",
          surveyType: "poll",
          questions: [{ id: "q1", text: "Rate us", type: "choice" }],
          status: "active",
        },
      });
      await prisma.surveyResponse.create({
        data: {
          workspaceId,
          surveyId: survey.id,
          phone: "+15551234567",
          answers: { q1: "Great" },
        },
      });
      const count = await prisma.surveyResponse.count({ where: { surveyId: survey.id } });
      if (count !== 1) throw new Error("response missing");
      ok("surveys");
    } catch (e) {
      fail("surveys", e);
    }

    try {
      const asset = await prisma.mediaAsset.create({
        data: {
          workspaceId,
          name: "Test image",
          storageUrl: "https://example.com/img.png",
          assetType: "image",
        },
      });
      if (!asset.id) throw new Error("no asset");
      ok("media assets");
    } catch (e) {
      fail("media assets", e);
    }

    try {
      const widget = await prisma.growWidget.create({
        data: {
          workspaceId,
          name: "Popup",
          slug: `popup-${Date.now()}`,
          widgetType: "popup",
          status: "active",
        },
      });
      if (!widget.slug) throw new Error("no widget");
      ok("grow widgets");
    } catch (e) {
      fail("grow widgets", e);
    }

    try {
      const card = await prisma.contactCardProfile.create({
        data: {
          workspaceId,
          businessName: "Test Co",
          phone: "+15551234567",
        },
      });
      const vcard = buildVCard(card);
      if (!vcard.includes("FN:Test Co")) throw new Error(vcard);
      ok("contact cards");
    } catch (e) {
      fail("contact cards", e);
    }

    try {
      const result = await validateWorkspaceContacts(workspaceId);
      if (typeof result.total !== "number") throw new Error(JSON.stringify(result));
      ok("contact validation");
    } catch (e) {
      fail("contact validation", e);
    }
  } finally {
    await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
  }

  if (failures.length) {
    console.error(`\n${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll product suite checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
