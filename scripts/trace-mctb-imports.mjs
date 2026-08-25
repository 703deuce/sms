#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = "/workspace";

const SCENARIOS = {
  core: [
    "src/lib/mctb",
    "src/lib/agents/missed-call-text-back",
    "src/lib/solutions/missed-call-text-back",
    "src/app/api/mctb",
    "src/app/api/telnyx/voice/mctb-consent",
    "src/app/api/telnyx/voice/mctb-call-control",
    "src/app/api/telnyx/voice/mctb-event-only",
    "src/app/api/telnyx/voice/mctb-voice-bridge",
    "src/app/api/twilio/voice/mctb-ingress",
    "src/app/api/solutions/missed-call-text-back",
    "src/app/api/public/mctb-request-form",
    "src/app/(app)/voice/missed-calls",
    "src/app/(app)/voice/setup",
    "src/app/(app)/voice/consent-log",
    "src/app/(app)/voice/schedule",
    "src/app/(app)/voice/try-it",
    "src/app/(app)/voice/analytics",
    "src/app/(app)/voice/numbers",
    "src/app/(app)/onboarding/mctb",
    "src/app/(app)/dashboard",
    "src/lib/voice/python-runtime-bridge/mctb-sip-session.ts",
    "src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback.ts",
    "src/lib/voice/python-runtime-bridge/mctb-direct-dial-transfer.ts",
    "src/lib/mctb/provisioning",
    "src/lib/telephony/provisioning",
    "src/app/api/telnyx/inbound/route.ts",
    "src/app/api/telnyx/messaging/route.ts",
    "src/app/api/telnyx/message-status/route.ts",
    "src/app/api/twilio/toll-free-verification/route.ts",
    "src/app/api/twilio/inbound/route.ts",
    "src/lib/messaging/telnyx/webhook-handlers.ts",
  ],
  withGeneralTelnyxVoice: [
    "src/app/api/telnyx/voice/route.ts",
    "src/lib/voice/telnyx/webhook-handlers.ts",
  ],
};

const FLAGGED = [
  "src/lib/crm/acceptance.ts",
  "src/lib/crm/env-check.ts",
  "src/lib/crm/oauth.ts",
  "src/lib/agents/appointment-booking/intelligence/caller-tool-playbook.ts",
  "src/lib/voice/platform/ai-platform.ts",
  "src/lib/realtor/types.ts",
  "src/lib/voice/outbound/agent-config.ts",
  "src/lib/voice/outbound/ensure-realtime-clone-agent.ts",
  "src/lib/voice/real-estate/compile/compile-front-desk.ts",
  "src/lib/voice/receptionist/compile.ts",
  "src/lib/voice/receptionist/types.ts",
  "src/lib/receptionist-wizard/harbor-home-demo-config.ts",
  "src/lib/voice/agent-runtime/auto-capture-caller-info.ts",
  "src/lib/voice/agent-runtime/deterministic-executor.ts",
  "src/lib/voice/workflow-runtime/compile-for-call.ts",
  "src/lib/voice/workflow-runtime/node-transitions.ts",
];

const FLAGGED_DIRS = [
  "src/lib/agents/appointment-booking",
  "src/lib/realtor",
  "src/lib/voice/outbound",
  "src/lib/voice/receptionist",
  "src/lib/receptionist-wizard",
  "src/lib/voice/real-estate",
  "src/lib/crm",
];

function collectFiles(entry) {
  const abs = path.join(ROOT, entry);
  if (!fs.existsSync(abs)) return [];
  const stat = fs.statSync(abs);
  if (stat.isFile()) return [entry];
  const out = [];
  (function walk(dir, rel) {
    for (const name of fs.readdirSync(dir)) {
      const a = path.join(dir, name);
      const r = path.join(rel, name);
      const s = fs.statSync(a);
      if (s.isDirectory()) walk(a, r);
      else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(r);
    }
  })(abs, entry);
  return out;
}

const importRe =
  /(?:import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|import\s*\(|await\s+import\s*\()\s*['"]([^'"]+)['"]/g;

function resolveImport(fromFile, spec) {
  let target;
  if (spec.startsWith("@/")) {
    target = path.join(ROOT, "src", spec.slice(2));
  } else if (spec.startsWith(".")) {
    target = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  } else {
    return null;
  }
  const exts = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx", "/index.js"];
  for (const ext of exts) {
    const candidate = target + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.relative(ROOT, candidate).replace(/\\/g, "/");
    }
  }
  return null;
}

function trace(entryGlobs) {
  const entryFiles = [...new Set(entryGlobs.flatMap(collectFiles))];
  const visited = new Set();
  const queue = [...entryFiles];
  const parent = new Map();

  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    let src;
    try {
      src = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    importRe.lastIndex = 0;
    let m;
    while ((m = importRe.exec(src))) {
      const resolved = resolveImport(file, m[1]);
      if (!resolved || visited.has(resolved)) continue;
      if (!parent.has(resolved)) parent.set(resolved, file);
      queue.push(resolved);
    }
  }

  function chain(target) {
    const c = [];
    let cur = target;
    while (cur) {
      c.unshift(cur);
      cur = parent.get(cur);
    }
    return c;
  }

  return { entryFiles, visited, chain };
}

function report(name, { entryFiles, visited, chain }) {
  console.log(`\n########## ${name} (${entryFiles.length} entry files, ${visited.size} reachable) ##########`);

  console.log("\n=== FLAGGED FILES ===");
  for (const f of FLAGGED) {
    const hit = visited.has(f);
    console.log(`${hit ? "KEEP" : "REMOVE"}: ${f}`);
    if (hit) console.log(`  chain: ${chain(f).join(" -> ")}`);
  }

  console.log("\n=== FLAGGED DIRECTORIES ===");
  for (const dir of FLAGGED_DIRS) {
    const filesInDir = [...visited].filter((f) => f === dir || f.startsWith(dir + "/"));
    console.log(`${filesInDir.length ? "PARTIAL" : "REMOVE"}: ${dir} (${filesInDir.length} files)`);
    if (filesInDir.length) console.log(`  ${filesInDir.slice(0, 6).join(", ")}${filesInDir.length > 6 ? " ..." : ""}`);
  }
}

const core = trace(SCENARIOS.core);
report("CORE MCTB (no general /api/telnyx/voice)", core);

const broad = trace([...SCENARIOS.core, ...SCENARIOS.withGeneralTelnyxVoice]);
report("CORE + general Telnyx voice webhook", broad);

console.log("\n=== ONLY-IN-BROAD (pulled in by general telnyx/voice, not core MCTB) ===");
for (const f of FLAGGED) {
  if (!core.visited.has(f) && broad.visited.has(f)) {
    console.log(f);
    console.log(`  chain: ${broad.chain(f).join(" -> ")}`);
  }
}
