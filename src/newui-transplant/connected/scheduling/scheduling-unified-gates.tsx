'use client'

import type { ReactNode } from 'react'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'
import { StaffConnected } from '@/features/appointments/kimi/staff/staff-connected'
import { LocationsConnected } from '@/features/appointments/kimi/locations/locations-connected'
import { ResourcesConnected } from '@/features/appointments/kimi/resources/resources-connected'
import { AvailabilityConnected } from '@/features/appointments/kimi/availability/availability-connected'
import { RoutingConnected } from '@/features/appointments/kimi/routing/routing-connected'
import { StaffDirectoryOpus } from '@/newui-transplant/connected/scheduling/staff-directory-opus'
import { LocationsDirectoryOpus } from '@/newui-transplant/connected/scheduling/locations-directory-opus'
import { ResourcesDirectoryOpus } from '@/newui-transplant/connected/scheduling/resources-directory-opus'
import { ServiceBookingAdminOpus } from '@/newui-transplant/connected/scheduling/service-booking-admin-opus'
import { SchedulingOpusShell } from '@/newui-transplant/connected/scheduling/scheduling-opus-shell'
import { SchedulingOpusEmbed } from '@/newui-transplant/connected/scheduling/scheduling-opus-embed'
import { PackagesCatalogConnected } from '@/components/appointments/packages/packages-catalog-connected'
import { MembershipsCatalogConnected } from '@/components/appointments/memberships/memberships-catalog-connected'
import { ServiceBookingAdminClient } from '@/components/appointments/service-booking-admin-client'
import { WaitlistAdminClient } from '@/components/appointments/waitlist-admin-client'
import { AppointmentsAnalyticsShell } from '@/components/appointments/analytics-shell'
import { AutomationsActivityClient } from '@/components/appointments/kimi-ui/automations-activity/components/AutomationsActivityClient'
import { AutomationsTemplatesClient } from '@/components/appointments/automations-templates-client'
import { WorkflowsListClient } from '@/components/appointments/workflows-list-client'
import { TeamBookingConnected } from '@/features/appointments/kimi/team-booking/team-booking-connected'
import { TeamPagesClient } from '@/components/appointments/team-pages-client'
import { RoutingFormsClient } from '@/components/appointments/routing-forms-client'
import { MeetingPollsLibraryConnected } from '@/components/appointments/meeting-polls/meeting-polls-library-connected'
import { AiBookingAdminClient } from '@/components/appointments/ai-booking-admin-client'
import { FormsDocumentsClient } from '@/components/appointments/forms-documents-client'
import { AppointmentsPoliciesClient } from '@/components/appointments/appointments-policies-client'
import { AppointmentsSetupClient } from '@/components/appointments/setup-client'
import { EnterpriseSchedulingClient } from '@/components/appointments/enterprise-scheduling-client'
import { PricingPaymentsClient } from '@/components/appointments/pricing-payments-client'
import { PointOfSaleConnected } from '@/features/appointments/kimi/point-of-sale/point-of-sale-connected'
import { RecallsHubClient } from '@/components/appointments/recalls-hub-client'
import { RecallCampaignsClient } from '@/components/appointments/recall-campaigns-client'
import { NoShowRecoveryClient } from '@/components/appointments/no-show-recovery-client'
import { VoiceRemindersClient } from '@/components/appointments/voice-reminders-client'
import { AppointmentSegmentsClient } from '@/components/appointments/appointment-segments-client'
import { ContractsAdminClient } from '@/components/appointments/contracts-admin-client'
import { AppointmentBookingSettingsClient } from '@/components/appointments/booking-settings-client'
import { AvailabilityWorkspaceOpus } from '@/newui-transplant/connected/scheduling/availability-workspace-opus'
import { RoutingWorkspaceOpus } from '@/newui-transplant/connected/scheduling/routing-workspace-opus'
import { PackagesCatalogOpus } from '@/newui-transplant/connected/scheduling/packages-catalog-opus'
import { MembershipsCatalogOpus } from '@/newui-transplant/connected/scheduling/memberships-catalog-opus'
import { ClassesWorkspaceConnected } from '@/components/appointments/classes/classes-workspace-connected'
import { WorkshopsWorkspaceConnected } from '@/components/appointments/workshops/workshops-workspace-connected'
import type { AppointmentsAnalyticsSection } from '@/lib/products/appointments-settings-tabs'
import { AppointmentsAnalyticsOpusShell } from '@/newui-transplant/connected/scheduling/appointments-analytics-opus-shell'

function embedGate(
  title: string,
  description: string,
  legacy: ReactNode,
  body: ReactNode,
) {
  return (
    <SchedulingPageGate
      opus={
        <SchedulingOpusShell title={title} description={description}>
          <SchedulingOpusEmbed>{body}</SchedulingOpusEmbed>
        </SchedulingOpusShell>
      }
      legacy={legacy}
    />
  )
}

