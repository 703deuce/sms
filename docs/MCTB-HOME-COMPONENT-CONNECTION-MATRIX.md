# MCTB Home — component connection matrix

| REGION | COMPONENT | DISPLAY | READ SOURCE | CLICK | DESTINATION | WRITE | API | EMPTY | LOADING | ERROR | RESPONSIVE | A11Y |
|--------|-----------|---------|-------------|-------|-------------|-------|-----|-------|---------|-------|------------|------|
| Shell sidebar | TransovoSidebar | MCTB nav labels | nav builder | Link | `/mctb/*` | — | — | — | — | — | collapse | focus, labels |
| Shell switcher | ProductShellSwitcher | product names | entitlements | Button | shell home | — | — | hidden | — | — | collapsed | listbox |
| Shell header | Header | MCTB title | pathname | chrome actions | various | PUT workspace | search, notifications | — | — | — | 54px height | headings |
| Send Message | SmsCreateMenu | label | SMS routes | Menu | send flows | — | — | — | — | — | sm+ | menu |
| Page header | MctbOverviewView | Overview + chip | overview.status | Manage setup | setup/recovery | — | `/api/mctb/overview` | — | skeleton | retry card | stack | status role |
| KPI strip | MctbHomeKpiStrip | 4 metrics | overview.kpis | 4 links | list/inbox | — | overview | 0 values OK | skeleton | page error | 2×2 / 4 | list |
| Recent missed | MctbHomeRecentMissedCallsTable | table | overview.recentMissedCalls | caller link | detail | — | overview | copy | skeleton | page error | table / compact | th scope |
| Needs attention | MctbHomeNeedsAttention | issues | buildMctbAttentionItems | row | fix routes | — | overview | compact | skeleton | page error | hide empty mobile | links |
| Conversations | MctbHomeRecentConversations | rows | overview.recentConversations | row | inbox thread | — | overview | copy | skeleton | page error | list | truncate |
| Setup status | MctbHomeSetupStatus | 5 rows | overview.setupHealth | row links | setup paths | — | overview | Not set | skeleton | page error | full width | dl semantics via rows |
| Analytics footer | MctbHomeSetupStatus | 7d line | performanceSnapshot | analytics link | `/mctb/analytics` | — | analytics 7d | — | — | — | wrap | link |

**Controls:** 28 visible interactive (shell + page). **Connected:** 28. **Read-only:** status chip, descriptions. **Broken:** 0 (pending QA). **Backend changes:** 0.
