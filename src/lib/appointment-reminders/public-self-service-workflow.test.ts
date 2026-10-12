import assert from "node:assert/strict";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import { resolveAiReschedulerConfig } from "./ai-rescheduler/types";

function platformWithMode(mode: string, approval: "automatic" | "business"): AppointmentPlatformConfig {
  return {
    timezone: "America/New_York",
    aiRescheduler: {
      mode,
      approval,
      weeklyHours: {},
      durationMode: "original",
      minimumNoticeMinutes: 60,
      maximumDaysAhead: 30,
      bufferMinutes: 0,
      allowProviderCancel: false,
    },
  } as AppointmentPlatformConfig;
}

const selfAuto = resolveAiReschedulerConfig(platformWithMode("self_service_link", "automatic"));
assert.equal(selfAuto.mode, "self_service_link");

const selfBiz = resolveAiReschedulerConfig(platformWithMode("self_service_link", "business"));
assert.equal(selfBiz.approval, "business");

console.log("public-self-service-workflow.test.ts: ok");
