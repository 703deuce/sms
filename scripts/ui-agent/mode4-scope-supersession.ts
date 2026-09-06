/**
 * Mandatory scope supersession preamble for every Kimi Mode 4 job.
 * Prepended before standards pack so Kimi never follows stale product-scope passages.
 */
export const MODE4_SCOPE_SUPERSESSION = `MODE 4 SCOPE SUPERSESSION (mandatory — read before all other documents)

The appointments-platform scope document is the highest product authority for this rebuild:
docs/TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md

If docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md (historical filename) or any other document instructs you to:
- create, preserve, surface, or visually incorporate MCTB / Missed Call Text Back UI
- add standalone Compliance or Numbers product areas to nav
- rebuild Campaigns, Grow, mass-SMS, Playbooks, legacy /automations, or /voice/** surfaces
- use obsolete nav tables that include Missed Calls, Compliance, or Setup/Numbers top-level items

IGNORE those instructions for Mode 4. They are preserved in repo only.

MODE 4 REBUILDS ONLY the 58 customer-facing surfaces in docs/TRANSOVO-MODE-4-REBUILD-MANIFEST.md (+ shared foundation).

Authority order for conflicts:
1. TRANSOVO-V1-APPOINTMENTS-PLATFORM-SCOPE.md
2. TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE.md
3. Approved page manifest + per-page specs (appointments sections only)
4. All other standards below

Campaign/Inbox videos = visual art direction ONLY — never import their product structure.

Current UI code = functionality evidence only — not visual or placement authority.`;

/** Patterns that must not appear as active build instructions without OUT OF MODE 4 SCOPE marker */
export const SCOPE_CONFLICT_PATTERNS: Array<{ pattern: RegExp; label: string; doc: string }> = [
  {
    doc: "docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md",
    pattern: /Wire to new nav/i,
    label: "MCTB 'Wire to new nav' (must be out-of-mode4)",
  },
  {
    doc: "docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md",
    pattern: /Tighten MCTB UI/i,
    label: "Active MCTB UI rebuild instruction",
  },
  {
    doc: "docs/PRODUCT_ARCHITECTURE.md",
    pattern: /\/campaigns/i,
    label: "Mass-SMS campaign catalog (doc must not be in pack)",
  },
];

export const REQUIRED_SCOPE_MARKERS = {
  v1Doc: "MODE 4 ACTIVE SCOPE",
  mctbSection: "OUT OF MODE 4 SCOPE",
  scopeDoc: "Explicitly OUT OF SCOPE for Mode 4 UI rebuild",
} as const;
