import dotenv from "dotenv";
import { runRealtorFullVerificationSuite } from "../src/lib/realtor/verification";

dotenv.config();

async function main() {
  const result = await runRealtorFullVerificationSuite();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
  const integration = result.suites.find((s) => s.name === "integration");
  if (integration?.skipped) {
    console.log(`integration skipped: ${integration.error || "no database"}`);
  }
  console.log("realtor full verification: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