export function StaffDirectoryGate() {
  return <SchedulingPageGate opus={<StaffDirectoryOpus />} legacy={<StaffConnected />} />
}

export function LocationsDirectoryGate() {
  return <SchedulingPageGate opus={<LocationsDirectoryOpus />} legacy={<LocationsConnected />} />
}

export function ResourcesDirectoryGate() {
  return <SchedulingPageGate opus={<ResourcesDirectoryOpus />} legacy={<ResourcesConnected />} />
}

export function AvailabilityGate() {
  return (
    <SchedulingPageGate opus={<AvailabilityWorkspaceOpus />} legacy={<AvailabilityConnected />} />
  )
}

export function RoutingGate() {
  return <SchedulingPageGate opus={<RoutingWorkspaceOpus />} legacy={<RoutingConnected />} />
}

export function CategoriesAdminGate() {
  return (
    <SchedulingPageGate
      opus={<ServiceBookingAdminOpus initialSection="categories" title="Categories" />}
      legacy={<ServiceBookingAdminClient initialSection="categories" />}
    />
  )
}

export function CouponsAdminGate() {
  return (
    <SchedulingPageGate
      opus={<ServiceBookingAdminOpus initialSection="coupons" title="Coupons" />}
      legacy={<ServiceBookingAdminClient initialSection="coupons" />}
    />
  )
}

export function ClientRestrictionsAdminGate() {
  return (
    <SchedulingPageGate
      opus={<ServiceBookingAdminOpus initialSection="restrictions" title="Client restrictions" />}
      legacy={<ServiceBookingAdminClient initialSection="restrictions" />}
    />
  )
}

export function BookingBrandingAdminGate() {
  return (
    <SchedulingPageGate
      opus={<ServiceBookingAdminOpus initialSection="theme" title="Booking appearance" />}
      legacy={<ServiceBookingAdminClient initialSection="theme" />}
    />
  )
}

export function PackagesCatalogGate() {
  return (
    <SchedulingPageGate opus={<PackagesCatalogOpus />} legacy={<PackagesCatalogConnected />} />
  )
}

export function MembershipsCatalogGate() {
  return (
    <SchedulingPageGate opus={<MembershipsCatalogOpus />} legacy={<MembershipsCatalogConnected />} />
  )
}

export function WaitlistAdminGate() {
  return embedGate(
    'Waitlist',
    'Manage waitlist entries and offers.',
    <WaitlistAdminClient />,
    <WaitlistAdminClient />,
  )
}

export function WorkflowsGate() {
  return embedGate(
    'Workflows',
    'Automate appointment follow-up and operations.',
    <WorkflowsListClient />,
    <WorkflowsListClient />,
  )
}

export function AutomationsActivityGate() {
  return embedGate(
    'Automation activity',
    'Recent automation runs and outcomes.',
    <AutomationsActivityClient />,
    <AutomationsActivityClient />,
  )
}

export function AutomationsTemplatesGate() {
  return embedGate(
    'Automation templates',
    'Reusable automation starting points.',
    <AutomationsTemplatesClient />,
    <AutomationsTemplatesClient />,
  )
}

function analyticsGate(section: AppointmentsAnalyticsSection) {
  return (
    <SchedulingPageGate
      opus={<AppointmentsAnalyticsOpusShell section={section} />}
      legacy={<AppointmentsAnalyticsShell section={section} />}
    />
  )
}

export function AnalyticsOverviewGate() {
  return analyticsGate('overview')
}
export function AnalyticsBookingGate() {
  return analyticsGate('booking')
}
export function AnalyticsRemindersGate() {
  return analyticsGate('reminders')
}
export function AnalyticsAutomationsGate() {
  return analyticsGate('automations')
}
export function AnalyticsReportsGate() {
  return analyticsGate('reports')
}

export function TeamBookingGate() {
  return embedGate(
    'Team booking',
    'Shared booking links for your team.',
    <TeamBookingConnected />,
    <TeamBookingConnected />,
  )
}

export function TeamPagesGate({ workspaceSlug }: { workspaceSlug: string }) {
  return embedGate(
    'Team pages',
    'Public pages for team members.',
    <TeamPagesClient workspaceSlug={workspaceSlug} />,
    <TeamPagesClient workspaceSlug={workspaceSlug} />,
  )
}

export function RoutingFormsGate({ workspaceSlug }: { workspaceSlug: string }) {
  return embedGate(
    'Routing forms',
    'Qualify callers before booking.',
    <RoutingFormsClient workspaceSlug={workspaceSlug} />,
    <RoutingFormsClient workspaceSlug={workspaceSlug} />,
  )
}

