import { readFileSync } from "fs";
import { resolve } from "path";

function read(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function assert(label: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok: ${label}`);
}

const schema = read("prisma/schema.prisma");
assert("VideoMeeting model", schema.includes("model VideoMeeting"));
assert("VideoParticipant model", schema.includes("model VideoParticipant"));
assert("MeetingSession meetingSource", schema.includes("meetingSource"));
assert("MeetingSession videoMeetingId", schema.includes("videoMeetingId"));

assert("telnyx video provider", read("src/lib/transovo-video/telnyx-video-provider.ts").includes("telnyxCreateVideoRoom"));
assert("video meeting service", read("src/lib/transovo-video/service.ts").includes("provisionVideoMeetingForAppointment"));
assert("public join route", read("src/app/api/video/public/[token]/join/route.ts").includes("requestVideoJoin"));
assert("video webhook route", read("src/app/api/webhooks/telnyx/video-rooms/route.ts").includes("processTelnyxVideoRoomWebhook"));
assert("public video page", read("src/app/(public)/video/[token]/page.tsx").includes("VideoMeetingClient"));
assert("telnyx video sdk dep", read("package.json").includes("@telnyx/video"));
assert("video client wrapper", read("src/lib/transovo-video/client/transovo-video-client.ts").includes("initialize"));
assert("video remote subscriptions", read("src/lib/transovo-video/client/transovo-video-client.ts").includes("addSubscription"));
assert("video state_changed wiring", read("src/lib/transovo-video/client/transovo-video-client.ts").includes("state_changed"));
assert("video pipeline trace", read("src/lib/transovo-video/video-pipeline-trace.ts").includes("video-pipeline"));
assert("meeting room state sync", read("src/components/video/meeting-room.tsx").includes("onRoomStateChange"));
assert("booking auto-provision", read("src/lib/appointments/booking-platform.ts").includes("autoProvisionTransovoVideoForAppointment"));
assert("meeting link merge var", read("src/lib/appointments/appointments-service.ts").includes("meeting_link"));
assert("video process job", read("src/lib/jobs/job-handlers.ts").includes("transovo_video_process"));
assert("appointment video api", read("src/app/api/appointments/[id]/video/route.ts").includes("findVideoMeetingForAppointment"));
assert("staff host join api", read("src/app/api/appointments/[id]/video/join/route.ts").includes("requestStaffVideoJoin"));
assert("meeting entitlements", read("src/lib/meeting-assistant/entitlements.ts").includes("assertAiNotetakerEntitlement"));
assert("video entitlements", read("src/lib/transovo-video/entitlements.ts").includes("assertTransovoVideoEntitlement"));
assert("public recap page", read("src/app/(public)/recap/[token]/page.tsx").includes("RecapShareClient"));
assert("calendar meeting indicators", read("src/lib/appointments/meeting-indicators.ts").includes("getAppointmentMeetingIndicators"));
assert("durable recording storage", read("src/lib/storage/meeting-recordings.ts").includes("resolveMeetingRecordingAccess"));
assert("event type video settings", read("src/components/video/event-type-video-settings.tsx").includes("Transovo Video settings"));

if (process.exitCode) {
  console.error("\nTransovo Video wiring checks failed.");
  process.exit(process.exitCode);
}

console.log("\nAll Transovo Video wiring checks passed.");
