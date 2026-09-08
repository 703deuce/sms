/**
 * Seed stable workspace for Appointments + MCTB browser certification.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/seed-appointments-mctb-browser-cert.ts
 */
import { hash } from "bcryptjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPrisma } from "../src/lib/db";
import {
  bootstrapAppointmentsMctbBrowserCertWorkspace,
  CERT_APPOINTMENT_TYPE_NAME,
  CERT_BROWSER_EMAIL,
  CERT_WORKSPACE_SLUG,
} from "../src/lib/cert/appointments-mctb-browser-bootstrap";

const CERT_PASSWORD = "ApptMctbBrowserCert_v1!";

async function main() {
  const prisma = getPrisma();
  const passwordHash = await hash(CERT_PASSWORD, 10);

  let user = await prisma.user.findUnique({ where: { email: CERT_BROWSER_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: CERT_BROWSER_EMAIL,
        name: "Appt MCTB Browser Cert",
        passwordHash,
        phone: "+15555550200",
        phoneVerifiedAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, name: "Appt MCTB Browser Cert" },
    });
  }

  let workspace = await prisma.workspace.findUnique({ where: { slug: CERT_WORKSPACE_SLUG } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Appt MCTB Browser Cert",
        slug: CERT_WORKSPACE_SLUG,
        type: "BUSINESS",
        ownerUserId: user.id,
        billingPlan: "trial",
        creditBalanceCents: 500_000,
        memberships: { create: { userId: user.id, role: "OWNER" } },
        messagingRegistration: { create: {} },
        workspaceLimits: {
          create: {
            limits: { dailyCap: 500, maxNumbers: 5, trialDays: 14, requireCard: false },
          },
        },
      },
    });
  } else {
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, workspaceId: workspace.id },
    });
    if (!membership) {
      await prisma.membership.create({
        data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
      });
    }
  }

  const bootstrap = await bootstrapAppointmentsMctbBrowserCertWorkspace(workspace.id);

  mkdirSync(join(process.cwd(), "artifacts/browser-cert"), { recursive: true });
  const creds = {
    email: CERT_BROWSER_EMAIL,
    password: CERT_PASSWORD,
    workspaceId: workspace.id,
    workspaceSlug: CERT_WORKSPACE_SLUG,
    appointmentTypeName: CERT_APPOINTMENT_TYPE_NAME,
    publicBookingSlug: bootstrap.publicBookingSlug,
  };
  writeFileSync(join(process.cwd(), "artifacts/browser-cert/credentials.json"), JSON.stringify(creds, null, 2));
  console.log("Seeded browser cert workspace:", CERT_BROWSER_EMAIL, workspace.id);
  console.log("  appointment type:", CERT_APPOINTMENT_TYPE_NAME);
  console.log("  public booking slug:", bootstrap.publicBookingSlug);
  console.log("  missed call fixture: yes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
