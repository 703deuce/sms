import { runRealtorVerificationSuite } from "../src/lib/realtor/verification";

const result = runRealtorVerificationSuite();
if (!result.ok) {
  console.error(result);
  process.exit(1);
}
console.log("realtor verification suite: PASS");
