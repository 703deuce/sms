/**
 * Batch 8F-3 — booking permissions + meeting polls static verification.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const requiredFiles = [
  "src/lib/appointments/meeting-poll-access.ts",
  "src/lib/appointments/meeting-polls.ts",
  "src/features/appointments/kimi/meeting-polls/map-meeting-polls.ts",
  "src/components/appointments/kimi-ui/appointment-types/components/TypePublishingSections.tsx",
  "src/components/appointments/kimi-ui/meeting-polls/components/CreatePollModal.tsx",
  "src/app/api/appointments/meeting-polls/route.ts",
];

let failed = 0;
for (const rel of requiredFiles) {
  const ok = existsSync(join(ROOT, rel));
  console.log(ok ? "PASS" : "FAIL", rel);
  if (!ok) failed += 1;
}

const publishing = readFileSync(
  join(ROOT, "src/components/appointments/kimi-ui/appointment-types/components/TypePublishingSections.tsx"),
  "utf8",
);
if (
  publishing.includes("Who can manage this booking type?") &&
  publishing.includes("teamUserOptions") &&
  publishing.includes("Selected team members")
) {
  console.log("PASS per-type team access editor");
} else {
  console.log("FAIL per-type team access editor");
  failed += 1;
}

const pollApi = readFileSync(join(ROOT, "src/app/api/appointments/meeting-polls/route.ts"), "utf8");
if (
  pollApi.includes("requireAppointmentsAccess") &&
  pollApi.includes("filterMeetingPollsForUser") &&
  pollApi.includes('action === "finalize"')
) {
  console.log("PASS meeting polls API authorization");
} else {
  console.log("FAIL meeting polls API authorization");
  failed += 1;
}

const pollLib = readFileSync(join(ROOT, "src/lib/appointments/meeting-polls.ts"), "utf8");
if (pollLib.includes("finalizeMeetingPollBooking") && pollLib.includes("assertPollCreateAccess")) {
  console.log("PASS finalizeMeetingPollBooking backend");
} else {
  console.log("FAIL finalizeMeetingPollBooking backend");
  failed += 1;
}

const createModal = readFileSync(
  join(ROOT, "src/components/appointments/kimi-ui/meeting-polls/components/CreatePollModal.tsx"),
  "utf8",
);
if (createModal.includes("poll-meeting-type") && createModal.includes("eligibleMeetingTypes")) {
  console.log("PASS poll meeting type selector");
} else {
  console.log("FAIL poll meeting type selector");
  failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nBatch 8F-3 static verification: PASS");
