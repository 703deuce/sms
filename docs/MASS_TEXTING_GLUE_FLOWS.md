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

### Inbox / Conversations (106–136)

| Role | Files |
|------|--------|
| Shell | `src/components/inbox/kimi-conversations-connected.tsx` |
| Adapter | `src/lib/inbox/kimi-inbox-adapter.ts` |
| Compose glue | `src/lib/inbox/inbox-compose.ts` |
| URL filters | `src/lib/inbox/conversation-url-filters.ts` |
| SSR page | `src/app/(app)/conversations/page.tsx` |
| API | `src/app/api/inbox/**`, `src/app/api/sms/send/route.ts` (inbox compose) |

**User flow:**

```
/conversations (cold load, filter=all) → list rows + rail counts
  → click thread → messages panel; row stays pinned
  → reply → PATCH action=reply → message in thread
  → compose new → POST /api/sms/send (inboxCompose) → conversation thread created
```

**Checklist (106–136):**

| # | Item | Glue check |
|---|------|------------|
| 106 | Inbox list cold load | SSR `loadConversations` + client `reloadList` on mount |
| 107 | Default filter = Everyone | `filterSelFromUrlParams` → `{kind:'all',key:'all'}`; URL sync `filter=all` |
| 108 | Rail filter URL persistence | `filterSelToSearchParams` + `syncUrl` on rail change |
| 109 | Product source chips | `InboxProductFilters` + `?product=` in API query |
| 110 | Server-side search | `?q=` → `buildConversationWhere`; no double client filter during debounce |
| 111 | Open thread from list | `pickConvo` → `?conversation=` + `fetchConversation` |
| 112 | Thread pinned when filtered out | `listConvos` + `reloadList` pin selected id |
| 113 | Deep link `?conversation=` | SSR + client fetch on mount |
| 114 | Deep link `?contactId=` | `fetchConversationForContact` or compose modal |
| 115 | Deep link `?draft=` | Opens compose with draft text |
| 116 | Reply in thread | `syncConversationUpdate` → PATCH `action=reply` |
| 117 | MMS reply in thread | Composer `mediaUrls` → PATCH reply |
| 118 | New message compose | `recordInboxComposeSend` after `inboxCompose` send → thread + message |
| 119 | Mark read on open | Optimistic + `patchConversation({ unread: false })` |
| 120 | Status change | `syncConversationUpdate` / bulk PATCH |
| 121 | Assign / unassign | `resolveAssigneeApiId` + PATCH |
| 122 | Tag conversation | `tagKeysToApiNames` + PATCH; `untagOnClose` server-side |
| 123 | Bulk actions | `bulk()` → parallel PATCH + `reloadList` |
| 124 | Internal notes | PATCH `action=note` + mentions |
| 125 | Saved replies | `TemplatePicker` + `/conversations/saved-replies` |
| 126 | Contact panel | `ConversationsContactPanel` → `fetchContactById` |
| 127 | Inbox disabled gate | `inboxEnabled` / permissions before render |
| 128 | Inbox tag management | `TagsSettings` + messaging settings adapter |
| 129 | Product isolation | `productSource` filter in API |
| 130 | Pagination load more | `listHasMore` / `loadMoreList` cursor |
| 131 | Live thread refresh | 15s poll `fetchConversation(selectedId)` |
| 132 | Presence | `/api/inbox/:id/presence` heartbeat |
| 133 | AI inbox assist | `InboxAiAssistPanel` + ai-assist API |
| 134 | Rail counts | Client counts from loaded `convos` (page subset) |
| 135 | Closed-thread reply blocked | `composerBlocked` when setting disallows |
| 136 | Contact detail → inbox | `loadConversations({ contactId })`; link `?conversation=` or `?contactId=` |

**Glue checks:**

