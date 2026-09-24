/**
 * Safe production DB fingerprint (no credentials).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-production-db-fingerprint.ts
 */
import { getPrisma } from "@/lib/db";

function safeDatabaseHost(url: string | undefined): string {
  if (!url) return "missing";
  try {
    const u = new URL(url.replace(/^postgres(ql)?:\/\//, "https://"));
    const host = u.hostname || "unknown";
    if (host.length <= 8) return host;
    return `${host.slice(0, 4)}…${host.slice(-4)}`;
  } catch {
    return "unparseable";
  }
}

async function main() {
  const prisma = getPrisma();
  const url = process.env.DATABASE_URL;
  const [workspaces, phoneNumbers, registrations, twilioPhones, telnyxPhones] =
    await Promise.all([
      prisma.workspace.count(),
      prisma.phoneNumber.count({ where: { status: "Active" } }),
      prisma.messagingRegistration.count(),
      prisma.phoneNumber.count({ where: { status: "Active", provider: "twilio" } }),
      prisma.phoneNumber.count({ where: { status: "Active", provider: "telnyx" } }),
    ]);

  const twilioSubaccounts = await prisma.messagingRegistration.count({
    where: { messagingProvider: "twilio", subaccountSid: { not: null } },
  });

  console.log(
    JSON.stringify(
      {
        environment: process.env.NODE_ENV || "unknown",
        appUrlConfigured: Boolean(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL),
        databaseHostFingerprint: safeDatabaseHost(url),
        databaseName: url ? safeDatabaseHost(url) : null,
        workspaceCount: workspaces,
        activePhoneNumberCount: phoneNumbers,
        messagingRegistrationCount: registrations,
        activeTwilioPhoneNumberCount: twilioPhones,
        activeTelnyxPhoneNumberCount: telnyxPhones,
        twilioRegistrationsWithSubaccountSid: twilioSubaccounts,
        compareWithProductionRuntime:
          "Match APP_URL/DATABASE_URL on Coolify with this agent env to confirm same DB.",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
