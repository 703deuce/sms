/**
 * Hermetic wiring checks for voice reminders + AI notetaker.
 * Run: npx tsx scripts/test-voice-notetaker-wiring.ts
 */
import { readFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const failures: string[] = [];
const assert = (name: string, ok: boolean) => {
  if (!ok) failures.push(name);
};

assert("reminder voice channel", read("src/lib/appointments/types.ts").includes('"voice"'));
assert("drip voice channel", read("src/lib/drip-campaigns/types.ts").includes("DripStepChannel"));
assert("confirmationSource", read("src/lib/appointments/types.ts").includes("confirmationSource"));
assert("meeting session model", read("prisma/schema.prisma").includes("model MeetingSession"));
assert("meeting assistant service", read("src/lib/meeting-assistant/service.ts").includes("enableNotetakerForAppointment"));
assert("meeting webhook route", read("src/app/api/webhooks/telnyx/meetings/route.ts").includes("processTelnyxMeetingWebhook"));
assert("meeting workflow triggers", read("src/lib/appointment-workflows/types.ts").includes("meeting_recap_ready"));
assert("meetings nav", read("src/lib/products/appointments-nav.ts").includes('"/meetings"'));
assert("voice-reminders static segment", read("src/lib/products/appointments-routes.ts").includes('"voice-reminders"'));

if (failures.length) {
  console.error("FAIL", failures);
  process.exit(1);
}
console.log("OK voice + notetaker wiring");