- `reloadList` does **not** depend on `selectedId` (uses `selectedIdRef`)
- Preserve SSR `initialConversations` until first successful client fetch (`retainInitialConvosRef`)
- `recordInboxComposeSend` creates conversation + `conversationMessage` after inbox compose send
- Contact detail uses `contactId` filter (not global top-50 scan)
- Activity timeline links use `/conversations?conversation=`
- Search is server-side only once `?q=` is in URL (no misleading client substring filter)

### Contacts / Lists / Segments

| Role | Files |
|------|--------|
| Shells | `src/components/contacts/kimi-*-connected.tsx` |
| Adapters | `src/lib/contacts/kimi-*-adapter.ts` |
| APIs | `src/app/api/contacts/**` |

**User flows:**

```
/contacts → list loads → create → back to list (row visible)
/contacts → import CSV → map columns → summary modal (created/updated/skipped/errors)
/contacts → search/filter → server-side query (not only first 200 rows)
/contacts/lists → create list → add members → count updates
/contacts/tags → create tag → apply to contacts
/contacts/[id] → history/activity → open inbox thread (deep link)
/contacts/segments → create → preview count → use in campaign audience
```

**Checklist (contacts 26–43):**

| # | Item | Glue check |
|---|------|------------|
| 26 | Add contact manually | `KimiContactsConnected` → `createContact` → `POST /api/contacts` → `reload()` |
| 27–28 | Import CSV + map fields | `ImportWizard` + `importContacts` + `parseImportCsvColumns` |
| 29 | Invalid rows don't kill import | API per-row `errors[]`; modal shows row errors |
| 30–31 | Duplicates / updates | Import upsert + `updated` count in modal |
| 32–34 | Lists create / add / remove | `kimi-lists-connected` + `kimi-lists-adapter` |
| 35 | Tags | `/contacts/tags` → `TagsManager` → `POST /api/contacts/tags` |
| 36–37 | Search / filter | `onFiltersChange` → debounced `fetchContacts({ q, status })` |
| 38 | Edit contact | Row → `/contacts/[id]` or `/contacts/fields` edit shell |
| 39 | Delete / archive | `deleteContacts` in connected shell |
| 40 | Contact history | `/contacts/[id]` activity + consent tables |
| 41 | Opted-out marked | `StatusPill` / `StatusChip` for Unsubscribed |
| 42 | STOP can't re-subscribe | `assertCanSubscribeContact` on POST/PATCH; campaigns use suppression in pre-send |
| 43 | Count after reload | Background `reload()` on mount syncs `fetchContactStats()` |

**Glue checks:**

- Background `reload()` on mount syncs stats + rows (not only when SSR seed empty)
- Search/filter hits `/api/contacts?q=` and `status=` server-side (`serverFiltered` skips double client filter)
- Import modal shows `created`, `updated`, `suppressedSkipped`, per-row `errors`
- Manual create blocked for STOP/suppressed numbers (`subscribe-guard.ts`)
- Contact detail inbox link uses `/conversations?conversation=:id`
- List/segment IDs in campaign audience picker match API enrollment

### Campaign creation (44–63)

| Role | Files |
|------|--------|
| Shell / nav | `src/components/campaigns/kimi-campaigns-connected.tsx` |
| Compose / review Kimi | `src/components/kimi/campaigns/components/CreateCampaign.tsx`, `ReviewDetails.tsx`, `AudiencePicker.tsx` |
| Adapter | `src/lib/campaigns/kimi-campaigns-adapter.ts`, `compose-draft.ts` |
| Queue / launch | `src/components/campaigns/broadcast/campaign-confirmation.tsx` |
| Audience math | `src/lib/mass-texting/broadcast/audience.ts`, `pre-send-review.ts` |
| APIs | `src/app/api/mass-texting/campaigns/**` |

**User flow:**

```
/campaigns → Create → compose (audience, message, sender) → Review → Queue (send now) or Schedule
  → /campaigns/:id results
```

**Checklist (44–63):**

