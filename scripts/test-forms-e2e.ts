/**
 * Forms E2E verification (create, submit, consent, suppression).
 * Run: npx tsx scripts/test-forms-e2e.ts
 */
import { getPrisma } from "../src/lib/db";
import { submitOptInForm } from "../src/lib/forms/submit-opt-in";
import { parseFormConfig } from "../src/lib/forms/types";

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
  const prisma = getPrisma();
  const workspace = await prisma.workspace.create({
    data: { name: "Forms E2E", slug: `forms-e2e-${Date.now()}` },
  });
  const workspaceId = workspace.id;
  console.log(`workspace=${workspaceId}`);

  const slug = `test-form-${Date.now()}`;
  const form = await prisma.optInForm.create({
    data: {
      workspaceId,
      name: "E2E Form",
      listName: "E2E subscribers",
      slug,
      url: `http://localhost:3000/f/${slug}`,
      disclosureText: "Test disclosure",
      disclosureVersion: "form-v1",
      thankYouMessage: "Thanks E2E!",
      config: {
        fields: ["firstName", "phone", "email"],
        branding: { primaryColor: "#111827", theme: "light" },
        headline: "Join us",
      },
      status: "Active",
    },
  });

  const config = parseFormConfig(form.config);
  if (config.fields?.includes("email")) ok("config fields parsed");
  else fail("config fields parsed");

  const phone = `+1415555${String(Date.now()).slice(-4)}`;
  const result = await submitOptInForm(form, {
    phone,
    firstName: "Test",
    email: "test@example.com",
    consent: true,
    ip: "127.0.0.1",
    userAgent: "forms-e2e",
    embedHost: "example.com",
  });

  if (result.ok) ok("submit succeeded");
  else fail("submit succeeded", result.error);

  const contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone } },
  });
  if (contact?.firstName === "Test") ok("contact created");
  else fail("contact created");

  const consent = await prisma.consentRecord.findFirst({
    where: { workspaceId, phone },
  });
  if (consent?.source === `form:${slug}`) ok("consent record");
  else fail("consent record");

  const submission = await prisma.formSubmission.findFirst({
    where: { formId: form.id, phone },
  });
  if (submission?.embedHost === "example.com") ok("form submission row");
  else fail("form submission row");

  const updatedForm = await prisma.optInForm.findUnique({ where: { id: form.id } });
  if (updatedForm && updatedForm.submissions >= 1) ok("submission counter");
  else fail("submission counter");

  await prisma.suppression.create({
    data: {
      workspaceId,
      phone,
      suppressionKey: `p:${phone}`,
      reason: "opt_out",
    },
  });

  const blocked = await submitOptInForm(form, {
    phone,
    consent: true,
  });
  if (!blocked.ok) ok("suppression blocks resubmit");
  else fail("suppression blocks resubmit");

  const noConsent = await submitOptInForm(form, {
    phone: `+1415555${String(Date.now() + 1).slice(-4)}`,
    consent: false,
  });
  if (!noConsent.ok) ok("consent required");
  else fail("consent required");

  // cleanup
  await prisma.formSubmission.deleteMany({ where: { formId: form.id } });
  await prisma.consentRecord.deleteMany({ where: { workspaceId } });
  const lists = await prisma.contactList.findMany({ where: { workspaceId } });
  for (const list of lists) {
    await prisma.contactListMember.deleteMany({ where: { listId: list.id } });
  }
  await prisma.contactList.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.suppression.deleteMany({ where: { workspaceId } });
  await prisma.optInForm.delete({ where: { id: form.id } });
  await prisma.workspace.delete({ where: { id: workspaceId } });

  console.log("");
  if (failures.length) {
    console.error(`FAILED (${failures.length})`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log("All forms E2E checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
