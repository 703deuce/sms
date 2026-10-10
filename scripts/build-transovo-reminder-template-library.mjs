#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const input =
  process.argv[2] || path.join(process.cwd(), "docs/transovo_reminder_templates.md");
const output =
  process.argv[3] ||
  path.join(process.cwd(), "src/lib/appointment-reminders/template-library/transovo-reminder-templates.json");

const SKIP_SECTIONS = new Set(["implementation and compliance notes", "variables"]);

const MESSAGE_TYPE_SLUG = {
  "booking confirmation": "booking_confirmation",
  "advance reminder": "advance_reminder",
  "day before": "day_before",
  "same day": "same_day",
  "confirmation request": "confirmation_request",
  "reschedule notice": "reschedule_notice",
  "cancellation notice": "cancellation_notice",
  preparation: "preparation",
  "follow up": "follow_up",
};

function industrySlug(title) {
  return title.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function normalizeVars(text) {
  return text.replace(/\{([a-z_]+)\}/g, "{{$1}}");
}

function parseMarkdown(md) {
  const lines = md.split(/\r?\n/);
  let industry = null;
  const templates = [];
  const industries = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      if (SKIP_SECTIONS.has(title.toLowerCase())) {
        industry = null;
      } else {
        industry = industrySlug(title);
        if (!industries.includes(industry)) industries.push(industry);
      }
      continue;
    }

    if (!industry || !line.startsWith("### ")) continue;

    const heading = line.slice(4).trim();
    const parts = heading.split(/\s+[—–-]\s+/).map((s) => s.trim());
    if (parts.length < 2) continue;

    const messageType = MESSAGE_TYPE_SLUG[parts[0].toLowerCase()];
    const channel = parts[1].toLowerCase().includes("email") ? "email" : "sms";
    if (!messageType) continue;

    let subject = null;
    let j = i + 1;
    if (j < lines.length && lines[j].startsWith("**Subject:**")) {
      subject = normalizeVars(lines[j].replace("**Subject:**", "").trim());
      j += 1;
    }

    while (j < lines.length && lines[j].trim() === "") j += 1;
    if (j >= lines.length || !lines[j].startsWith("```")) continue;

    j += 1;
    const bodyLines = [];
    while (j < lines.length && !lines[j].startsWith("```")) {
      bodyLines.push(lines[j]);
      j += 1;
    }

    const body = normalizeVars(bodyLines.join("\n").trim());
    templates.push({
      id: `${industry}:${messageType}:${channel}`,
      industry,
      messageType,
      channel,
      label: parts[0],
      subject,
      body,
    });
    i = j;
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    messageTypes: Object.values(MESSAGE_TYPE_SLUG),
    industries,
    templates,
  };
}

const md = fs.readFileSync(input, "utf8");
const catalog = parseMarkdown(md);
if (catalog.templates.length !== 306) {
  console.warn(`Expected 306 templates, got ${catalog.templates.length}`);
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(catalog));
console.log(`Wrote ${catalog.templates.length} templates → ${output}`);
