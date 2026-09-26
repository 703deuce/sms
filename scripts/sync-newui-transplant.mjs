#!/usr/bin/env node
/**
 * Copy newui components into src/newui-transplant with import rewrites.
 * Does not copy pages — those are wired per-route with production data.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "newui");
const DST = path.join(ROOT, "src/newui-transplant");

const FILES = [
  "components/app/button-link.tsx",
  "components/app/charts.tsx",
  "components/app/link-tabs.tsx",
  "components/app/range-toggle.tsx",
  "components/app/save-bar.tsx",
  "components/app/status.tsx",
  "components/voice/calls-browser.tsx",
  "components/voice/recent-calls-table.tsx",
  "components/mctb/consent-editor.tsx",
  "components/mctb/exclusions-table.tsx",
  "components/mctb/inbox.tsx",
  "components/mctb/missed-calls-browser.tsx",
  "components/mctb/text-back-editor.tsx",
  "components/mctb/voicemail-browser.tsx",
  "components/ui/chart.tsx",
  "components/ui/checkbox.tsx",
  "components/ui/dialog.tsx",
  "components/ui/dropdown-menu.tsx",
  "components/ui/label.tsx",
  "components/ui/select.tsx",
  "components/ui/switch.tsx",
  "components/ui/textarea.tsx",
];

function rewrite(content) {
  return content
    .replace(/@\/components\/ui\//g, "@/newui-transplant/components/ui/")
    .replace(/@\/components\/app\//g, "@/newui-transplant/components/app/")
    .replace(/@\/components\/voice\//g, "@/newui-transplant/components/voice/")
    .replace(/@\/components\/mctb\//g, "@/newui-transplant/components/mctb/")
    .replace(/@\/lib\/data/g, "@/newui-transplant/lib/view-models");
}

for (const rel of FILES) {
  const from = path.join(SRC, rel);
  const to = path.join(DST, rel);
  if (!fs.existsSync(from)) {
    console.error("missing", from);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  const out = rewrite(fs.readFileSync(from, "utf8"));
  fs.writeFileSync(to, out);
  console.log("copied", rel);
}
