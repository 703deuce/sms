/**
 * Regenerates docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md from sidebar inventory.
 * Run: npx tsx scripts/generate-unified-frontend-migration-matrix.ts
 */
import { writeFileSync } from 'node:fs'
import { buildUnifiedAppointmentsNav } from '../src/lib/products/unified-appointments-nav'

type Status = 'opus_complete' | 'opus_partial' | 'legacy_kimi' | 'redirect' | 'platform_shared'

const ROUTE_STATUS: Record<string, { status: Status; replacement: string; legacy: string; notes?: string }> = {
  '/appointment-reminders': {
    status: 'opus_partial',
    legacy: 'calendar-connected.tsx + kimi reference.css',
    replacement: 'ar-calendar-workspace-page.tsx (Opus calendar; native sheets migrated)',
    notes: 'Imported events use AppointmentDetailDrawer; native uses ArNativeAppointmentSheet',
  },
  '/appointment-reminders/appointments': {
    status: 'opus_partial',
    legacy: 'appointments list + kimi detail',
    replacement: 'appointments-page.tsx + appointment-detail-drawer.tsx',
    notes: 'Booking tab uses ArAppointmentSchedulingPanel; quick create Opus',
  },
  '/appointment-reminders/booking': {
    status: 'opus_partial',
    legacy: 'booking-settings-client + link hub',
    replacement: 'booking-page-opus.tsx',
    notes: 'Meetings/services Opus; other admin routes still legacy',
  },
  '/appointment-reminders/booking/meetings': { status: 'opus_complete', legacy: 'MeetingsWorkspaceConnected', replacement: 'ar-meetings-workspace-opus.tsx' },
  '/appointment-reminders/booking/services': { status: 'opus_partial', legacy: 'services workspace kimi', replacement: 'AR booking services Opus routes' },
  '/appointment-reminders/reminders': { status: 'opus_complete', legacy: '—', replacement: 'reminders-page.tsx' },
  '/appointment-reminders/ai-rescheduler': { status: 'opus_complete', legacy: '—', replacement: 'ar-ai-rescheduler-opus.tsx' },
  '/appointment-reminders/responses': { status: 'opus_complete', legacy: '—', replacement: 'ar-responses-opus.tsx' },
  '/conversations': { status: 'platform_shared', legacy: 'kimi-inbox', replacement: 'kimi-conversations-connected (Mass Texting shell — migrate to Opus inbox)' },
  '/appointments/scheduled': { status: 'opus_complete', legacy: 'Scheduling/Kimi list', replacement: 'appointments-scheduled-list-opus.tsx' },
  '/appointments/new': { status: 'opus_complete', legacy: 'Kimi create', replacement: 'ar-appointment-create-opus.tsx' },
  '/appointments/clients': { status: 'opus_complete', legacy: 'ClientsConnected', replacement: 'clients-directory-opus.tsx' },
  '/appointments/services': { status: 'opus_complete', legacy: 'ServicesWorkspaceConnected', replacement: 'ar-services-workspace-opus.tsx' },
  '/appointments/meetings': { status: 'opus_complete', legacy: 'MeetingsWorkspaceConnected', replacement: 'ar-meetings-workspace-opus.tsx' },
  '/appointments/classes': { status: 'opus_complete', legacy: 'ClassesWorkspaceConnected', replacement: 'ar-classes-workspace-opus.tsx' },
  '/appointments/workshops': { status: 'opus_complete', legacy: 'WorkshopsWorkspaceConnected', replacement: 'ar-workshops-workspace-opus.tsx' },
  '/appointments/booking': { status: 'opus_partial', legacy: 'AppointmentBookingSettingsClient', replacement: 'BookingSettingsGate' },
  '/appointments/booking/branding': { status: 'opus_partial', legacy: 'ServiceBookingAdminClient', replacement: 'ServiceBookingAdminOpus' },
  '/appointments/staff': { status: 'opus_complete', legacy: 'StaffConnected', replacement: 'staff-directory-opus.tsx' },
  '/appointments/locations': { status: 'opus_complete', legacy: 'LocationsConnected', replacement: 'locations-directory-opus.tsx' },
  '/appointments/resources': { status: 'opus_complete', legacy: 'ResourcesConnected', replacement: 'resources-directory-opus.tsx' },
  '/appointments/availability': { status: 'opus_partial', legacy: 'AvailabilityConnected', replacement: 'availability-workspace-opus.tsx' },
  '/appointments/routing': { status: 'opus_partial', legacy: 'RoutingConnected', replacement: 'routing-workspace-opus.tsx' },
  '/appointments/packages': { status: 'opus_partial', legacy: 'PackagesCatalogConnected', replacement: 'packages-catalog-opus.tsx' },
  '/appointments/memberships': { status: 'opus_partial', legacy: 'MembershipsCatalogConnected', replacement: 'memberships-catalog-opus.tsx' },
  '/appointments/categories': { status: 'opus_partial', legacy: 'ServiceBookingAdminClient', replacement: 'ServiceBookingAdminOpus' },
  '/appointments/coupons': { status: 'opus_partial', legacy: 'ServiceBookingAdminClient', replacement: 'ServiceBookingAdminOpus' },
  '/appointments/client-restrictions': { status: 'opus_partial', legacy: 'ServiceBookingAdminClient', replacement: 'ServiceBookingAdminOpus' },
  '/appointments/analytics': { status: 'opus_partial', legacy: 'AppointmentsAnalyticsShell', replacement: 'appointments-analytics-opus-shell.tsx' },
  '/appointments/analytics/booking': { status: 'opus_partial', legacy: 'AppointmentsAnalyticsShell', replacement: 'appointments-analytics-opus-shell.tsx' },
  '/appointments/analytics/reminders': { status: 'opus_partial', legacy: 'AppointmentsAnalyticsShell', replacement: 'appointments-analytics-opus-shell.tsx' },
  '/appointments/analytics/automations': { status: 'opus_partial', legacy: 'AppointmentsAnalyticsShell', replacement: 'appointments-analytics-opus-shell.tsx' },
  '/appointments/analytics/reports': { status: 'opus_partial', legacy: 'AppointmentsAnalyticsShell', replacement: 'appointments-analytics-opus-shell.tsx' },
  '/appointments/workflows': { status: 'opus_complete', legacy: 'WorkflowsListClient', replacement: 'workflows-list-opus.tsx' },
  '/appointments/waitlist': { status: 'opus_complete', legacy: 'WaitlistAdminClient', replacement: 'waitlist-admin-opus.tsx' },
  '/appointments/segments': { status: 'opus_partial', legacy: 'AppointmentSegmentsClient', replacement: 'SegmentsOpus + SchedulingOpusBody' },
  '/appointments/service-booking': { status: 'opus_partial', legacy: 'ServiceBookingAdminClient', replacement: 'CommerceHubOpus / ServiceBookingAdminOpus' },
  '/appointments/commerce': { status: 'opus_partial', legacy: 'redirect only', replacement: 'ServiceBookingHubGate / CommerceHubOpus' },
  '/appointments/commerce/contact-merge': { status: 'opus_partial', legacy: 'inline page', replacement: 'contact-merge-opus.tsx' },
  '/appointments/booking/share': { status: 'opus_partial', legacy: 'BookingShareHubClient', replacement: 'BookingShareOpus' },
  '/appointments/team-booking': { status: 'opus_complete', legacy: 'TeamBookingWorkspaceConnected', replacement: 'team-booking-opus.tsx' },
  '/appointments/policies': { status: 'opus_partial', legacy: 'AppointmentsPoliciesClient', replacement: 'PoliciesOpus' },
  '/appointments/forms-documents': { status: 'opus_partial', legacy: 'FormsDocumentsClient', replacement: 'FormsDocumentsOpus' },
  '/appointments/automations/activity': { status: 'opus_partial', legacy: 'AutomationsActivityClient', replacement: 'AutomationsActivityOpus' },
  '/appointments/automations/templates': { status: 'opus_partial', legacy: 'AutomationsTemplatesClient', replacement: 'AutomationsTemplatesOpus' },
  '/appointments/pricing-payments': { status: 'opus_partial', legacy: 'PricingPaymentsClient', replacement: 'PricingPaymentsOpus' },
  '/appointments/point-of-sale': { status: 'opus_partial', legacy: 'PointOfSaleConnected', replacement: 'PointOfSaleOpus' },
  '/appointments/recalls': { status: 'opus_partial', legacy: 'RecallsHubClient', replacement: 'RecallsOpus' },
  '/appointments/recall-campaigns': { status: 'opus_partial', legacy: 'RecallCampaignsClient', replacement: 'RecallCampaignsOpus' },
  '/appointments/no-show-recovery': { status: 'opus_partial', legacy: 'NoShowRecoveryClient', replacement: 'NoShowRecoveryOpus' },
  '/appointments/voice-reminders': { status: 'opus_partial', legacy: 'VoiceRemindersClient', replacement: 'VoiceRemindersOpus' },
  '/appointments/ai-booking': { status: 'opus_partial', legacy: 'AiBookingAdminClient', replacement: 'AiBookingOpus' },
  '/appointments/meeting-polls': { status: 'opus_partial', legacy: 'MeetingPollsLibraryConnected', replacement: 'MeetingPollsOpus' },
  '/appointments/setup': { status: 'opus_partial', legacy: 'AppointmentsSetupClient', replacement: 'SetupOpus' },
  '/appointments/enterprise': { status: 'opus_partial', legacy: 'EnterpriseSchedulingClient', replacement: 'EnterpriseOpus' },
}

