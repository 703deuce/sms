import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generatedDirForSession, readAllGeneratedSources } from "./generated-sandbox";
import { KIMI_BATCH_PAGE_INSTRUCTION, KIMI_COMPLETENESS_REQUIREMENTS, KIMI_MULTI_SCREEN_ARCHITECTURE, UI_AGENT_DIR, ensureUiAgentDirs } from "./config";

export type CompletenessGap = {
  id: string;
  description: string;
  severity: "required" | "recommended";
};

export type CompletenessReport = {
  sessionId: string;
  target: string;
  files: string[];
  gaps: CompletenessGap[];
  complete: boolean;
  instruction: string;
};

type RouteRule = {
  match: (target: string) => boolean;
  gaps: (ctx: { target: string; files: string[]; sources: string }) => CompletenessGap[];
};

function hasFile(files: string[], pattern: RegExp): boolean {
  return files.some((f) => pattern.test(f));
}

function sourcesContain(sources: string, pattern: RegExp): boolean {
  return pattern.test(sources);
}

const ROUTE_RULES: RouteRule[] = [
  {
    match: (t) => t === "/automations" || t.startsWith("/automations/"),
    gaps: ({ files, sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!hasFile(files, /page\.tsx$/)) {
        gaps.push({ id: "page", description: "page.tsx entry with list ↔ builder routing", severity: "required" });
      }
      if (!sourcesContain(sources, /WorkflowBuilder|workflow-builder|BuilderCanvas|FlowBuilder/i)) {
        gaps.push({
          id: "builder",
          description:
            "Workflow builder canvas: dot-grid background, left palette (Triggers/Conditions/Actions/Waits), draggable nodes, node click opens ConfigModal",
          severity: "required",
        });
      }
      if (!sourcesContain(sources, /ConfigModal/i)) {
        gaps.push({
          id: "config-modal",
          description: "Step configuration drawer/modal for triggers, conditions, actions, waits",
          severity: "required",
        });
      }
      if (!sourcesContain(sources, /WorkflowsList|AutomationsList/i)) {
        gaps.push({
          id: "list",
          description: "Workflow list/management table with Create Workflow CTA",
          severity: "required",
        });
      }
      return gaps;
    },
  },
  {
    match: (t) => t === "/conversations" || t.includes("inbox"),
    gaps: ({ files, sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /ThreadView|MessageThread|ChatPane/i)) {
        gaps.push({ id: "chat-pane", description: "Active conversation thread + composer", severity: "required" });
      }
      if (!sourcesContain(sources, /ContactPanel|ContactSidebar|DetailsPanel/i)) {
        gaps.push({ id: "contact-panel", description: "Contact details side panel", severity: "required" });
      }
      if (!sourcesContain(sources, /compose|NewMessage|new message|SquarePen/i)) {
        gaps.push({
          id: "compose",
          description: "New message / compose flow shown in inbox video",
          severity: "required",
        });
      }
      if (!sourcesContain(sources, /bulk|assign|tag.*conversation/i)) {
        gaps.push({
          id: "bulk-actions",
          description: "Bulk assign/tag/status actions on conversation list",
          severity: "recommended",
        });
      }
      return gaps;
    },
  },
  {
    match: (t) => t === "/auto-replies",
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /office hours|OfficeHours|business hours/i)) {
        gaps.push({
          id: "office-hours",
          description: "Office hours schedule + inside/outside auto-response messages",
          severity: "required",
        });
      }
      if (!sourcesContain(sources, /compliance|opt-in|opt-out|TCPA/i)) {
        gaps.push({
          id: "compliance",
          description: "Compliance messaging section (opt-in, opt-out, help)",
          severity: "required",
        });
      }
      return gaps;
    },
  },
  {
    match: (t) => t.includes("/campaigns"),
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /CreateCampaign|CampaignEditor|Compose/i)) {
        gaps.push({ id: "create-campaign", description: "Create/send campaign flow or modal", severity: "required" });
      }
      if (!sourcesContain(sources, /ReviewDetails|CampaignReview|Launch/i)) {
        gaps.push({ id: "review", description: "Review/confirm step before send", severity: "recommended" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t.includes("/grow/keywords"),
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /KeywordCreate|CreateKeyword|keyword.*create/i)) {
        gaps.push({ id: "keyword-create", description: "Create keyword form/wizard", severity: "required" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t.includes("/grow/qr"),
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /QrPreview|QRPreview|preview/i)) {
        gaps.push({ id: "qr-preview", description: "QR code live preview panel", severity: "required" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t.includes("/grow/tap-to-join"),
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /CreateLink|create.*link/i)) {
        gaps.push({ id: "create-link", description: "Create tap-to-join link form", severity: "required" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t === "/contacts",
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /ImportWizard|import/i)) {
        gaps.push({ id: "import", description: "Contact import/upload wizard", severity: "required" });
      }
      if (!sourcesContain(sources, /CreateContact|add contact/i)) {
        gaps.push({ id: "create-contact", description: "Add single contact form", severity: "required" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t === "/contacts/lists",
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /CreateListPage|createList/i)) {
        gaps.push({ id: "create-list", description: "Create list form screen", severity: "required" });
      }
      if (!sourcesContain(sources, /ContactsPage|addToLists/i)) {
        gaps.push({ id: "contacts-picker", description: "Contacts list + add-to-lists screen", severity: "required" });
      }
      if (!sourcesContain(sources, /KeywordEditor|edit keyword/i)) {
        gaps.push({ id: "keyword-editor", description: "Edit keyword / connect list screen", severity: "required" });
      }
      if (!sourcesContain(sources, /ToolsPage|Audience Growth|Landing Pages/i)) {
        gaps.push({ id: "tools-hub", description: "Tools / Audience Growth hub screen", severity: "required" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t === "/contacts/fields",
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /CreateFieldForm|createField/i)) {
        gaps.push({ id: "create-field", description: "Create custom field form", severity: "required" });
      }
      if (!sourcesContain(sources, /CustomFieldsList/i)) {
        gaps.push({ id: "fields-list", description: "Custom fields management list", severity: "required" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t === "/contacts/segments",
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /SegmentEditor|CreateSegment|segment.*editor|SegmentBuilder/i)) {
        gaps.push({
          id: "segment-editor",
          description: "Create/edit segment builder with rules, match all/any, preview count",
          severity: "required",
        });
      }
      if (!sourcesContain(sources, /SegmentsList|segments list/i)) {
        gaps.push({ id: "segments-list", description: "Segments management list table", severity: "required" });
      }
      return gaps;
    },
  },
  {
    match: (t) => t.includes("/grow/forms"),
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /FormEditor|CreateForm|form.*builder|FormBuilder/i)) {
        gaps.push({
          id: "form-builder",
          description: "Create/edit web form builder with fields, disclosure, list assignment",
          severity: "required",
        });
      }
      if (!sourcesContain(sources, /FormsList|forms list/i)) {
        gaps.push({ id: "forms-list", description: "Web forms list with stats and create CTA", severity: "required" });
      }
      if (!sourcesContain(sources, /embed|EmbedCode|form\.js/i)) {
        gaps.push({
          id: "embed",
          description: "Embed code / hosted URL panel shown in web forms video",
          severity: "recommended",
        });
      }
      return gaps;
    },
  },
  {
    match: (t) => t.includes("/messaging/media"),
    gaps: ({ sources }) => {
      const gaps: CompletenessGap[] = [];
      if (!sourcesContain(sources, /MediaLibrary|media list|gallery|MmsModal/i)) {
        gaps.push({
          id: "media-library",
          description: "Media library / attachment gallery (not only campaign composer)",
          severity: "recommended",
        });
      }
      return gaps;
    },
  },
];

function listSandboxFiles(sessionId: string): string[] {
  const dir = generatedDirForSession(sessionId);
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const name of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${name.name}` : name.name;
      if (name.isDirectory()) walk(next);
      else if (!next.endsWith(".json") && !next.startsWith("preview.") && next !== "index.html") out.push(next);
    }
  };
  walk("");
  return out.sort();
}

export function auditSandboxCompleteness(sessionId: string, target: string): CompletenessReport {
  const files = listSandboxFiles(sessionId);
  const sources = readAllGeneratedSources(sessionId)
    .map((s) => `${s.path}\n${s.content}`)
    .join("\n\n");

  const gaps: CompletenessGap[] = [];
  for (const rule of ROUTE_RULES) {
    if (rule.match(target)) {
      gaps.push(...rule.gaps({ target, files, sources }));
    }
  }

  const required = gaps.filter((g) => g.severity === "required");
  const instruction = buildCompletenessInstruction(target, gaps, files);

  return {
    sessionId,
    target,
    files,
    gaps,
    complete: required.length === 0,
    instruction,
  };
}

export function buildCompletenessInstruction(
  target: string,
  gaps: CompletenessGap[],
  existingFiles: string[],
): string {
  if (gaps.length === 0) {
    return `COMPLETENESS PASS — re-watch the entire reference video and add ANY missing screens.

TARGET: ${target}

${KIMI_COMPLETENESS_REQUIREMENTS}

${KIMI_MULTI_SCREEN_ARCHITECTURE}

Check for: list, create, edit, review, confirm, success/result, import wizards, builder canvases, config modals/drawers, and feature sub-nav between related screens.
Emit missing component files only; preserve existing working code.`;
  }

  const gapList = gaps.map((g) => `- [${g.severity}] ${g.description}`).join("\n");

  return `COMPLETENESS PASS — generate ALL missing UI from the reference video.

TARGET: ${target}

${KIMI_COMPLETENESS_REQUIREMENTS}

DETECTED GAPS (you MUST close every required item):
${gapList}

EXISTING SANDBOX FILES (preserve and extend — do not delete working code):
${existingFiles.map((f) => `- ${f}`).join("\n")}

Before writing files, emit KIMI_MANIFEST_BEGIN listing every file you will output (existing + new).
Watch the reference video for builder screens, wizards, modals, and secondary pages not yet implemented.
Wire navigation between list ↔ builder ↔ config modals as shown in the video.`;
}

export function printCompletenessReport(report: CompletenessReport): void {
  console.log(`\nKimi completeness — ${report.target}`);
  console.log(`Session: ${report.sessionId}`);
  console.log(`Files: ${report.files.length}`);
  if (report.complete) {
    console.log("Status: complete (no required gaps detected by heuristics)");
    return;
  }
  console.log(`Status: ${report.gaps.filter((g) => g.severity === "required").length} required gap(s)\n`);
  for (const gap of report.gaps) {
    console.log(`  [${gap.severity}] ${gap.id}: ${gap.description}`);
  }
  console.log("");
}