export function MeetingPollsGate() {
  return embedGate(
    'Meeting polls',
    'Group scheduling polls.',
    <MeetingPollsLibraryConnected />,
    <MeetingPollsLibraryConnected />,
  )
}

export function AiBookingGate() {
  return embedGate(
    'AI booking',
    'Configure AI-assisted booking.',
    <AiBookingAdminClient />,
    <AiBookingAdminClient />,
  )
}

export function FormsDocumentsGate() {
  return embedGate(
    'Forms & documents',
    'Intake forms and document collection.',
    <FormsDocumentsClient />,
    <FormsDocumentsClient />,
  )
}

export function PoliciesGate() {
  return embedGate(
    'Policies',
    'Cancellation, reschedule, and booking policies.',
    <AppointmentsPoliciesClient />,
    <AppointmentsPoliciesClient />,
  )
}

export function SetupGate() {
  return embedGate(
    'Get started',
    'Finish appointments setup.',
    <AppointmentsSetupClient />,
    <AppointmentsSetupClient />,
  )
}

export function EnterpriseGate() {
  return embedGate(
    'Enterprise',
    'Enterprise scheduling options.',
    <EnterpriseSchedulingClient />,
    <EnterpriseSchedulingClient />,
  )
}

export function ServiceBookingHubGate() {
  return (
    <SchedulingPageGate
      opus={<ServiceBookingAdminOpus />}
      legacy={<ServiceBookingAdminClient />}
    />
  )
}

export function PricingPaymentsGate() {
  return embedGate(
    'Pricing & payments',
    'Checkout, deposits, and payment rules.',
    <PricingPaymentsClient />,
    <PricingPaymentsClient />,
  )
}

export function PointOfSaleGate() {
  return embedGate(
    'Point of sale',
    'Take payment in person.',
    <PointOfSaleConnected />,
    <PointOfSaleConnected />,
  )
}

export function RecallsGate() {
  return embedGate(
    'Recalls',
    'Bring clients back for rebooking.',
    <RecallsHubClient />,
    <RecallsHubClient />,
  )
}

export function RecallCampaignsGate() {
  return embedGate(
    'Recall campaigns',
    'Campaign-style recall outreach.',
    <RecallCampaignsClient />,
    <RecallCampaignsClient />,
  )
}

export function NoShowRecoveryGate() {
  return embedGate(
    'No-show recovery',
    'Recover missed appointments.',
    <NoShowRecoveryClient />,
    <NoShowRecoveryClient />,
  )
}

export function VoiceRemindersGate() {
  return embedGate(
    'Voice reminders',
    'Outbound voice reminder settings.',
    <VoiceRemindersClient />,
    <VoiceRemindersClient />,
  )
}

export function SegmentsGate() {
  return embedGate(
    'Segments',
    'Client segments for outreach.',
    <AppointmentSegmentsClient />,
    <AppointmentSegmentsClient />,
  )
}

export function ContractsGate() {
  return embedGate(
    'Contracts',
    'Booking contracts and agreements.',
    <ContractsAdminClient />,
    <ContractsAdminClient />,
  )
}

export function BookingContractsGate() {
  return embedGate(
    'Contracts',
    'Booking contracts.',
    <ContractsAdminClient />,
    <ContractsAdminClient />,
  )
}

export function RestrictionsGate() {
  return (
    <SchedulingPageGate
      opus={
        <ServiceBookingAdminOpus
          initialSection="restrictions"
          title="Client booking restrictions"
        />
      }
      legacy={
        <ServiceBookingAdminClient
          initialSection="restrictions"
          title="Client booking restrictions"
        />
      }
    />
  )
}

export function ServiceBookingReportsGate() {
  return (
    <SchedulingPageGate
      opus={<ServiceBookingAdminOpus initialSection="reports" title="Service booking reports" />}
      legacy={<ServiceBookingAdminClient initialSection="reports" />}
    />
  )
}

export function BookingSettingsGate({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string
  workspaceName: string
}) {
  const client = (
    <AppointmentBookingSettingsClient workspaceSlug={workspaceSlug} workspaceName={workspaceName} />
  )
  return embedGate(
    'Booking pages',
    'Public booking links, embeds, and scheduler entry points.',
    client,
    client,
  )
}

export function ClassesWorkspaceGate({ classId }: { classId: string | null }) {
  const legacy = <ClassesWorkspaceConnected classId={classId} />
  return embedGate(
    'Classes',
    'Class series, schedules, capacity, and enrollment.',
    legacy,
    legacy,
  )
}

export function WorkshopsWorkspaceGate({ workshopId }: { workshopId: string | null }) {
  const legacy = <WorkshopsWorkspaceConnected workshopId={workshopId} />
  return embedGate(
    'Workshops',
    'Workshop offerings, schedules, and enrollment.',
    legacy,
    legacy,
  )
}
