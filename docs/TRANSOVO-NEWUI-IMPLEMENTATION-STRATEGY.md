# TRANSOVO — New UI → Production Implementation Strategy

**Supersedes** the phased “migrate every route” plan in the integration audit.  
**Authority:** Product directive — controlled frontend transplant, not a full redesign project.

## Core rule

**New UI for presentation. Existing production app for functionality.**

## Route categories

| Category | Rule |
|----------|------|
| **A** | newui route exists → use newui presentation; wire production loaders/APIs/mutations; remove all mock/demo behavior |
| **B** | newui exists but incomplete → newui visual foundation + preserve missing production controls; keep old UI reachable until certified |
| **C** | No newui page → **keep existing production page** inside new global shell; backlog for later rebuild using newui components |

Do **not** delete old production UI until replacement is certified.

## Implementation stages (current)

| Stage | Scope |
|-------|--------|
| **0** | Safety baseline — branch from `origin/master`, tests recorded, `newui/` retained as reference |
| **1** | Design tokens + global shell (sidebar, topbar) on real session/workspace/entitlements/call-handling read state |
| **2** | 25 direct newui routes — wire reads/writes per migration matrix |
| **3** | Functional gap completion (receptionist, knowledge, call-handling, inbox, setup) |
| **4** | Browser certification |
| **5** | Production deploy after certification |

## Shell rollout

- Enabled by default; set `NEXT_PUBLIC_NEWUI_SHELL=0` to disable.
- `shouldUseNewUiShell()` — voice, mctb, integrations, settings, and MCTB universal chrome paths.
- Category **C** pages render **old body** inside **new shell**.

## Call handling

- One authoritative state from server layout → `CallHandlingProvider`.
- No duplicate GET `/api/call-handling` from shell; switcher uses `requireProvider` under new shell.
- No Telnyx reconciliation on ordinary navigation.

## Reference

- Inventory audit: `docs/TRANSOVO-NEWUI-PRODUCTION-INTEGRATION-AUDIT.md` (on branch `cursor/newui-production-integration-audit-2304`)
- Visual reference: top-level `newui/` (do not deploy as second app)
