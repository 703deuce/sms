# Mass Texting — glue code & user-flow review

Use this doc when auditing or changing Kimi-connected Mass Texting surfaces (campaigns, inbox, contacts, drip, media, analytics).

## What “don’t touch Kimi” means

| Layer | Path pattern | Change when… |
|-------|----------------|--------------|
| **Kimi look** (off limits for backend work) | `src/components/kimi/**` JSX layout, spacing, colors, CSS, copy | Only for visual polish (`ui:kimi --mode polish`) |
| **Glue** (primary target) | `*-connected.tsx`, `kimi-*-adapter.ts`, URL/filter helpers, broadcast/service, API routes | Wiring bugs, navigation, fetch/state, SSR↔client |
| **Shared shells** (glue) | `src/components/campaigns/broadcast/*`, `src/components/inbox/*`, `src/components/drip-campaigns/*` | Behavior that connects Kimi UI to APIs |

**Rule:** Fix bugs in glue/adapters first. Do not restyle Kimi components to patch backend issues.

---

## Definition of done (per feature)

Not “API route returns 200.” Done when a real user can complete the journey below **without dead ends, empty false states, or layout breaks on the next screen**.

Always verify:

1. **Cold load** — open the route directly (hard refresh / new tab).
2. **Happy path** — complete the main action start → finish.
3. **Return navigation** — go back to the list/index; data is still there.
4. **SSR + client** — first paint matches after hydration (no “0 items” flash, no filter reset).

---

## Feature map (glue files)

### Campaigns (broadcast)

| Role | Files |
|------|--------|
| Shell / nav | `src/components/campaigns/kimi-campaigns-connected.tsx` |
| Adapter | `src/lib/campaigns/kimi-campaigns-adapter.ts` |
| Compose draft | `src/lib/campaigns/compose-draft.ts` |
| Queue / success | `src/components/campaigns/broadcast/campaign-confirmation.tsx` |
| Results tabs | `src/components/campaigns/broadcast/campaign-results.tsx` |
| Detail SSR | `src/app/(app)/campaigns/[campaignId]/page.tsx` |
| APIs | `src/app/api/mass-texting/campaigns/**` |
| Launch | `src/lib/mass-texting/campaign-launch.ts`, `broadcast/service.ts` |

**User flow (send now):**

```
/campaigns → Create → compose → Review → Queue (countdown) → Launch
  → /campaigns/:id (results) → every tab same width
  → Back to /campaigns (campaign appears in list)
```

**Glue checks:**

- `saveCampaignDraft` → `json.data.id` used for review URL `?id=`
- `ReviewDetails` send-now → `/campaigns/new/queue?id=` (not launch inline)
- `CampaignQueueView` launch → `/campaigns/:id` (detail must not SSR-crash)
- `fetchCampaigns` / `listBroadcastCampaigns` includes launched campaigns (`isBroadcastCampaign` / `campaignLooksLikeMassText`)
- List remounts when returning from detail (`kimi-campaigns-connected` `listKey`)
- Results page root: `w-full max-w-[1200px]` on **all** tabs

### Inbox / Conversations

| Role | Files |
|------|--------|
| Shell | `src/components/inbox/kimi-conversations-connected.tsx` |
| Adapter | `src/lib/inbox/kimi-inbox-adapter.ts` |
| URL filters | `src/lib/inbox/conversation-url-filters.ts` |
| SSR page | `src/app/(app)/conversations/page.tsx` |
| API | `src/app/api/inbox/**` |

**User flow:**

```
/conversations (cold load) → All Conversations shows rows + counts
  → click thread → messages panel opens, row stays visible
  → change filter → optional; open thread should not vanish
  → reply → message appears
```

**Glue checks:**

- Default filter is **all**, not mine (`filter=all` in URL)
- `reloadList` does **not** depend on `selectedId` (opening a thread must not refetch-wipe list)
- Preserve SSR `initialConversations` until first successful client fetch
- `filterSelToSearchParams({ kind: 'all', key: 'all' })` sets `filter=all`
- `listBroadcastRecipients`-style issues: prisma-compat must hydrate relations used in SSR

### Contacts / Lists / Segments

| Role | Files |
|------|--------|
| Shells | `src/components/contacts/kimi-*-connected.tsx` |
| Adapters | `src/lib/contacts/kimi-*-adapter.ts` |
| APIs | `src/app/api/contacts/**` |

**User flows:**

```
/contacts → list loads → create → back to list (row visible)
/contacts/lists → create list → add members → count updates
/contacts/segments → create → preview count → use in campaign audience
```

**Glue checks:**

- Only full `reload()` on mount when SSR seed is empty (`kimi-contacts-connected` pattern)
- List/segment IDs in campaign audience picker match API enrollment
- Import flow: attestation + import API + list refresh

### Drip campaigns (automations)

| Role | Files |
|------|--------|
| UI | `src/components/drip-campaigns/*` |
| Service / engine | `src/lib/drip-campaigns/service.ts`, `engine.ts` |
| APIs | `src/app/api/drip-campaigns/**` |
| Pages | `src/app/(app)/automations/drip-campaigns/**` |

**User flow:**

```
/automations/drip-campaigns → list → new → wizard → save
  → detail → activate → enrollment stats update
  → edit → save (no duplicate-row bugs)
```

**Glue checks:**

- SMS-only nav tabs (`DRIP_SECTION_NAV_TABS`) — no voice/MCTB builder links
- Launch validation (`assertDripCampaignLaunchReady`) before activate
- Detail stats / chart data from engine, not mock

### Media library

| Role | Files |
|------|--------|
| Shell | `src/components/messaging/kimi-media-connected.tsx` |
| Adapter | `src/lib/messaging/kimi-media-adapter.ts` |

**User flow:** `/messaging/media` → upload → pick in campaign compose → MMS sends.

---

## Common glue failure patterns

These caused real user-visible bugs — grep for them when touching glue:

| Pattern | Symptom | Fix direction |
|---------|---------|----------------|
| URL filter not persisted | Rail shows wrong section; data appears only after click | `filterSelToSearchParams` + `filterSelFromUrlParams` |
| Client reload wipes SSR seed | “0 conversations” on load | Keep seed until API returns rows; show loading not empty |
| `useEffect` deps include selection | Click row → list clears | Remove selection from list-fetch deps; use ref for pin |
| Strict campaign detector | Sent campaigns missing from list | `campaignLooksLikeMassText` + parse `configJson` strings |
| prisma-compat missing relation | Next screen “could not load” after success | Add `applyInclude` handler or fetch separately |
| Tab content without `w-full` | Page shrinks on each tab | Full-width wrapper on all tab panels |
| Navigate without remount | Stale list after detail | `key` or refetch on pathname return |
| `json.data` shape mismatch | Silent failure / `undefined` id | Adapter normalizes API response |

---

## Review order (for agents)

1. Read this doc + identify feature’s **user flow** section.
2. Trace glue files only (not Kimi presentation).
3. Walk the flow in code: every `router.push`, `fetch`, `setState` that clears list state.
4. Fix glue; do **not** run large test matrices unless asked — spot-check the flow once.
5. If adding a new Kimi-connected page, add a section here before shipping.

---

## Quick manual smoke (5 min per feature)

**Campaigns:** create → review → queue → detail → recipients tab → back to list.

**Inbox:** cold `/conversations` → open thread → send reply.

**Contacts:** create contact → appears in list → add to list.

**Drip:** create draft → activate → open detail → pause.

Log any break in glue file + step number from the flow above.
