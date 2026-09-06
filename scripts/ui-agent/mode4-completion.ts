/**
 * Mode 4 UI Completion & Polish — instruction builder and gap resolution.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  KIMI_MODE4_COMPLETION_PREFIX,
  REPO_ROOT,
} from "./config";
import { getInScopeFeaturesForManifest } from "./mode4-atomic-features";
import type { GoldenGap } from "./mode4-golden-gaps";
import { getGoldenGapEntry } from "./mode4-golden-gaps";
import type { Mode4ManifestEntry } from "./mode4-manifest";
import { MODE4_SCOPE_SUPERSESSION } from "./mode4-scope-supersession";
import { buildPageContract } from "./mode4-page-contract";
import {
  formatStandardsForKimi,
  loadStandardsPack,
} from "./mode4-standards-pack";

export function formatGapsForPrompt(gaps: GoldenGap[]): string {
  if (gaps.length === 0) {
    return "(no structured audit gaps provided — perform a fresh full-spec comparison against Page Contract and atomic features)";
  }
  return [
    "The following audit gaps are HINTS from a prior Blueprint Audit — they are NOT exhaustive.",
    "You must still perform an independent requirement comparison and add anything else the spec requires.",
    "",
    ...gaps.map(
      (g, i) =>
        `${i + 1}. [${g.category}] ${g.summary}\n   ${g.details}${g.atomicFeatureIds?.length ? `\n   Atomic features: ${g.atomicFeatureIds.join(", ")}` : ""}`,
    ),
  ].join("\n\n");
}

export function formatAtomicFeaturesForManifest(manifestId: string): string {
  const features = getInScopeFeaturesForManifest(manifestId);
  if (features.length === 0) return "(none mapped)";
  return features
    .map((f) => `- ${f.id}: ${f.capability} → UI: ${f.uiRepresentation}`)
    .join("\n");
}

/** Resolve audit gaps: explicit file > registry entry > empty (full comparison still required). */
export function resolveGapsForManifest(manifestId: string, gapsFile?: string): GoldenGap[] {
  if (gapsFile) return loadGapsFromFile(gapsFile);
  const entry = getGoldenGapEntry(manifestId);
  return entry?.gaps ?? [];
}

export function buildMode4CompletionInstruction(input: {
  entry: Mode4ManifestEntry;
  gaps: GoldenGap[];
  draftPath?: string;
  screenshotPath?: string;
  screenshotCaptureFailed?: boolean;
  screenshotError?: string;
  extraNotes?: string;
}): string {
  const {
    entry,
    gaps,
    draftPath,
    screenshotPath,
    screenshotCaptureFailed,
    screenshotError,
    extraNotes,
  } = input;
  const standards = formatStandardsForKimi(loadStandardsPack());
  const contract = buildPageContract({ id: entry.id });

  const screenshotBlock = screenshotPath && existsSync(screenshotPath)
    ? `CURRENT RENDERED SCREENSHOT: ${screenshotPath.replace(REPO_ROOT + "/", "")}\nAttached as CURRENT_RENDERED_DRAFT — study this AND the code together. This is the visual truth of what renders today.`
    : screenshotCaptureFailed
      ? `SCREENSHOT CAPTURE FAILED: ${screenshotError ?? "unknown error"}\nProceed using code only, but note visual polish may be limited without a render.`
      : `SCREENSHOT: Will be attached as CURRENT_RENDERED_DRAFT at run time (standard input for this mode).`;

  return [
    MODE4_SCOPE_SUPERSESSION,
    "",
    KIMI_MODE4_COMPLETION_PREFIX,
    "",
    "AUTHORITY ORDER (mandatory — same as first-pass Mode 4):",
    "1 Product scope/domain + approved page/feature specs",
    "2 Governance",
    "3 Foundational guides (HCD, IA, page architecture, visual system)",
    "4 Formal standards #1–#11",
    "5 Runtime/backend requirements (Page Contract + existing code)",
    "6 Golden screens (visual rhythm reference)",
    "7 Campaign/Inbox art direction (polish level only)",
    "8 CURRENT_RENDERED_DRAFT screenshot + existing Kimi draft code (BASELINE)",
    "",
    `TARGET: ${entry.canonicalPath} (${entry.route})`,
    `ARCHETYPE: ${entry.archetype}`,
    draftPath ? `BASELINE DRAFT CODE: ${draftPath.replace(REPO_ROOT + "/", "")}` : "",
    screenshotBlock,
    "",
    "═══ FRESH REQUIREMENT COMPARISON (mandatory) ═══",
    "Independently compare current UI (screenshot + code) against EVERY applicable requirement below.",
    "Do not rely only on the audit gap list. Add anything the spec requires that is still missing.",
    "",
    "═══ AUDIT GAP HINTS (non-exhaustive) ═══",
    formatGapsForPrompt(gaps),
    "",
    "═══ ATOMIC FEATURES FOR THIS SURFACE (checklist) ═══",
    formatAtomicFeaturesForManifest(entry.id),
    "",
    "PAGE CONTRACT:",
    contract,
    "",
    "FULL GOVERNING STANDARDS PACK:",
    standards,
    "",
    "EXECUTION REMINDER:",
    "Preserve → Complete → Correct → Polish. Stop at the stopping condition. No self-grading.",
    "- Use mock data only. No production API wiring.",
    "- Every button, menu item, accordion, and row action must open designed UI.",
    extraNotes ? `\nADDITIONAL NOTES:\n${extraNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function loadGapsFromFile(filePath: string): GoldenGap[] {
  const abs = filePath.startsWith("/") ? filePath : join(REPO_ROOT, filePath);
  const raw = JSON.parse(readFileSync(abs, "utf8")) as { gaps?: GoldenGap[] } | GoldenGap[];
  if (Array.isArray(raw)) return raw;
  if (raw.gaps && Array.isArray(raw.gaps)) return raw.gaps;
  throw new Error(`Invalid gaps file: ${filePath} — expected GoldenGap[] or { gaps: GoldenGap[] }`);
}
