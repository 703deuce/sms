#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "src/lib/voice-v2/pipelines/microsoft-365-certified/internal";

const replacements = [
  [/from "@\/lib\/voice-v2\/types"/g, 'from "./types"'],
  [/from "@\/lib\/voice\/calendar\/timezone-slots"/g, 'from "./timezone-slots"'],
  [/from "@\/lib\/microsoft\/graph-datetime-timezone"/g, 'from "./graph-datetime-timezone"'],
  [/from "@\/lib\/microsoft\/graph-helpers"/g, 'from "./graph-helpers"'],
  [/from "@\/lib\/microsoft\/oauth-config"/g, 'from "./oauth-config"'],
  [/from "@\/lib\/microsoft\/token-refresh-lock"/g, 'from "./token-refresh-lock"'],
  [/from "@\/lib\/microsoft\/token-errors"/g, 'from "./token-errors"'],
  [/from "\.\/token-errors"/g, 'from "./token-errors"'],
  [/from "@\/lib\/calendar\/eligibility"/g, 'from "./calendar-eligibility"'],
  [/from "@\/lib\/calendar\/providers"/g, 'from "./calendar-providers"'],
  [/from "@\/lib\/voice\/calendar\/providers"/g, 'from "./calendar-providers"'],
  [/from "@\/lib\/mctb\/ai-booking\/config"/g, 'from "./workspace-booking-config"'],
  [/from "@\/lib\/mctb\/ai-booking\/types"/g, 'from "./workspace-booking-types"'],
  [/from "@\/lib\/mctb\/ai-booking\/fallback"/g, 'from "./workspace-booking-fallback"'],
  [/from "@\/lib\/mctb\/ai-booking\/entitlement"/g, 'from "./workspace-booking-entitlement"'],
  [/from "@\/lib\/mctb\/entitlement"/g, 'from "./mctb-entitlement"'],
  [/from "@\/lib\/mctb\/booking-links\/service"/g, 'from "./mctb-booking-links-service"'],
  [/from "@\/lib\/mctb\/booking-links\/validate-url"/g, 'from "./mctb-booking-links-validate-url"'],
  [/from "@\/lib\/mctb\/ai-booking\/microsoft-connection-pointer-logic"/g, 'from "./microsoft-connection-pointer-logic"'],
  [/from "@\/lib\/microsoft\/oauth-mutation-policy"/g, 'from "./oauth-mutation-policy"'],
  [/from "@\/lib\/voice\/ai-booking\/voice-orchestrator-timing"/g, 'from "./voice-orchestrator-timing"'],
  [/from "@\/lib\/voice-v2\/graph-instrumentation"/g, 'from "./graph-instrumentation"'],
  [/import\("@\/lib\/microsoft\/oauth-mutation-policy"\)/g, 'import("./oauth-mutation-policy")'],
  [/import\("@\/lib\/voice\/ai-booking\/voice-orchestrator-timing"\)/g, 'import("./voice-orchestrator-timing")'],
  [/import\("@\/lib\/voice-v2\/graph-instrumentation"\)/g, 'import("./graph-instrumentation")'],
  [/import\("\.\/token-errors"\)/g, 'import("./token-errors")'],
];

for (const name of readdirSync(dir)) {
  if (!name.endsWith(".ts")) continue;
  const path = join(dir, name);
  let src = readFileSync(path, "utf8");
  for (const [re, rep] of replacements) {
    src = src.replace(re, rep);
  }
  writeFileSync(path, src);
}

console.log("rewired internal imports in", dir);
