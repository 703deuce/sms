/**
 * Transovo Mode 4 — complete governing standards bundle for Kimi jobs.
 * Kimi must receive FULL ORIGINAL document content — never summaries or truncation.
 *
 * @see docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config";

export type StandardsLayer =
  | "product-definition"
  | "governance"
  | "foundational-guides"
  | "formal-standards"
  | "orchestration";

export type StandardsDoc = {
  id: string;
  path: string;
  layer: StandardsLayer;
  /** Human-readable layer label for inventory reports */
  layerLabel: string;
  required: boolean;
  /** Applicable Mode 4 job stages */
  applicableJobs: "all" | "foundations" | "golden" | "bulk";
};

/**
 * Authority order — array index = precedence (lower = higher authority).
 * Kimi prompt must present documents in this order.
 */
export const TRANSOVO_STANDARDS_DOCS: StandardsDoc[] = [
  // ── Layer 1: Product definition & complete feature/page specification ──
  {
    id: "mode4-active-scope",
    path: "docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md",
    layer: "product-definition",
    layerLabel: "MODE 4 ACTIVE SCOPE — product/feature authority (supersedes stale V1 passages)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "product-scope-v1",
    path: "docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md",
    layer: "product-definition",
    layerLabel: "Per-page feature specs (appointments sections; ignore OUT OF MODE 4 sections)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "approved-page-inventory",
    path: "docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md",
    layer: "product-definition",
    layerLabel: "Approved customer-facing page/subpage/wizard/surface inventory",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "domain-architecture",
    path: "docs/TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md",
    layer: "product-definition",
    layerLabel: "Appointments platform domain architecture (replaces legacy PRODUCT_ARCHITECTURE.md)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "appointments-workflows-architecture",
    path: "docs/appointments-workflows-architecture.md",
    layer: "product-definition",
    layerLabel: "Appointment workflows domain + UI surfaces",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "ui-design-domains",
    path: "docs/TRANSOVO-UI-DESIGN-GUIDE.md",
    layer: "product-definition",
    layerLabel: "Domain definitions, terminology, product experience principles (30 rules)",
    required: true,
    applicableJobs: "all",
  },

  // ── Layer 2: Governance ──
  {
    id: "governance",
    path: "docs/TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md",
    layer: "governance",
    layerLabel: "TRANSOVO Product Design & UX Governance (authority hierarchy)",
    required: true,
    applicableJobs: "all",
  },

  // ── Layer 3: Foundational product/design guides ──
  {
    id: "hcd-foundational",
    path: "docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md",
    layer: "foundational-guides",
    layerLabel: "Human-centered design principles (foundational)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "ia-navigation-foundational",
    path: "docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md",
    layer: "foundational-guides",
    layerLabel: "Information architecture & navigation (foundational)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "page-architecture",
    path: "docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md",
    layer: "foundational-guides",
    layerLabel: "Page architecture & layout rules",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "visual-design",
    path: "docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md",
    layer: "foundational-guides",
    layerLabel: "Visual design system (typography, color, spacing, motion, density)",
    required: true,
    applicableJobs: "all",
  },

  // ── Layer 4: Formal standards guides #1–#11 (complete) ──
  {
    id: "formal-01-accessibility",
    path: "docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #1 — Accessibility (WCAG / ARIA)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-02-hcd-iso",
    path: "docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #2 — Human-Centered Design (ISO 9241)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-03-ia-navigation",
    path: "docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #3 — IA & Navigation Standards",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-04-interaction-keyboard-focus",
    path: "docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #4 — Interaction, Keyboard & Focus (complete A–DZ)",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-05-forms",
    path: "docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #5 — Forms, Input & Validation",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-06-responsive",
    path: "docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #6 — Responsive, Reflow & Zoom",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-07-table-grid",
    path: "docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #7 — Table & Grid Semantics",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-08-privacy",
    path: "docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #8 — Privacy, Consent & Compliance UX",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-09-security",
    path: "docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #9 — Security & Authentication UX",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-10-datetime",
    path: "docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #10 — Date, Time, Timezone & Locale",
    required: true,
    applicableJobs: "all",
  },
  {
    id: "formal-11-i18n",
    path: "docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md",
    layer: "formal-standards",
    layerLabel: "Formal #11 — Internationalization & Localization",
    required: true,
    applicableJobs: "all",
  },

  // Orchestration (Mode 4 execution rules — not product architecture)
  {
    id: "mode4-orchestration",
    path: "docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md",
    layer: "orchestration",
    layerLabel: "Mode 4 orchestration & Cursor/Kimi role split",
    required: true,
    applicableJobs: "all",
  },
];

/**
 * Documents intentionally EXCLUDED from Kimi standards pack.
 * These are legacy/full-platform inventories — approved V1 scope wins.
 */