| # | Item | Glue check |
|---|------|------------|
| 44 | Create from scratch | `/campaigns/new` → `CreateCampaign` → `saveCampaignDraft` |
| 45 | Select sender number | `/api/numbers` → Send From dropdown |
| 46–47 | One/multiple lists | `AudiencePicker` multi-select + `audience.include[]` |
| 48 | Tags/segments | Segments in picker; tags via segment rules (not direct tag picker) |
| 49–53 | SMS, merge, emoji, link, MMS | Composer toolbar + `MediaPicker` + tracked links |
| 54–55 | Save/reopen draft | `saveCampaignDraft({ forReview: false })`; `?edit=` loads via `parseCampaignConfigJson` |
| 56 | Duplicate | `duplicateCampaign` / Clone menu |
| 57 | Delete draft | `deleteCampaignDraft` → hard DELETE for `DRAFT` status |
| 58–59 | Cost + recipient preview | `fetchLaunchReview` on review; `previewAudience` on compose |
| 60–62 | Dedup, STOP, invalid | `formatAudiencePreviewSummary` / `formatLaunchReviewAudienceSummary` |
| 63 | Segment warning | Multi-segment badge on compose; 1000+ confirm on review/queue |

**Glue checks:**

- `parseCampaignConfigJson` when reopening drafts (`configJson` may be a string from DB)
- `previewAudience` returns full breakdown, not only `eligibleCount`
- `saveCampaignDraft({ forReview: true })` only on Review navigation (draft save allows incomplete schedule)
- Draft DELETE removes row; non-draft DELETE cancels campaign
- Review + queue use same `fetchLaunchReview` recipient/credit counts

### Send-now campaign (64–73)

| Role | Files |
|------|--------|
| Queue / launch UI | `src/components/campaigns/broadcast/campaign-confirmation.tsx` |
| Launch API | `src/app/api/mass-texting/campaigns/[id]/launch/route.ts` |
| Launch engine | `src/lib/mass-texting/campaign-launch.ts` |
| Results / polling | `src/components/campaigns/broadcast/campaign-results.tsx` |
| Detail SSR | `src/app/(app)/campaigns/[campaignId]/page.tsx` |

**User flow:**

```
Review → Send Now → /campaigns/new/queue?id= → countdown → launch → /campaigns/:id (results)
```

**Checklist (64–73):**

| # | Item | Glue check |
|---|------|------------|
| 64 | Send immediately | `ReviewDetails` → `queuePath` → `launchCampaign` |
| 65 | Confirmation shows count/cost | Queue view shows `fetchLaunchReview` recipients + credits |
| 66 | Appears in campaign list | Status `SENDING`/`COMPLETED`; list remount on return (`listKey`) |
| 67–68 | Detail after send + refresh | Redirect to `/campaigns/:id`; SSR + client poll on `SENDING` |
| 69 | Status progresses | `CampaignResultsView` polls `/stats` every 5s while sending |
| 70 | Messages reach test numbers | `TestMessageModal` on compose; live send via worker (not glue) |
| 71 | Partial failure handling | `reconcileCampaignStatus`: partial fail → `COMPLETED` not whole-campaign `FAILED` |
| 72 | Double-click protection | `inFlightRef` + server launch audit idempotency |
| 73 | Refresh during send | Queue checks campaign status on load; `launch-pending` session resumes idempotent launch |

**Glue checks:**

- Queue redirects to detail if campaign already `SENDING`/`COMPLETED` (refresh-safe)
- `launchCampaign` passes idempotency key; server dedupes via `campaignLaunchAudit`
- Queue summary card matches review numbers before countdown

### Scheduled campaigns (74–86)

| Role | Files |
|------|--------|
| Compose schedule | `CreateCampaign.tsx` (Later + date/time/timezone) |
| Review / launch | `ReviewDetails.tsx`, `campaign-launch.ts` |
| Success | `campaign-confirmation.tsx` (`CampaignSuccessView`) |
| Scheduled list | `/campaigns/scheduled` → `CampaignsFilteredView` |
| Detail / cancel | `campaign-detail-view.tsx`, `CampaignActions`, `CampaignsList` menu |
| Worker | `activate-scheduled-campaigns.ts`, `campaign-processor.ts` |

