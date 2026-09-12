import assert from "node:assert/strict";
import {
  countActiveTriggers,
  cooldownPresetLabel,
  formatDelayLabel,
  formatTriggerSummary,
  isCooldownPreset,
  recoverySnapshotsEqual,
} from "../src/lib/mctb/setup-recovery-model";
import { resolveMctbSetupSectionId } from "../src/lib/mctb/setup-sections";

assert.equal(resolveMctbSetupSectionId("/mctb/setup/recovery"), "recovery");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/missed-call-rules"), "recovery");
assert.equal(resolveMctbSetupSectionId("/mctb/setup/text-back"), "recovery");

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
