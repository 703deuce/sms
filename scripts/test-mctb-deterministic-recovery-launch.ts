/**
 * Launch UX contracts for deterministic MCTB recovery (runtime + copy).
 * Run: npx tsx scripts/test-mctb-deterministic-recovery-launch.ts
 */
import assert from "node:assert/strict";
import { defaultMctbFirstTextTemplateConfig } from "../src/lib/mctb/first-text-templates/config-defaults";
import { getMctbFirstTextTemplate } from "../src/lib/mctb/first-text-templates/registry";
import {
  buildInformationRequestPreviewSentence,
  previewFirstRecoverySms,
} from "../src/lib/mctb/first-text-templates/preview-copy";
import { renderMctbFirstTextTemplateBody } from "../src/lib/mctb/first-text-templates/render";
import { applyVoicemailSmsReinforcement } from "../src/lib/mctb/voicemail-sms-reinforcement";
import { resolveMctbMessagingInBusinessHoursFromSchedule } from "../src/lib/mctb/messaging-business-hours";
import { defaultWeeklySchedule } from "../src/lib/mctb/schedule-shared";

const business = "Joe's Plumbing";
const cfg = defaultMctbFirstTextTemplateConfig("on_a_job");

const bh = renderMctbFirstTextTemplateBody({ config: cfg, businessName: business, inBusinessHours: true });
const ah = renderMctbFirstTextTemplateBody({ config: cfg, businessName: business, inBusinessHours: false });
assert.match(bh, /on a job right now/i);
assert.match(ah, /closed right now/i);
assert.ok(!ah.match(/on a job right now/i));

const sentence = buildInformationRequestPreviewSentence(cfg);
assert.match(sentence, /While you wait, reply with/);
assert.match(sentence, /your name/);

const preview = previewFirstRecoverySms(cfg, business, true);
assert.equal(preview, bh);

const def = getMctbFirstTextTemplate("on_a_job");
assert.ok(def.bodyAfterHours?.trim());

const weekly = defaultWeeklySchedule("America/New_York");
const monday10am = new Date("2026-06-01T14:00:00.000Z"); // approximate — test only checks function runs
assert.equal(typeof resolveMctbMessagingInBusinessHoursFromSchedule(
  { allowedStartTime: "09:00", allowedEndTime: "17:00", timezone: "America/New_York" } as import("../src/lib/agents/missed-call-text-back/types").MissedCallTextConfigRecord,
  weekly,
  monday10am,
), "boolean");

const vm = applyVoicemailSmsReinforcement("Sorry we missed you.", true);
assert.match(vm, /text message/i);

console.log("test-mctb-deterministic-recovery-launch: PASS");
