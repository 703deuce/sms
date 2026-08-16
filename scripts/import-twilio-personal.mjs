/**
 * Import a Twilio number into a Personal workspace using local Twilio creds + DATABASE_URL.
 * Use when production /api/numbers/sync-twilio fails (e.g. Coolify Twilio auth mismatch).
 *
 *   WORKSPACE_ID=cmsu... TWILIO_E164=+1... npx tsx scripts/import-twilio-personal.mjs
 */
import dotenv from "dotenv";

dotenv.config();

const { getPrisma } = await import("../src/lib/db.ts");
const { importTwilioNumbersIntoWorkspace } = await import(
  "../src/lib/numbers/twilio-number-import.ts"
);

const workspaceId =
  process.env.WORKSPACE_ID || process.env.PERSONAL_WORKSPACE_ID || "cmsu9n9zq3y57165y5c2x3m59";
const e164 =
  (process.env.TWILIO_E164 || process.env.TWILIO_FROM_NUMBER || "+18665779653").trim();
const email = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error("user not found:", email);
    process.exit(1);
  }

  console.log(`Importing ${e164} into workspace ${workspaceId} for ${email}`);

  const result = await importTwilioNumbersIntoWorkspace({
    workspaceId,
    userId: user.id,
    e164s: [e164],
    transferFromParent: true,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.imported.length === 0 && result.twilioCount > 0) {
    const { listTwilioOwnedNumbers } = await import("../src/lib/numbers/twilio-number-import.ts");
    const owned = await listTwilioOwnedNumbers(workspaceId);
    console.log("owned in Twilio:", owned.map((n) => n.e164));
    console.log("requested e164:", e164);
  }

  const rows = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { id: true, e164: true, provider: true, twilioSid: true },
  });
  console.log("workspace numbers:", rows);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