**User flow:**

```
Create → Later + timezone → Review → Schedule Campaign → /campaigns/new/success?mode=later
  → /campaigns/scheduled (row shows campaign timezone)
  → edit (?edit=) or cancel (list menu or detail)
Worker: scheduledAt <= now → SENDING → enqueueDueCampaignMessages
```

**Checklist (74–86):**

| # | Item | Glue check |
|---|------|------------|
| 74 | Schedule for later | Review `Schedule Campaign` → `launchCampaign` → `successPath` with `mode=later` |
| 75 | Timezone shown/stored | `zonedLocalDateTimeToIso` on save; `formatScheduledAt` / `formatZonedScheduleLabel` on display |
| 76 | Scheduled list | `/campaigns/scheduled` fetches `status=scheduled` (`SCHEDULED` only) |
| 77 | Edit scheduled | `updateBroadcastCampaign` allows `SCHEDULED`; `parseCampaignConfig` for string `configJson` |
| 78 | Cancel scheduled | `cancelScheduledCampaign` / DELETE; list menu + `CampaignActions` on detail |
| 79 | Worker activates due | `activateDueScheduledCampaigns` when `scheduledAt <= now` (backend) |
| 80 | Fair queue at send time | `enqueueDueCampaignMessages` fair queue (backend) |
| 81 | Idempotent schedule launch | `campaignLaunchAudit` + idempotency key on launch |
| 82 | Credits reserved at schedule | Launch audit + reservation on `launchCampaign` |
| 83 | Success page after schedule | `CampaignSuccessView` fetches campaign + review for time/credits |
| 84 | Detail shows scheduled time | `formatCampaignDateTime(at, campaignTimezone)` on detail |
| 85 | Pre-send review shows schedule | `buildPreSendReview` returns `timezone`; launch review row |
| 86 | Refresh-safe success | Success page reads API (not only compose draft) after schedule |

**Glue checks:**

- `parseCampaignConfig` when editing scheduled campaigns (`configJson` may be a string from DB)
- `readCampaignTimezone(configJson)` for list/detail/success labels
- Scheduled row **Cancel** in `CampaignsList` kebab menu (not only detail page)
- `CampaignSuccessView` loads `fetchCampaignById` + `fetchLaunchReview` after schedule
- `buildPreSendReview` parses string `configJson` and returns `timezone`

### Drip campaigns (87–105)

| Role | Files |
|------|--------|
| Adapter | `src/lib/drip-campaigns/drip-campaigns-adapter.ts` |
| Section shell | `src/components/drip-campaigns/drip-section-shell.tsx` |
| UI | `src/components/drip-campaigns/*` |
| Service / engine | `src/lib/drip-campaigns/service.ts`, `engine.ts` |
| APIs | `src/app/api/drip-campaigns/**` |
| Pages | `src/app/(app)/automations/drip-campaigns/**` |

**User flow:**

```
/automations/drip-campaigns → list → new → wizard (Setup → Messages → Review)
  → Save & Activate → detail (stats refresh)
  → pause / edit → save → detail (no duplicate rows)
```

**Checklist (87–105):**

