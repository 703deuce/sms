# MCTB Home (`/mctb`) — existing system audit

Audit date: 2026-09-12. Route: `/mctb`. Server loader: `loadMctbOverview` → `MctbOverviewView`. Client refresh: `GET /api/mctb/overview`.

## Global shell (shared)

| Region | Data source | API / query | Click / action | Destination | Loading | Empty | Error |
|--------|-------------|-------------|----------------|-------------|---------|-------|-------|
| MCTB sidebar nav | `resolveProductSidebarNav` + `buildMctbV1Nav` | N/A (static nav) | Navigate | `/mctb/*` | N/A | N/A | N/A |
| Product switcher | `ProductShellSwitcher` | entitlements from layout | Switch product | Appointments or MCTB home | N/A | Hidden if single product | N/A |
| Shell header title | `getMctbPageTitle(pathname)` | N/A | N/A | N/A | N/A | N/A | N/A |
| Send Message | `SmsCreateMenu` | SMS routes | Open menu → compose | `/send/*` | N/A | N/A | N/A |
| Global search | `Header` | `GET /api/search?q=` | Result row | result `href` | debounced | no results | silent fail |
| Active number | `Header` + workspace | `PUT /api/workspace` | Select number | persists `activeFromNumberId` | N/A | N/A | best-effort |
| Notifications | `Header` | `GET/PATCH /api/notifications` | Open / mark read | `notification.href` | on open | empty list | ignore |
| Help | `Header` | link | Open help | external/docs | N/A | N/A | N/A |
| Profile / account | `Header` | session | Menu actions | settings/logout | N/A | N/A | N/A |
| Message Credits | `TransovoSidebar` + `metrics.creditsRemaining` | shell `loadShellData` | Upgrade | `/settings/billing` | N/A | N/A | N/A |
| Account block | sidebar user props | session / shell | collapse sidebar | N/A | N/A | N/A | N/A |

## Page body — Overview

| Region | Data source | API | Click | Write | Destination |
|--------|-------------|-----|-------|-------|-------------|
| Overview title + status chip | `MctbOverviewPayload.status`, `statusLabel` | overview | N/A | N/A | N/A |
| Page description | static copy | N/A | N/A | N/A | N/A |
| Manage setup | `headerCta()` from status | overview | Link | N/A | `/mctb/setup` or recovery |
| KPI: Missed calls today | `kpis.missedCallsToday` | overview (+ prisma counts server-side) | Link | N/A | `/mctb/missed-calls` |
| KPI: Recovery texts sent | `kpis.recoveryTextsToday` | overview | Link | N/A | `/mctb/missed-calls` |
| KPI: Replies | `kpis.repliesToday` | overview | Link | N/A | `/mctb/conversations` |
| KPI: Need a reply | `kpis.needsReplyCount` | overview | Link | N/A | `/mctb/conversations?filter=needs_reply` |
| Recent missed calls | `recentMissedCalls[]` | overview | Caller link / row | N/A | `/mctb/missed-calls/[id]` |
| View all | static | N/A | Link | N/A | `/mctb/missed-calls` |
| Needs attention | `buildMctbAttentionItems(data)` | derived from overview fields | Row link | N/A | setup, phone, conversations, detail |
| Recent conversations | `recentConversations[]` | overview (prisma) | Row link | N/A | `/mctb/conversations?conversation=` |
| Open inbox | static | N/A | Link | N/A | `/mctb/conversations` |
| Setup status rows | `setupHealth` | overview | Value link | N/A | setup section routes |
| 7-day footer | `performanceSnapshot` | `loadMctbAnalytics` 7d | View analytics | N/A | `/mctb/analytics` |

## Status derivation (canonical, server)

`loadMctbOverview` sets `status`: `setup_incomplete` | `paused` | `messaging_blocked` | `active` from onboarding, schedule pause, messaging readiness, and runtime — no client override.

## Loading / error (page)

- **Loading:** skeleton KPI + sections (`aria-busy`).
- **Error:** full-page retry card; `GET /api/mctb/overview` failure.

Backend/runtime unchanged in this pass — UI-only recomposition and shell styling.
