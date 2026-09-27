# MCTB page load performance — root cause and fixes

## Symptom

Stage 2 Opus MCTB pages often show **“Loading…” for 5–20s** before content appears. Target: **~1s** perceived load for operational and setup surfaces.

## Primary root cause (fixed)

**Live Telnyx reconciliation on every read.**

`GET /api/mctb/setup` and `loadMctbOverview()` called `loadMctbSetupPhoneOptionsWithTelnyxSync()`, which for each Telnyx local A2P number:

1. Calls Telnyx APIs (`listTelnyxPhoneNumbers`, campaign assignments, 10DLC inventory, etc.)
2. Updates DB registration state
3. Runs **sequentially** per number

That ran on **almost every page** because:

- `OpusWorkspaceDataProvider` fetched full `/api/mctb/setup` on every MCTB route
- Each setup subsection hook called `/api/mctb/setup` again
- Setup overview fired **six** parallel APIs, each blocked on the slowest (often setup)

Telnyx belongs on **write paths** (activate, consent mode change, explicit “refresh messaging status”), not on routine GET.

### Fix

- **GET** `/api/mctb/setup` and **overview** loader now use `loadMctbSetupPhoneOptions()` (DB only).
- **POST** `/api/mctb/setup` still uses `loadMctbSetupPhoneOptionsWithTelnyxSync()` when activating or validating existing consent (authoritative checks).

## Secondary causes (mitigated)

| Issue | Mitigation |
|--------|------------|
| Shell fetched full setup payload | New `GET /api/mctb/shell-context` (workspace + business line + sender label + TZ only) |
| Duplicate `/api/mctb/setup` in one navigation | `fetchMctbSetup()` 8s in-memory dedupe + shared inflight promise |
| Setup overview waited for 6 APIs | Render after setup + onboarding; enrich exclusions/handoff/live-test/overview in background |
| Missed calls client-only | SSR `initialData` on `/mctb/missed-calls` (Stage 2) |

## Remaining work toward consistent &lt;1s

- SSR or RSC initial data for other Stage 2 routes (conversations, setup sections, voicemail)
- Optional `GET /api/mctb/setup-overview` bundle (one round trip) instead of multiple client fetches
- Explicit “Refresh messaging from Telnyx” control on Numbers/setup phone (calls sync endpoint)
- Review `loadComplianceOverview` / `loadPhoneNumbers` cost on setup GET if still &gt;1s after Telnyx removal

## How to verify

```bash
# After deploy — time hot paths (authenticated cookie or dev-bypass session)
curl -s -o /dev/null -w "shell-context: %{time_total}s\n" "$BASE/api/mctb/shell-context"
curl -s -o /dev/null -w "setup GET: %{time_total}s\n" "$BASE/api/mctb/setup"
curl -s -o /dev/null -w "overview: %{time_total}s\n" "$BASE/api/mctb/overview"
```

Expect setup/overview to drop from multi-second (with Telnyx) to sub-second DB-bound on typical workspaces.
