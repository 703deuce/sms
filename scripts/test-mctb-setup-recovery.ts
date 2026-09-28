import assert from "node:assert/strict";
import {
  countActiveTriggers,
  cooldownPresetLabel,
  formatCooldownDisplay,
  formatDelayLabel,
  formatRepeatCallerSummary,
  formatTriggerSummary,
  isCooldownOff,
  isCooldownPreset,
  recoverySnapshotsEqual,
} from "../src/lib/mctb/setup-recovery-model";
import { resolveMctbSetupSectionId } from "../src/lib/mctb/setup-sections";

assert.equal(resolveMctbSetupSectionId("/mctb/setup/recovery"), "recovery");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/missed-call-rules"), "missed-call-rules");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/text-back"), "text-back");

const triggers = {
  noAnswer: true,
  busy: false,
  rejected: true,
  timeout: false,
  voicemail: false,
};
assert.equal(countActiveTriggers(triggers), 2);
assert.ok(formatTriggerSummary(triggers).includes("No answer"));

assert.equal(isCooldownPreset(30), true);
assert.equal(isCooldownPreset(45), false);
assert.equal(cooldownPresetLabel(60), "1 hr");
assert.equal(formatDelayLabel(0), "Immediately");
assert.equal(formatCooldownDisplay(0), "Off");
assert.equal(formatCooldownDisplay(30), "30 min");
assert.equal(formatRepeatCallerSummary(0), "Eligible immediately");
assert.equal(formatRepeatCallerSummary(30), "Suppressed during cooldown");
assert.equal(isCooldownOff(0), true);

const a = {
  phoneNumberId: "p1",
  triggers,
  cooldownMinutes: 30,
  delaySeconds: 0,
};
const b = { ...a, triggers: { ...triggers } };
assert.equal(recoverySnapshotsEqual(a, b), true);
b.cooldownMinutes = 60;
assert.equal(recoverySnapshotsEqual(a, b), false);

console.log("test-mctb-setup-recovery: ok");
