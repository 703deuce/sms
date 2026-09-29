import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readMctbScheduleFromCustomFields } from "../src/lib/mctb/schedule-shared";
import { DEFAULT_MCTB_CONFIG } from "../src/lib/agents/missed-call-text-back/types";
import { configToRecord } from "../src/lib/agents/missed-call-text-back/config";

const src = readFileSync(
  join(process.cwd(), "src/lib/mctb/getting-started/project-readiness.ts"),
  "utf8",
);
assert.match(
  src,
  /readMctbScheduleFromCustomFields\(customCfg,\s*runtime\)/,
  "getting-started must pass runtime config into schedule reader",
);

const runtime = configToRecord({
  id: "t",
  workspaceId: "w",
  agentId: null,
  ...DEFAULT_MCTB_CONFIG,
  delaySeconds: 30,
});
assert.equal(
  readMctbScheduleFromCustomFields({}, runtime).manuallyPaused,
  !runtime.enabled,
);

console.log("test-mctb-getting-started-readiness: PASS");
