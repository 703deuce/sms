/**
 * Export Layer A only — AMY_V2_CORE_STATIC_PROMPT (no wizard, intake, knowledge, or DB).
 *
 *   OUT=/opt/cursor/artifacts/amy-v2-core-static-prompt.txt \
 *     npx tsx scripts/export-amy-v2-core-static-prompt.ts
 */
import { writeFileSync } from "node:fs";
import { AMY_V2_CORE_STATIC_PROMPT } from "@/lib/voice-v2/one-amy/amy-core-static-prompt";

const OUT = process.env.OUT || "/opt/cursor/artifacts/amy-v2-core-static-prompt.txt";

function main() {
  const header = [
    "# Amy Voice V2 — Layer A static core prompt only",
    `# source: src/lib/voice-v2/one-amy/amy-core-static-prompt.ts (AMY_V2_CORE_STATIC_PROMPT)`,
    `# exported: ${new Date().toISOString()}`,
    "# Does NOT include: wizard compiled prompt, intake, knowledge, qualification, after-hours, or per-call dynamic variables.",
    "",
  ].join("\n");

  writeFileSync(OUT, `${header}${AMY_V2_CORE_STATIC_PROMPT}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, out: OUT, chars: AMY_V2_CORE_STATIC_PROMPT.length }, null, 2));
}

main();