| # | Item | Glue check |
|---|------|------------|
| 87 | List cold load | SSR `listDripCampaigns` + client `fetchDripCampaigns` reload on mount |
| 88 | Create from scratch | `/new` → `DripCampaignWizard` |
| 89 | Select sender number | `GET /api/numbers` in wizard |
| 90 | List-join trigger | `list_join` + `triggerConfig.listId` |
| 91 | Tag-added trigger | `tag_added` + `tagId` |
| 92 | Contact-added trigger | `contact_added` fires via `fireContactAddedAutomations` |
| 93 | Form-submitted trigger | `form_submitted` + `formId` from `GET /api/growth/forms` |
| 94 | Multi-message sequence + delays | Steps array + `delayUnit` / `delayAmount` |
| 95 | Merge fields in messages | `MockupMessageToolbar` + `mergeMessageVars` at send |
| 96 | Save as paused | Review secondary → `status: "paused"` |
| 97 | Save & activate | Review primary → `status: "active"` + `assertDripCampaignLaunchReady` |
| 98 | Appears in list after save | `fetchDripCampaigns` reload on mount + return navigation |
| 99 | Open detail | Row link → SSR `loadDripCampaignDetail` |
| 100 | Activate / pause | List toggle, kebab, detail toggle → PATCH with error toast |
| 101 | Edit existing | `/[id]/edit` PATCH → redirect to detail |
| 102 | Duplicate | `action: "duplicate"` prepends row |
| 103 | Delete | DELETE removes row + toast |
| 104 | Launch validation before activate | `assertDripCampaignLaunchReady` on server; errors surfaced in UI |
| 105 | Detail stats from engine | `stats.activeEnrollments` / `totalEnrollments`; poll `/detail` while active |

**Glue checks:**

- `DRIP_SECTION_NAV_TABS` on **all** drip routes via `DripSectionShell` (SMS-only: Drip + Auto Replies)
- `fetchDripCampaigns()` background reload on list mount (not only SSR seed)
- Save & Activate on create → `dripCampaignDetailHref(id)` (not list-only redirect)
- Detail enrollment counts use `stats.*`, not capped `recipients` slice (max 100)
- Active campaigns poll `GET /api/drip-campaigns/:id/detail` every 15s for live stats
- List toggle/patch errors show toast (launch validation failures visible)

### Campaign replies (137–143)

| Role | Files |
|------|--------|
| Inbox filter | `kimi-conversations-connected.tsx`, `conversation-url-filters.ts` |
| List adapter | `kimi-inbox-adapter.ts` (`campaignId` on list rows) |
| Results → inbox | `campaign-results.tsx` |
| Inbound push | `src/lib/messaging/inbound-process.ts` |

**User flow:**

```
/campaigns/:id (Replies tab) → click contact → /conversations?contactId=&campaignId=
  → campaign filter banner → thread opens → reply
```

**Checklist (137–143):**

| # | Item | Glue check |
|---|------|------------|
| 137 | Filter inbox by campaign | `?campaignId=` → `inboxQueryFromFilter` + API filter |
| 138 | Campaign filter persists in URL | `syncUrl`, search debounce, cold-load `filter=all` keep `campaignId` |
| 139 | List rows show campaign context | `mapListItemToKimi` maps `campaignId`, `campaignName`, `productSource` |
| 140 | Campaign filter banner | Banner + clear when `urlCampaignId` set |
| 141 | Results replies tab → inbox | `EngagementTable` links `/conversations?contactId=&campaignId=` |
| 142 | Recipients table → inbox | Recipient name links with `contactId` + `campaignId` |
| 143 | Inbound notification deep link | Push/in-app href includes `campaignId` when conversation has one |

**Glue checks:**

- `clearEphemeralUrlParams` preserves `campaignId` (and `phoneNumberId`)
- List adapter does not drop campaign fields from `/api/inbox` list response
- Campaign results engagement rows include `contactId` from `listBroadcastRecipients`

### Campaign results / analytics (144–159)

| Role | Files |
|------|--------|
| Results UI | `src/components/campaigns/broadcast/campaign-results.tsx` |
| Detail SSR | `src/app/(app)/campaigns/[campaignId]/page.tsx` |
| Analytics | `src/lib/mass-texting/broadcast/analytics.ts` |
| Actions | `src/components/campaigns/campaign-actions.tsx` |

**User flow:**

```
/campaigns/:id → Overview / Recipients / Clicks / Replies / Opt-outs / Activity
  → live poll while SENDING → filters + search on recipients
```

