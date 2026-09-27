import assert from "node:assert/strict";
import { DEFAULT_MCTB_CONFIG } from "@/lib/agents/missed-call-text-back/types";
import {
  MCTB_PLATFORM_SENDER_RECOVERY_OPENER,
  resolveMctbRecoveryOpenerTemplate,
} from "@/lib/mctb/message-template";

const base = { ...DEFAULT_MCTB_CONFIG, messageTemplate: "Custom opener from workspace" };

assert.equal(
  resolveMctbRecoveryOpenerTemplate({ ...base, senderMode: "PLATFORM" }),
  MCTB_PLATFORM_SENDER_RECOVERY_OPENER,
);
assert.equal(
  resolveMctbRecoveryOpenerTemplate({ ...base, senderMode: "WORKSPACE" }),
  "Custom opener from workspace",
);
console.log("message-template: ok");
