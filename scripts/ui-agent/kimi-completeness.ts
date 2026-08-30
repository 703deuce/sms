import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generatedDirForSession, readAllGeneratedSources } from "./generated-sandbox";
import { KIMI_COMPLETENESS_REQUIREMENTS } from "./config";

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
      if (!sourcesContain(sources, /ChatPane|ConversationPane|MessageThread/i)) {
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
    match: (t) => t === "/contacts" || t.startsWith("/contacts/"),
    gaps: ({ target, sources }) => {
      const gaps: CompletenessGap[] = [];
      if (target === "/contacts") {
        if (!sourcesContain(sources, /ImportWizard|import/i)) {
          gaps.push({ id: "import", description: "Contact import/upload wizard", severity: "required" });
        }
        if (!sourcesContain(sources, /CreateContact|add contact/i)) {
          gaps.push({ id: "create-contact", description: "Add single contact form", severity: "required" });
        }
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
    return `Review the reference video for any screens, modals, wizards, or builder views not yet in the sandbox. Emit missing files only.`;
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
