import { spawnSync } from "node:child_process";

const SUITES: Array<{ name: string; cmd: string }> = [
  { name: "livekit_architecture", cmd: "npx tsx scripts/test-livekit-architecture-gate.ts" },
  { name: "typescript", cmd: "npx tsc --noEmit" },
  { name: "realtor_full", cmd: "npx tsx scripts/test-realtor-full.ts" },
  { name: "frontdesk_integrations", cmd: "npx tsx scripts/test-frontdesk-integrations.ts" },
  { name: "frontdesk_realtime_profile", cmd: "npx tsx scripts/test-frontdesk-realtime-profile.ts" },
  { name: "frontdesk_booking_ux", cmd: "npx tsx scripts/test-frontdesk-booking-ux.ts" },
  { name: "frontdesk_booking_guards", cmd: "npx tsx scripts/test-frontdesk-booking-guards.ts" },
  { name: "outbound_qualification", cmd: "npx tsx scripts/test-outbound-qualification.ts" },
];

async function main() {
  const failures: string[] = [];
  for (const suite of SUITES) {
    process.stdout.write(`\n=== ${suite.name} ===\n`);
    const result = spawnSync(suite.cmd, { shell: true, stdio: "inherit", cwd: process.cwd() });
    if (result.status !== 0) {
      failures.push(suite.name);
    }
  }
  if (failures.length) {
    console.error(`\nFAILED suites: ${failures.join(", ")}`);
    process.exit(1);
  }
  console.log("\nAll realtor release gate suites passed.");
}

main();
