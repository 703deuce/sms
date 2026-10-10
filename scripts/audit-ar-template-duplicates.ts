/**
 * Report near-duplicate reminder templates (same industry, channel, message type, normalized body).
 * Does not modify the catalog — for human review only.
 *
 * Usage: npx tsx scripts/audit-ar-template-duplicates.ts
 */
import catalogJson from "../src/lib/appointment-reminders/template-library/transovo-reminder-templates.json";
import type { TemplateLibraryCatalog } from "../src/lib/appointment-reminders/template-library/types";

const catalog = catalogJson as TemplateLibraryCatalog;

function normalizeBody(body: string): string {
  return body
    .toLowerCase()
    .replace(/\{\{[^}]+\}\}/g, "{{var}}")
    .replace(/\s+/g, " ")
    .trim();
}

const byKey = new Map<string, string[]>();

for (const t of catalog.templates) {
  const key = `${t.industry}|${t.channel}|${t.messageType}|${normalizeBody(t.body)}`;
  const list = byKey.get(key) || [];
  list.push(t.id);
  byKey.set(key, list);
}

const duplicateClusters = [...byKey.entries()].filter(([, ids]) => ids.length > 1);

console.log(`Templates: ${catalog.templates.length}`);
console.log(`Duplicate body clusters: ${duplicateClusters.length}`);

for (const [key, ids] of duplicateClusters.slice(0, 40)) {
  console.log(`\n— ${key.split("|").slice(0, 3).join(" · ")} (${ids.length})`);
  for (const id of ids) console.log(`  ${id}`);
}

if (duplicateClusters.length > 40) {
  console.log(`\n… and ${duplicateClusters.length - 40} more clusters`);
}
