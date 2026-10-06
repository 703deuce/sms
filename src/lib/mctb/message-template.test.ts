import assert from "node:assert/strict";
import { DEFAULT_MCTB_CONFIG } from "@/lib/agents/missed-call-text-back/types";
import { resolveMctbRecoveryOpenerTemplate } from "@/lib/mctb/message-template";
import { assertMctbFirstTextSafeForSend } from "@/lib/mctb/first-text-templates/render";

const base = { ...DEFAULT_MCTB_CONFIG, messageTemplate: "Custom opener from workspace" };

const platformRendered = resolveMctbRecoveryOpenerTemplate({ ...base, senderMode: "PLATFORM" });
assert.ok(platformRendered.includes("Your business"));
assert.ok(!platformRendered.includes("{{"));
assertMctbFirstTextSafeForSend(platformRendered);
assert.equal(
  resolveMctbRecoveryOpenerTemplate({ ...base, senderMode: "WORKSPACE" }),
  "Custom opener from workspace",
);
console.log("message-template: ok");
