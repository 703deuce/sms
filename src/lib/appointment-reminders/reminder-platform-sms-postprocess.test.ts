import assert from "node:assert/strict";
import { renderAppointmentTemplate } from "@/lib/appointments/appointments-service";
import { publicActionUrl } from "@/lib/appointments/settings";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import { reminderAppointmentMergeVars } from "@/lib/appointment-reminders/template-library/merge-context";
import { finalizeReminderSmsBody } from "@/lib/appointment-reminders/message-sanitize";
import {
  applyPlatformSenderReminderSmsPostProcess,
  countHttpUrlsInSmsBody,
  smsBodyIncludesCrXInstructions,
} from "./reminder-platform-sms-postprocess";
import {
  DEFAULT_AI_RESCHEDULER_CONFIG,
  type AiReschedulerConfig,
} from "./ai-rescheduler/types";

process.env.NEXT_PUBLIC_APP_URL = "https://app.transovo.test";
const manageToken = "manage-test-token-abc";
const manageUrl = publicActionUrl("manage", manageToken);
const template =
  "Hi {{first_name}}, your appointment with {{business_name}} is {{appointment_date}} at {{appointment_time}}. Manage: {{appointment_link}}. Reply STOP to opt out.";

const platform = { timezone: "America/New_York" } as AppointmentPlatformConfig;
const startsAt = new Date("2026-10-14T18:00:00.000Z");
const metadata = { manageToken, inviteeName: "Sarah" };

function renderReminderSmsBody(): string {
  const merged = reminderAppointmentMergeVars({
    platform,
    metadata,
    firstName: "Sarah",
    businessName: "ABC Dental",
    service: "Cleaning",
    startsAt,
    timezone: "America/New_York",
  });
  return finalizeReminderSmsBody(renderAppointmentTemplate(template, merged));
}

function postProcess(arConfig: AiReschedulerConfig, smsResponsesAllowed = true): string {
  return applyPlatformSenderReminderSmsPostProcess({
    smsBody: renderReminderSmsBody(),
    platformSender: true,
    arConfig,
    startsAt,
    smsResponsesAllowed,
  });
}

const selfService: AiReschedulerConfig = {
  ...DEFAULT_AI_RESCHEDULER_CONFIG,
  mode: "self_service_link",
};
const notify: AiReschedulerConfig = { ...DEFAULT_AI_RESCHEDULER_CONFIG, mode: "notify" };
const ai: AiReschedulerConfig = { ...DEFAULT_AI_RESCHEDULER_CONFIG, mode: "ai" };
const remindersOnly: AiReschedulerConfig = {
  ...DEFAULT_AI_RESCHEDULER_CONFIG,
  mode: "reminders_only",
};

const selfServiceOut = postProcess(selfService);
assert.equal(countHttpUrlsInSmsBody(selfServiceOut), 1, "self_service_link keeps one URL");
assert.ok(
  selfServiceOut.includes(manageUrl) || selfServiceOut.includes(`/appointments/manage/${manageToken}`),
  "self_service_link keeps manage URL",
);
assert.equal(
  smsBodyIncludesCrXInstructions(selfServiceOut),
  false,
  "self_service_link omits C/R/X suffix",
);

const notifyOut = postProcess(notify);
assert.equal(countHttpUrlsInSmsBody(notifyOut), 0, "notify strips URLs on platform sender");
assert.equal(smsBodyIncludesCrXInstructions(notifyOut), true, "notify adds C/R/X suffix");

const aiOut = postProcess(ai);
assert.equal(countHttpUrlsInSmsBody(aiOut), 0, "ai strips URLs");
assert.equal(smsBodyIncludesCrXInstructions(aiOut), true, "ai adds C/R/X suffix");

const remindersOut = postProcess(remindersOnly);
assert.equal(countHttpUrlsInSmsBody(remindersOut), 0, "reminders_only strips URLs");
assert.equal(smsBodyIncludesCrXInstructions(remindersOut), false, "reminders_only has no C/R/X");

console.log("reminder-platform-sms-postprocess.test.ts: ok");
