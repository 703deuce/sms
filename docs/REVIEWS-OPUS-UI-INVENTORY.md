# Reviews platform — New UI 2 Opus conversion inventory

All routes under `/reviews/*` use `ReviewsOpusShell` (layout) + Opus primitives from `src/newui-transplant/components/app/kit.tsx`, `button.tsx`, `opus-surfaces`, and `segmented-nav`. Legacy `reputation-theme.css`, `dashboard-ui`, and `design-system` shells are removed from Reviews surfaces.

| Route | Primary UI | Opus status |
|-------|------------|-------------|
| `/reviews` → `/reviews/overview` | redirect | **Opus** |
| `/reviews/overview` | `ReviewGrowthCoach`, `ReviewOverviewDashboard`, `QrPerformanceCard` | **Opus** |
| `/reviews/reviews` | `ReviewsDashboard` + `reviews-ui` | **Opus** |
| `/reviews/competitors` | `CompetitorIntelligenceDashboard` | **Opus** |
| `/reviews/insights` | `ReviewInsightsDashboard` | **Opus** |
| `/reviews/analytics` | `ReviewVelocityDashboard` | **Opus** |
| `/reviews/alerts` | `ReputationAlertsDashboard` | **Opus** |
| `/reviews/audit` | `ReputationAuditDashboard`, `ReputationStrategyReport` | **Opus** |
| `/reviews/automations` | `AutomationsHub` | **Opus** |
| `/reviews/contacts` | `ContactsPageClient`, import wizard modal | **Opus** |
| `/reviews/campaigns` | `ReviewCampaignsHub`, create wizard | **Opus** |
| `/reviews/campaigns/[campaignId]` | `CampaignDetailClient`, builder | **Opus** |
| `/reviews/requests` | `ReviewRequestsDashboard` (send, bulk, tracking, poster tabs) | **Opus** |
| `/reviews/templates` | `TemplatesManager` | **Opus** |
| `/reviews/settings` | `ReputationSettingsForm`, alerts, QR link panel | **Opus** |
| `/reviews/qr` | `QrPosterPage` | **Opus** |
| `/reviews/qr-campaigns` | `QrCampaignsList` | **Opus** |
| `/reviews/qr-campaigns/new` | `QrCampaignTypeSelector` | **Opus** |
| `/reviews/qr-campaigns/new/review` | `QrCampaignCreateForm` | **Opus** |
| `/reviews/qr-campaigns/new/payment` | `PaymentQrCreateWizard` | **Opus** |
| `/reviews/qr-campaigns/plans` | `QrPlans` | **Opus** |
| `/reviews/qr-campaigns/[campaignId]` | `QrCampaignEditor` | **Opus** |
| `/reviews/qr-campaigns/[campaignId]/analytics` | `QrCampaignAnalyticsRouter` | **Opus** |
| `/reviews/messaging/*` | redirect to `/compliance` | **N/A** (no UI) |

### Shared primitives (all pages)

- `rep-ui.tsx` — Opus `PageHeader`, `Stat`, `Pill`, `OpusLineTabs`, `buttonVariants`
- `qr-ui.tsx` — Opus cards, `Button`, `Stat`, `EmptyState`
- `review-requests-ui.tsx` — Opus `PageHeader`, `OpusLineTabs`, `Pill`, buttons
- `reviews-ui.tsx` — Opus cards and tokens (no `dashboard-ui`)

### Modals / drawers (in-page)

| Surface | Component | Opus status |
|---------|-----------|-------------|
| Campaign create wizard | `campaign-create-wizard.tsx` | **Opus** |
| Campaign builder | `campaign-builder.tsx` | **Opus** |
| Bulk review request wizard | `review-requests-bulk-wizard.tsx` | **Opus** |
| Contacts import | `contacts-import-wizard.tsx` | **Opus** |
| Review detail drawer | `review-detail-drawer.tsx` | **Opus** |
| Payment QR editor modals | `payment-qr/*` | **Opus** |
| QR poster / template pickers | `poster-template-picker.tsx`, `qr-poster-page.tsx` | **Opus** |
| Upgrade gates | `review-requests-upgrade`, `review-campaigns-upgrade` | **Opus** |

Backend APIs, loaders, and hooks are unchanged.
