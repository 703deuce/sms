# Transovo product-wide visual redesign — completion matrix

Branch: `cursor/pass-3b-full-visual-redesign-2304`  
Screenshot library: `/opt/cursor/artifacts/screenshots/transovo-product-redesign/`  
Index: `index.html` (regenerate via `npx tsx scripts/capture-transovo-product-redesign.ts`)

**Visual status legend:** PASS | PARTIAL | BLOCKED | NOT REVIEWED

| Product | Route | Desktop | Mobile | Interactions | Material redesign | Functionality preserved | Visual status | Functional blocker |
|---------|-------|---------|--------|--------------|-------------------|-------------------------|---------------|-------------------|
| Voice | /voice/overview | Y | Y | N | Y (shell) | Y | PARTIAL | — |
| Voice | /voice/calls | Y | Y | N | Y | Y | PASS | — |
| Voice | /voice/calls/:id | Y | Y | N | Y | Y | PASS | — |
| Voice | /voice/receptionist | Y | Y | N | Y (ConfigSection) | Y | PARTIAL | — |
| Voice | /voice/knowledge | Y | Y | N | Y (ConfigSection) | Y | PARTIAL | — |
| Voice | /voice/call-handling | Y | Y | N | Y (ConfigSection) | Y | PARTIAL | — |
| Voice | /voice/analytics | Y | Y | N | Y (shell) | Y | PARTIAL | undefined count KPI |
| MCTB | /mctb | Y | Y | N | Y | Y | PASS | — |
| MCTB | /mctb/missed-calls | Y | Y | N | Y (context line) | Y | PARTIAL | — |
| MCTB | /mctb/missed-calls/:id | N | N | N | N | Y | NOT REVIEWED | — |
| MCTB | /mctb/conversations | Y | Y | N | Y (pane CSS) | Y | PARTIAL | — |
| MCTB | /mctb/ai-recovery | Y | Y | N | Y (rows + API guard) | Y | PARTIAL | filter bug mitigated |
| MCTB | /mctb/voicemail | Y | Y | N | Y (shell) | Y | PARTIAL | — |
| MCTB | /mctb/analytics | Y | Y | N | Y (shell) | Y | PARTIAL | — |
| MCTB | /mctb/setup | Y | Y | N | Y (flat rail/rows) | Y | PARTIAL | — |
| MCTB | /mctb/setup/phone | N | N | N | Y (shell) | Y | NOT REVIEWED | — |
| MCTB | /mctb/setup/consent | Y | Y | N | Y (shell) | Y | PARTIAL | — |
| MCTB | /mctb/setup/text-back | N | N | N | Y (shell) | Y | NOT REVIEWED | — |
| MCTB | /mctb/setup/recovery | Y | Y | N | Y (shell) | Y | PARTIAL | — |
| MCTB | /mctb/setup/voicemail | N | N | N | Y (shell) | Y | NOT REVIEWED | — |
| MCTB | /mctb/setup/notifications | N | N | N | Y (shell) | Y | NOT REVIEWED | — |
| MCTB | /mctb/setup/exclusions | N | N | N | Y (shell) | Y | NOT REVIEWED | — |
| MCTB | /mctb/setup/links | N | N | N | Y (shell) | Y | NOT REVIEWED | — |
| MCTB | /mctb/setup/test | N | N | N | Y (shell) | Y | NOT REVIEWED | — |

## Shared primitives changed

- `OperationalPage` / `OperationalPageHeader`
- `ConfigSection`, `ConfigGroupLabel`, `ConfigRow`
- `transovo-operational-redesign.css`, `transovo-config-workspace.css`
- Voice/MCTB layouts import config workspace styles

## Functional defects (tracked)

1. **AI Recovery** — `b.filter is not a function`: guarded `policy.actions` / `collectCapabilities` / booking links array normalization.
2. **Voice Analytics** — undefined count: not fixed this pass.
3. **Dev server stability** — long Playwright capture runs can crash `next dev`; use `next start` after build for full-library capture.

## Screenshot sources

- **After (partial):** `pass-3-visual-proof/after` seed + branch captures where dev stayed up.
- **Before (partial):** `pass-3-verified-good` for calls, call detail, MCTB overview.
