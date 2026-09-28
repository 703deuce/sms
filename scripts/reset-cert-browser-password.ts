import { hash } from "bcryptjs";
import { getPrisma } from "../src/lib/db";
import { CERT_BROWSER_EMAIL } from "../src/lib/cert/appointments-mctb-browser-bootstrap";

const PASSWORD = process.env.CERT_BROWSER_PASSWORD?.trim() || "ApptMctbBrowserCert_v1!";

async function main() {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email: CERT_BROWSER_EMAIL } });
  if (!user) {
    console.error(`No user ${CERT_BROWSER_EMAIL}`);
    process.exit(1);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hash(PASSWORD, 10) },
  });
  console.log(`reset-cert-browser-password: updated ${CERT_BROWSER_EMAIL}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