function flattenNav() {
  const items = buildUnifiedAppointmentsNav()
  const rows: Array<{ section: string; label: string; href: string }> = []
  for (const item of items) {
    rows.push({ section: item.label, label: item.label, href: item.href })
    for (const child of item.children || []) {
      rows.push({ section: item.label, label: child.label, href: child.href })
    }
  }
  return rows
}

function statusLabel(s: Status) {
  switch (s) {
    case 'opus_complete':
      return 'Opus complete'
    case 'opus_partial':
      return 'Opus partial'
    case 'legacy_kimi':
      return 'Legacy Kimi (must replace)'
    case 'redirect':
      return 'Redirect'
    case 'platform_shared':
      return 'Shared platform (Opus migration TBD)'
  }
}

function main() {
  const rows = flattenNav()
  const seen = new Set<string>()
  const lines: string[] = [
    '# Unified Appointments — frontend migration matrix',
    '',
    '**Doctrine:** Full New UI2 Opus frontend replacement. Legacy Scheduling/Kimi visuals must not render in unified nav destinations. Backends, hooks, and API clients may be reused.',
    '',
    'Regenerate: `npx tsx scripts/generate-unified-frontend-migration-matrix.ts`',
    '',
    '| Nav section | Label | Route | Migration status | Legacy frontend | Opus replacement | Notes |',
    '|---|---|---|---|---|---|---|',
  ]

  for (const row of rows) {
    if (seen.has(row.href)) continue
    seen.add(row.href)
    const meta = ROUTE_STATUS[row.href]
    const status = meta?.status ?? 'legacy_kimi'
    lines.push(
      `| ${row.section} | ${row.label} | \`${row.href}\` | ${statusLabel(status)} | ${meta?.legacy ?? 'Scheduling/Kimi connected shell'} | ${meta?.replacement ?? '— (not started)'} | ${meta?.notes ?? ''} |`,
    )
  }

  lines.push('', '## Calendar Opus components (unified mode)', '')
  lines.push('| Capability | Legacy component | Opus component | Status |')
  lines.push('|---|---|---|---|')
  const cal = [
    ['Quick create', 'CalendarQuickCreateSheet + reference.css', 'ArCalendarQuickCreateSheet', 'Done'],
    ['Native detail / manage', 'CalendarEventDrawer', 'ArNativeAppointmentSheet', 'Done (core actions)'],
    ['Reschedule', 'CalendarRescheduleSheet', 'ArCalendarRescheduleSheet', 'Done'],
    ['Waitlist match', 'CalendarWaitlistMatchDrawer', 'ArCalendarWaitlistSheet', 'Done'],
    ['Recurring scope', 'CalendarRecurringScopeDialog', 'ArCalendarRecurringScopeDialog', 'Done'],
    ['Filters', 'CalendarFilterBar', 'ArCalendarFilterBar', 'Done'],
    ['Imported detail', '—', 'AppointmentDetailDrawer / ArCalendarEventSheet', 'Partial'],
  ]
  for (const r of cal) lines.push(`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`)

  lines.push('', '## Release gate (PR #653)', '')
  lines.push('- [ ] Every row `legacy_kimi` → `opus_complete` or intentional redirect')
  lines.push('- [ ] No `kimi-ui` / `cal-drawer` imports under `newui-transplant` unified paths')
  lines.push('- [ ] `npm run build` green on CI')
  lines.push('- [ ] Browser pass on all 13 nav sections')

  const out = lines.join('\n') + '\n'
  writeFileSync('docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md', out)
  console.log('Wrote docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md')
}

main()