**Checklist (144–159):**

| # | Item | Glue check |
|---|------|------------|
| 144 | Results view for sent campaigns | SSR `showResultsView` for completed/sending/sent/failed/paused |
| 145 | KPI cards | `live.sent/delivered/clicks/replies/optOuts` |
| 146 | Live poll while sending | 5s poll `/stats` + `/recipients` when status SENDING |
| 147 | Overview tab width | `w-full min-w-0` wrapper on overview panel |
| 148 | Recipients tab filters | Delivered/Failed/Clicked/Replied/Opt-Outs chips |
| 149 | Delivered filter accuracy | Exact match — not matching "Undelivered" substring |
| 150 | Clicked/Replied filters | Use `clickedAt` / `repliedAt`, not status substring |
| 151 | Recipient search | Client search on name/phone in filtered set |
| 152 | Failure reason column | `failureReason` from analytics SSR + poll |
| 153 | Engagement tables | Clicks / Replies / Opt-outs tabs with timestamps |
| 154 | Activity feed | Timeline + per-recipient delivery/click/reply/opt-out events |
| 155 | Campaign actions use live status | `CampaignActions` gets `liveStatus` during poll |
| 156 | Duplicate from results | Link to `/campaigns/new?duplicate=` for Kimi broadcast |
| 157 | Cost breakdown | `CostBreakdown` segments + total |
| 158 | Message preview | `MessagePreview` from campaign body |
| 159 | contactId on recipients | SSR + poll map includes `contactId` for inbox deep links |

**Glue checks:**

- `matchesRecipientFilter` uses row fields, not loose status substring matching
- Poll updates `CampaignActions` status (pause/resume while sending)
- SSR recipient map includes `contactId` and `failureReason`

### Keywords / opt-in (160–168)

| Role | Files |
|------|--------|
| Shell | `src/components/grow/kimi-keywords-connected.tsx` |
| Adapter | `src/lib/growth/kimi-keywords-adapter.ts` |
| Runtime | `src/lib/growth/keywords.ts` |
| API | `src/app/api/growth/keywords/**` |
| Page SSR | `src/app/(app)/grow/keywords/page.tsx` |

**User flow:**

```
/grow/keywords → list → create/edit keyword → inbound SMS matches → subscribe + auto-reply
```

**Checklist (160–168):**

| # | Item | Glue check |
|---|------|------------|
| 160 | Keywords list cold load | SSR `keyword.findMany` + client `fetchKeywords` reload |
| 161 | Create keyword | `POST /api/growth/keywords` |
| 162 | Edit keyword | `PATCH /api/growth/keywords/:id` |
| 163 | Delete / clone | DELETE + `cloneKeyword` with preserved fields |
| 164 | List assignment on opt-in | `handleKeywordInbound` → `contactListMember` when `listName` set |
| 165 | No list when createContact=no | API `listName: null` when explicitly omitted; adapter sends `null` |
| 166 | STOP can't re-subscribe via keyword | `assertCanSubscribeContact` in `handleKeywordInbound` |
| 167 | Auto-reply sent | `replyText` from keyword `autoReply` / `confirmation` |
| 168 | Clone preserves fields | `cloneKeyword` copies `autoReply`, `listName`, `confirmation` |

**Glue checks:**

- Keywords page SSR seeds list (no empty flash)
- `reload()` always runs on mount with loading state
- Inbound keyword handler respects suppression / STOP before re-subscribe

### Deliverability edge cases (224–235)

| Role | Files |
|------|--------|
| Blocked contacts | `src/app/(app)/contacts/blocked/page.tsx` |
| Suppression API | `src/app/api/compliance/suppression/route.ts` |
| Subscribe guard | `src/lib/contacts/subscribe-guard.ts` |
| Pre-send review | `src/lib/mass-texting/pre-send-review.ts`, `ReviewDetails.tsx` |

**Checklist (224–235):**

