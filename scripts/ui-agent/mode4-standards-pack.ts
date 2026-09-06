/**
 * Transovo Mode 4 — complete governing standards bundle for Kimi jobs.
 * Kimi must receive full originals, not summaries.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config";

export type StandardsDoc = {
  id: string;
  path: string;
  layer: string;
  required: boolean;
};

/** Authority order — lower index = higher authority. */
export const TRANSOVO_STANDARDS_DOCS: StandardsDoc[] = [
  {
    id: "product-scope",
    path: "docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md",
    layer: "Product scope & domain",
    required: true,
  },
  {
    id: "page-inventory",
    path: "docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md",
    layer: "Approved page inventory",
    required: true,
  },
  {
    id: "governance",
    path: "docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md",
    layer: "Product/UX governance",
    required: true,
  },
  {
    id: "ia-navigation",
    path: "docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md",
    layer: "Canonical IA & terminology",
    required: true,
  },
  {
    id: "hcd",
    path: "docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md",
    layer: "Human-centered design",
    required: true,
  },
  {
    id: "page-architecture",
    path: "docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md",
    layer: "Page architecture",
    required: true,
  },
  {
    id: "visual-design",
    path: "docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md",
    layer: "Visual design system",
    required: true,
  },
  {
    id: "ui-design",
    path: "docs/TRANSOVO-UI-DESIGN-GUIDE.md",
    layer: "Product experience / HCD",
    required: true,
  },
  {
    id: "accessibility",
    path: "docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md",
    layer: "Formal standard #1",
    required: true,
  },
  {
    id: "interaction",
    path: "docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md",
    layer: "Formal standard #4",
    required: true,
  },
  {
    id: "forms",
    path: "docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md",
    layer: "Formal standard #5",
    required: true,
  },
  {
    id: "responsive",
    path: "docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md",
    layer: "Formal standard #6",
    required: true,
  },
  {
    id: "table-grid",
    path: "docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md",
    layer: "Formal standard #7",
    required: true,
  },
  {
    id: "privacy",
    path: "docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md",
    layer: "Formal standard #8",
    required: true,
  },
  {
    id: "security",
    path: "docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md",
    layer: "Formal standard #9",
    required: true,
  },
  {
    id: "datetime",
    path: "docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md",
    layer: "Formal standard #10",
    required: true,
  },
  {
    id: "i18n",
    path: "docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md",
    layer: "Formal standard #11",
    required: true,
  },
  {
    id: "orchestration",
    path: "docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md",
    layer: "Mode 4 orchestration",
    required: true,
  },
];

/** Visual art direction only — not product architecture. */
export const MODE4_ART_DIRECTION_VIDEOS = {
  campaign:
    "Sending Mass Texts in SlickText SlickText Tutorials - SlickText (360p)",
  inbox: "Navigating the SlickText Inbox SlickText Tutorials - SlickText (360p)",
  workflows:
    "Creating Automated Workflows in SlickText SlickText Tutorials - SlickText (360p)",
} as const;

export type LoadedStandardsDoc = StandardsDoc & {
  content: string;
  missing: boolean;
};

export function loadStandardsPack(options: { maxCharsPerDoc?: number } = {}): LoadedStandardsDoc[] {
  const maxChars = options.maxCharsPerDoc ?? 120_000;
  return TRANSOVO_STANDARDS_DOCS.map((doc) => {
    const abs = join(REPO_ROOT, doc.path);
    if (!existsSync(abs)) {
      return { ...doc, content: `(MISSING: ${doc.path})`, missing: true };
    }
    const raw = readFileSync(abs, "utf8");
    const content =
      raw.length > maxChars
        ? `${raw.slice(0, maxChars)}\n\n<!-- truncated for Kimi context budget -->`
        : raw;
    return { ...doc, content, missing: false };
  });
}

export function formatStandardsForKimi(docs: LoadedStandardsDoc[]): string {
  const chunks: string[] = [
    "TRANSOVO GOVERNING STANDARDS (mandatory — authority order top to bottom)",
    "Lower layers never override higher layers.",
    "",
  ];
  for (const doc of docs) {
    chunks.push(
      `===== ${doc.layer}: ${doc.path} =====`,
      doc.missing ? `(FILE MISSING)` : doc.content,
      "",
    );
  }
  return chunks.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  const outFlag = args.find((a) => a.startsWith("--out="));
  const outPath = outFlag?.split("=").slice(1).join("=");
  const pack = loadStandardsPack();
  const formatted = formatStandardsForKimi(pack);
  const missing = pack.filter((d) => d.missing);
  if (missing.length) {
    console.error(`Missing ${missing.length} standards doc(s):`);
    for (const m of missing) console.error(`  - ${m.path}`);
    process.exit(1);
  }
  if (outPath) {
    const abs = join(REPO_ROOT, outPath);
    const { writeFileSync, mkdirSync } = require("node:fs");
    const { dirname } = require("node:path");
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, formatted, "utf8");
    console.log(`Wrote standards pack (${formatted.length} chars) → ${outPath}`);
    return;
  }
  console.log(formatted);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
