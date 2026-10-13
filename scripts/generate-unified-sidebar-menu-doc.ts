import { writeFileSync } from "fs";
import { collectNavHrefs } from "@/lib/nav";
import { buildUnifiedAppointmentsNav } from "@/lib/products/unified-appointments-nav";

const nav = buildUnifiedAppointmentsNav();
let currentSection = "Overview";
const lines: string[] = [
  "# Unified Appointments — main sidebar menu",
  "",
  "Generated from `buildUnifiedAppointmentsNav()` (unified mode: default when Appointment Reminders is the launch product).",
  "",
  "Regenerate: `npx tsx scripts/generate-unified-sidebar-menu-doc.ts`",
  "",
  "Override: `UNIFIED_APPOINTMENTS=0` → shorter AR-only sidebar.",
  "",
  "---",
  "",
];

for (const item of nav) {
  if (item.sectionLabel) currentSection = item.sectionLabel;
  lines.push(`## ${currentSection}`, "");
  lines.push(`- **${item.label}** → \`${item.href}\``);
  if (item.children?.length) {
    for (const c of item.children) {
      if (typeof c === "object" && "href" in c && "label" in c) {
        lines.push(`  - ${c.label} → \`${c.href}\``);
      }
    }
  }
  lines.push("");
}

const unique = collectNavHrefs(nav).sort();
lines.push("---", "", `## All unique URLs (${unique.length})`, "", ...unique.map((h) => `- ${h}`), "");

writeFileSync("docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md", lines.join("\n"));
console.log(`Wrote docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md (${unique.length} unique URLs)`);