| # | Item | Glue check |
|---|------|------------|
| 224 | STOP adds suppression | `inbound-process` uses `${workspaceId}:p:${phone}` key |
| 225 | Manual suppression POST | Same workspace-scoped `suppressionKey` format |
| 226 | Suppressed excluded from send | `pre-send-review` / audience `suppressedRemoved` |
| 227 | Invalid numbers excluded | `invalidRemoved` in launch review |
| 228 | Review shows adjustments | `formatLaunchReviewAudienceSummary` in `ReviewDetails` |
| 229 | Blocked contacts page | `/contacts/blocked` lists `BLOCKED` status |
| 230 | Unblock contact | `BlockedContactUnblockButton` → PATCH `SUBSCRIBED` |
| 231 | BLOCKED can unblock | `subscribe-guard` blocks UNSUBSCRIBED only, not BLOCKED→SUBSCRIBED |
| 232 | UNSUBSCRIBED can't manual re-subscribe | `assertCanSubscribeContact` on contact PATCH |
| 233 | Keyword can't bypass STOP | `handleKeywordInbound` checks guard |
| 234 | Import skips opted-out | Import route skips UNSUBSCRIBED/BLOCKED upsert to subscribed |
| 235 | Campaign queue shows suppressed count | Launch review `suppressedRemoved` row |

**Glue checks:**

- Suppression keys use workspace prefix consistently (`${workspaceId}:p:${e164}`)
- Blocked page Unblock button calls API (not dead UI)
- BLOCKED ≠ UNSUBSCRIBED for re-subscribe guard semantics

### Browser / navigation (266–277)

| Role | Files |
|------|--------|
| Campaigns list | `campaigns/page.tsx`, `CampaignsList.tsx`, `kimi-campaigns-connected.tsx` |
| Filtered lists | `campaigns-filtered-page.tsx`, `/campaigns/*/page.tsx` |
| Contacts list | `kimi-contacts-connected.tsx`, `contacts/page.tsx` |
| Inbox | `kimi-conversations-connected.tsx` |

**Checklist (266–277):**

| # | Item | Glue check |
|---|------|------------|
| 266 | Campaigns cold load SSR | `listBroadcastCampaigns` → `initialRows` on `/campaigns` |
| 267 | Campaigns client reload | `fetchCampaigns` on mount; retain SSR until rows return |
| 268 | Filtered campaign routes SSR | `CampaignsFilteredPage` server wrapper per status route |
| 269 | Return from detail refreshes list | `kimi-campaigns-connected` `listKey` on pathname return |
| 270 | Contacts cold load SSR | `loadContacts` + `initialContacts` on `/contacts` |
| 271 | Contacts reload keeps SSR | `retainInitialContactsRef` until fetch returns rows |
| 272 | Inbox cold load SSR | `loadConversations` + `retainInitialConvosRef` |
| 273 | Inbox filter=all URL sync | One-time `router.replace` adds `filter=all` |
| 274 | Inbox campaign deep link | `?campaignId=` preserved across filter/search changes |
| 275 | Keywords cold load SSR | `grow/keywords/page.tsx` server seed |
| 276 | Drip list SSR (prior) | `listDripCampaigns` initial rows on automations route |
| 277 | No false empty states | Loading/retain patterns — not "0 items" flash on hydration |

**Glue checks:**

- Server pages seed list data; client reload must not wipe SSR with empty array
- `CampaignsList` / contacts connected use `retainInitial*Ref` pattern from inbox
- Filtered campaign sub-routes use `CampaignsFilteredPage` for SSR parity

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

**Campaigns:** create → review → queue (verify recipient + credits) → detail polls while sending → back to list.

**Inbox:** cold `/conversations` → open thread → send reply.

**Contacts:** create contact → appears in list → search finds it → import CSV → summary modal → add to list.

**Drip:** create draft → activate → open detail → pause.

Log any break in glue file + step number from the flow above.