export const EXCLUDED_FROM_STANDARDS_PACK: Array<{ path: string; reason: string }> = [
  {
    path: "docs/PRODUCT_ARCHITECTURE.md",
    reason: "Legacy mass-SMS campaign catalog — replaced by TRANSOVO-APPOINTMENTS-DOMAIN-ARCHITECTURE.md",
  },
  {
    path: "docs/FEATURE_INVENTORY.md",
    reason: "Full legacy platform inventory including mass SMS — superseded by TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md",
  },
  {
    path: "docs/V1-ACTIVE-PAGE-MANIFEST.md",
    reason: "Outdated mass-SMS nav manifest — superseded by TRANSOVO-MODE-4-REBUILD-MANIFEST.md",
  },
  {
    path: "docs/transovo-phase-1-inventory.md",
    reason: "MCTB/telephony audit — out of appointments-platform Mode 4 scope",
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
  sourceBytes: number;
  suppliedChars: number;
  fullContent: boolean;
  truncated: boolean;
  missing: boolean;
  sha256: string;
};

export type LoadStandardsPackOptions = {
  /**
   * Truncation is FORBIDDEN for Mode 4 preflight/production.
   * Only set for emergency debugging — preflight will FAIL if truncated.
   */
  maxCharsPerDoc?: number;
};

export function loadStandardsPack(options: LoadStandardsPackOptions = {}): LoadedStandardsDoc[] {
  const maxChars = options.maxCharsPerDoc;
  return TRANSOVO_STANDARDS_DOCS.map((doc) => {
    const abs = join(REPO_ROOT, doc.path);
    if (!existsSync(abs)) {
      return {
        ...doc,
        content: `(MISSING: ${doc.path})`,
        sourceBytes: 0,
        suppliedChars: 0,
        fullContent: false,
        truncated: false,
        missing: true,
        sha256: "",
      };
    }
    const raw = readFileSync(abs, "utf8");
    const sourceBytes = statSync(abs).size;
    const truncated = maxChars !== undefined && raw.length > maxChars;
    const content = truncated
      ? `${raw.slice(0, maxChars!)}\n\n<!-- TRUNCATED — PRELIGHT FAIL -->`
      : raw;
    const sha256 = createHash("sha256").update(raw).digest("hex");
    return {
      ...doc,
      content,
      sourceBytes,
      suppliedChars: content.length,
      fullContent: !truncated && content.length === raw.length,
      truncated,
      missing: false,
      sha256,
    };
  });
}

export function formatStandardsForKimi(docs: LoadedStandardsDoc[]): string {
  const chunks: string[] = [
    "TRANSOVO GOVERNING STANDARDS — FULL ORIGINAL DOCUMENTS",
    "Mandatory authority order (top = highest). Lower layers never override higher.",
    "Page Contract is SUPPLEMENTAL — it does not replace these master specifications.",
    "",
  ];
  for (const doc of docs) {
    chunks.push(
      `===== [${doc.layerLabel}] ${doc.path} =====`,
      doc.missing ? `(FILE MISSING)` : doc.content,
      "",
    );
  }
  return chunks.join("\n");
}

/** Write full standards pack to disk for session audit / Kimi context verification. */
export function writeStandardsPackArtifact(outDir: string, docs?: LoadedStandardsDoc[]): string {
  const pack = docs ?? loadStandardsPack();
  mkdirSync(outDir, { recursive: true });
  const combinedPath = join(outDir, "mode4-standards-pack-full.md");
  writeFileSync(combinedPath, formatStandardsForKimi(pack), "utf8");

  const inventoryPath = join(outDir, "mode4-standards-inventory.json");
  writeFileSync(
    inventoryPath,
    JSON.stringify(
      pack.map((d) => ({
        id: d.id,
        path: d.path,
        layer: d.layer,
        layerLabel: d.layerLabel,
        included: !d.missing,
        fullContent: d.fullContent,
        truncated: d.truncated,
        sourceBytes: d.sourceBytes,
        suppliedChars: d.suppliedChars,
        sha256: d.sha256,
        applicableJobs: d.applicableJobs,
      })),
      null,
      2,
    ),
    "utf8",
  );

  for (const doc of pack) {
    if (doc.missing) continue;
    const safeName = doc.id.replace(/[^a-z0-9-]+/gi, "-");
    writeFileSync(join(outDir, `standards-${safeName}.md`), doc.content, "utf8");
  }

  return combinedPath;
}

export function standardsPackTotals(docs: LoadedStandardsDoc[]): {
  documents: number;
  missing: number;
  truncated: number;
  totalSourceBytes: number;
  totalSuppliedChars: number;
} {
  return {
    documents: docs.length,
    missing: docs.filter((d) => d.missing).length,
    truncated: docs.filter((d) => d.truncated).length,
    totalSourceBytes: docs.reduce((n, d) => n + d.sourceBytes, 0),
    totalSuppliedChars: docs.reduce((n, d) => n + d.suppliedChars, 0),
  };
}
