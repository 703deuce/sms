/**
 * Reset the Alex harbor-home test account password in the connected DATABASE_URL DB.
 * Run: npx tsx scripts/reset-alex-test-password.ts
 * Optional: RESET_PASSWORD=yourpassword npx tsx scripts/reset-alex-test-password.ts
 */
import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/db";

const EMAIL = (process.env.RESET_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const NEW_PASSWORD = process.env.RESET_PASSWORD || "demo1234";

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error(`No user found for ${EMAIL}`);
    process.exit(1);
  }

  const passwordHash = await hash(NEW_PASSWORD, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      totpEnabled: false,
      totpSecretEnc: null,
      totpBackupCodes: [],
      deletionRequestedAt: null,
    },
  });

  console.log(`Password reset for ${EMAIL}`);
  console.log(`Password: ${NEW_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
