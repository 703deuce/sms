#!/usr/bin/env node
/**
 * Rewrites appointment route pages to use SchedulingPageGate via scheduling-unified-gates exports.
 * Run: node scripts/wire-appointments-unified-gates.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(process.cwd(), 'src/app/(app)/appointments')

/** @type {Record<string, { gate: string, props?: string }>} */
const MAP = {
  'staff/page.tsx': { gate: 'StaffDirectoryGate' },
  'locations/page.tsx': { gate: 'LocationsDirectoryGate' },
  'resources/page.tsx': { gate: 'ResourcesDirectoryGate' },
  'classes/page.tsx': { gate: 'ClassesWorkspaceGate', props: 'classId={null}' },
  'workshops/page.tsx': { gate: 'WorkshopsWorkspaceGate', props: 'workshopId={null}' },
  'availability/page.tsx': { gate: 'AvailabilityGate' },
  'routing/page.tsx': { gate: 'RoutingGate' },
  'categories/page.tsx': { gate: 'CategoriesAdminGate' },
  'coupons/page.tsx': { gate: 'CouponsAdminGate' },
  'client-restrictions/page.tsx': { gate: 'ClientRestrictionsAdminGate' },
  'booking/branding/page.tsx': { gate: 'BookingBrandingAdminGate' },
  'packages/page.tsx': { gate: 'PackagesCatalogGate' },
  'memberships/page.tsx': { gate: 'MembershipsCatalogGate' },
  'waitlist/page.tsx': { gate: 'WaitlistAdminGate' },
  'workflows/page.tsx': { gate: 'WorkflowsGate' },
  'automations/activity/page.tsx': { gate: 'AutomationsActivityGate' },
  'automations/templates/page.tsx': { gate: 'AutomationsTemplatesGate' },
  'analytics/page.tsx': { gate: 'AnalyticsOverviewGate' },
  'analytics/booking/page.tsx': { gate: 'AnalyticsBookingGate' },
  'analytics/reminders/page.tsx': { gate: 'AnalyticsRemindersGate' },
  'analytics/automations/page.tsx': { gate: 'AnalyticsAutomationsGate' },
  'analytics/reports/page.tsx': { gate: 'AnalyticsReportsGate' },
  'team-booking/page.tsx': { gate: 'TeamBookingGate' },
  // team-pages: server page passes workspaceSlug — wire manually
  // routing-forms: server page passes workspaceSlug — wire manually
  'meeting-polls/page.tsx': { gate: 'MeetingPollsGate' },
  'ai-booking/page.tsx': { gate: 'AiBookingGate' },
  'forms-documents/page.tsx': { gate: 'FormsDocumentsGate' },
  'policies/page.tsx': { gate: 'PoliciesGate' },
  'setup/page.tsx': { gate: 'SetupGate' },
  'enterprise/page.tsx': { gate: 'EnterpriseGate' },
  'service-booking/page.tsx': { gate: 'ServiceBookingHubGate' },
  'pricing-payments/page.tsx': { gate: 'PricingPaymentsGate' },
  'point-of-sale/page.tsx': { gate: 'PointOfSaleGate' },
  'recalls/page.tsx': { gate: 'RecallsGate' },
  'recall-campaigns/page.tsx': { gate: 'RecallCampaignsGate' },
  'no-show-recovery/page.tsx': { gate: 'NoShowRecoveryGate' },
  'voice-reminders/page.tsx': { gate: 'VoiceRemindersGate' },
  'segments/page.tsx': { gate: 'SegmentsGate' },
  'contracts/page.tsx': { gate: 'ContractsGate' },
  'booking/contracts/page.tsx': { gate: 'BookingContractsGate' },
  'restrictions/page.tsx': { gate: 'RestrictionsGate' },
  'reports/service-booking/page.tsx': { gate: 'ServiceBookingReportsGate' },
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, files)
    else if (name === 'page.tsx') files.push(p)
  }
  return files
}

for (const [rel, { gate, props }] of Object.entries(MAP)) {
  const path = join(ROOT, rel)
  try {
    const body = props
      ? `export default function Page() {\n  return <${gate} ${props} />\n}\n`
      : `export default function Page() {\n  return <${gate} />\n}\n`
    const content = `import { ${gate} } from '@/newui-transplant/connected/scheduling/scheduling-unified-gates'\n\n${body}`
    writeFileSync(path, content)
    console.log('wired', rel)
  } catch (e) {
    console.warn('skip', rel, e.message)
  }
}

console.log('done')
