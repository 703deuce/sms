/**
 * Regenerates field inventory section for AI-RECEPTIONIST-CONFIG-TRACING-REPORT.md
 */
import { writeFileSync } from "node:fs";
import { listTopLevelRegistryEntries } from "../src/lib/solutions/appointment-receptionist/config-tracing/field-registry";

const entries = listTopLevelRegistryEntries();
const byOwner = new Map<string, typeof entries>();
for (const e of entries) {
  const list = byOwner.get(e.owner) ?? [];
  list.push(e);
  byOwner.set(e.owner, list);
}

let md = `# AI Receptionist — configuration tracing report (generated)\n\n`;
md += `Generated field count (top-level): **${entries.length}**\n\n`;
for (const [owner, list] of [...byOwner.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  md += `## ${owner}\n\n`;
  md += `| Field | Runtime | External processing | Sensitive | Runtime mapping |\n`;
  md += `|-------|---------|---------------------|-----------|------------------|\n`;
  for (const e of list.sort((a, b) => a.path.localeCompare(b.path))) {
    md += `| \`${e.path}\` | ${e.affectsRuntime ? "yes" : "no"} | ${e.requiresExternalProcessing ? "yes" : "no"} | ${e.sensitive ? "yes" : "no"} | ${e.runtimeMapping ?? "—"} |\n`;
  }
  md += `\n`;
}

md += `## Known gaps (manual)\n\n`;
md += `1. **Nested array fields** (appointment types, transfer destinations, qualification rules) — traced via flatten paths; registry metadata is leaf-oriented.\n`;
md += `2. **Behavioral proof** — tool invoke / booking success not logged here; use call/tool traces.\n`;
md += `3. **Operational pages** (\`/voice/knowledge\`, \`/voice/call-handling\`) — use same API trace headers when extended; editor uses wizard POST today.\n`;
md += `4. **Draft save side effects on master** — non-lightweight steps may still run hooks/live sync; tracing flags \`UNEXPECTED_LIVE_EFFECT\` until lifecycle ADR is fully deployed.\n`;
md += `5. **Published snapshot verification** — post-publish diff compares wizard snapshots on VoiceAgentVersion config when present.\n`;

const out = "/workspace/docs/AI-RECEPTIONIST-CONFIG-TRACING-REPORT.md";
writeFileSync(out, md);
console.log(`Wrote ${out}`);
