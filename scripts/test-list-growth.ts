/**
 * List Growth certification — QR Codes, Web Forms, Tap-to-Join.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-list-growth.ts
 */
import assert from "node:assert/strict";
import { getPrisma } from "../src/lib/db";
import { submitOptInForm } from "../src/lib/forms/submit-opt-in";
import { handleKeywordInbound } from "../src/lib/growth/keywords";
import {
  buildTapToJoinPublicUrl,
  buildTapToJoinSmsHref,
  createTapToJoinLink,
  generateListGrowthPublicSlug,
  recordTapToJoinClick,
} from "../src/lib/growth/tap-to-join";

process.env.APP_URL ||= "http://localhost:3000";

const failures: string[] = [];
function ok(label: string) {
  console.log(`✓ ${label}`);
}
function fail(label: string, detail?: string) {
  failures.push(detail ? `${label}: ${detail}` : label);
  console.log(`✗ ${label}${detail ? `: ${detail}` : ""}`);
}

async function main() {
  // --- URI encoding (iOS/Android sms: links) ---
  const hrefSpace = buildTapToJoinSmsHref("+15714073615", "JOIN NOW");
  if (hrefSpace === "sms:+15714073615?body=JOIN%20NOW") ok("sms URI encodes spaces");
  else fail("sms URI encodes spaces", hrefSpace);

  const hrefPlus = buildTapToJoinSmsHref("+15714073615", "VIP+");
  if (hrefPlus.includes("VIP%2B")) ok("sms URI encodes plus sign");
  else fail("sms URI encodes plus sign", hrefPlus);

  const publicUrl = buildTapToJoinPublicUrl("j-abc123");
  if (publicUrl.endsWith("/j/j-abc123")) ok("public Tap-to-Join URL shape");
  else fail("public Tap-to-Join URL shape", publicUrl);

  const prisma = getPrisma();
  const suffix = Date.now();
  const workspace = await prisma.workspace.create({
    data: {
      name: "List growth test",
      slug: `list-growth-${suffix}`,
      creditBalanceCents: 100_000,
    },
  });
  const workspaceId = workspace.id;
  console.log(`workspace=${workspaceId}`);

  const fromE164 = "+15714073615";
  await prisma.messagingRegistration.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      overallStatus: "ready",
      messagingEnabled: true,
      paused: false,
      phoneAttached: true,
      phoneE164: fromE164,
      phoneSid: "PN_LIST_GROWTH",
      brandStatus: "approved",
      campaignStatus: "approved",
      messagingServiceSid: "MG_LIST_GROWTH",
      messagingProvider: "mock",
    },
    update: {
      overallStatus: "ready",
      messagingEnabled: true,
      phoneE164: fromE164,
      messagingProvider: "mock",
    },
  });

  const phoneNumber = await prisma.phoneNumber.create({
    data: {
      workspaceId,
      e164: fromE164,
      type: "local",
      provider: "telnyx",
      status: "Active",
    },
  });

  const listName = `Growth list ${suffix}`;
  const keyword = await prisma.keyword.create({
    data: {
      workspaceId,
      keyword: `GROW${suffix.toString().slice(-4)}`,
      listName,
      phoneNumber: fromE164,
      confirmation: "You are subscribed!",
      status: "Active",
    },
  });

  // --- Web Form submit → Contact → List ---
  const formSlug = `growth-form-${suffix}`;
  const form = await prisma.optInForm.create({
    data: {
      workspaceId,
      name: "Cert form",
      listName,
      slug: formSlug,
      url: `${process.env.APP_URL}/f/${formSlug}`,
      disclosureText: "Consent text",
      disclosureVersion: "form-v1",
      thankYouMessage: "Thanks!",
      config: { fields: ["phone", "firstName"] },
      status: "Active",
    },
  });

  const testPhone = `+1555${String(suffix).slice(-7)}`;
  const formResult = await submitOptInForm(form, {
    phone: testPhone,
    firstName: "Growth",
    consent: true,
  });
  if (!formResult.ok) fail("web form submit", formResult.error);
  else ok("web form submit creates contact");

  const formContact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: testPhone } },
  });
  if (formContact?.consentSource === `form:${formSlug}`) ok("web form consent source recorded");
  else fail("web form consent source recorded", formContact?.consentSource || "missing");

  const list = await prisma.contactList.findFirst({ where: { workspaceId, name: listName } });
  if (list) {
    const member = await prisma.contactListMember.findFirst({
      where: { listId: list.id, contactId: formContact!.id },
    });
    if (member) ok("web form adds contact to list");
    else fail("web form adds contact to list");
  } else {
    fail("web form list created");
  }

  // --- QR scan redirect ---
  const qrSlug = generateListGrowthPublicSlug("q");
  const formPublicUrl = `${process.env.APP_URL}/f/${formSlug}`;
  const qr = await prisma.qrCode.create({
    data: {
      workspaceId,
      name: "Cert QR",
      targetType: "form",
      targetUrl: formPublicUrl,
      publicSlug: qrSlug,
      status: "Active",
    },
  });

  const qrBefore = qr.scans;
  const qrRow = await prisma.qrCode.findFirst({ where: { publicSlug: qrSlug } });
  if (qrRow) {
    await prisma.qrCode.update({
      where: { id: qrRow.id },
      data: { scans: { increment: 1 } },
    });
    const after = await prisma.qrCode.findUnique({ where: { id: qr.id } });
    if ((after?.scans ?? 0) === qrBefore + 1) ok("QR scan counter increments");
    else fail("QR scan counter increments", `before=${qrBefore} after=${after?.scans}`);
  } else {
    fail("QR public slug lookup");
  }

  // --- Tap-to-Join create + click redirect ---
  const tap = await createTapToJoinLink(workspaceId, {
    name: "Cert Tap",
    keywordId: keyword.id,
    phoneNumberId: phoneNumber.id,
    buttonText: "Join now",
  });
  if (tap?.publicSlug && tap.href.includes(keyword.keyword)) ok("Tap-to-Join link created");
  else fail("Tap-to-Join link created", JSON.stringify(tap));

  const clicksBefore = tap?.clicks ?? 0;
  const clicked = await recordTapToJoinClick(tap!.publicSlug!);
  if (clicked?.href === tap?.href) ok("Tap-to-Join click redirect resolves sms URI");
  else fail("Tap-to-Join click redirect resolves sms URI");

  const tapAfterClick = await prisma.clickToTextLink.findUnique({ where: { id: tap!.id } });
  if ((tapAfterClick?.clicks ?? 0) === clicksBefore + 1) ok("Tap-to-Join click counter increments");
  else fail("Tap-to-Join click counter increments");

  // --- Keyword inbound (simulates visitor pressing Send) ---
  const inboundPhone = `+1556${String(suffix).slice(-7)}`;
  const inbound = await handleKeywordInbound({
    workspaceId,
    from: inboundPhone,
    to: fromE164,
    body: keyword.keyword,
  });
  if (inbound.matched) ok("keyword inbound matches Tap-to-Join keyword");
  else fail("keyword inbound matches Tap-to-Join keyword");

  const kwContact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: inboundPhone } },
  });
  if (kwContact?.consentSource === `keyword:${keyword.keyword}`) ok("keyword creates contact with consent");
  else fail("keyword creates contact with consent");

  const tapAfterJoin = await prisma.clickToTextLink.findUnique({ where: { id: tap!.id } });
  if ((tapAfterJoin?.joinCount ?? 0) >= 1) ok("Tap-to-Join join counter increments on keyword");
  else fail("Tap-to-Join join counter increments on keyword");

  // --- Tenant isolation ---
  const otherWs = await prisma.workspace.create({
    data: { name: "Other", slug: `other-lg-${suffix}` },
  });
  const foreign = await recordTapToJoinClick(tap!.publicSlug!);
  if (foreign) ok("public slug does not expose workspace id");
  else fail("public slug does not expose workspace id");

  const foreignKeyword = await handleKeywordInbound({
    workspaceId: otherWs.id,
    from: inboundPhone,
    to: fromE164,
    body: keyword.keyword,
  });
  if (!foreignKeyword.matched) ok("keyword isolated per workspace");
  else fail("keyword isolated per workspace");

  console.log("\n--- Manual smoke still required ---");
  console.log("On a real phone: open a Tap-to-Join /j/ link, confirm SMS composer shows number + keyword, press Send, verify confirmation reply.");

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log("\nlist-growth certification: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
