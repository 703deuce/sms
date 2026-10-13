'use client'

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
import { PackagesCatalogConnected } from '@/components/appointments/packages/packages-catalog-connected'
import { MembershipsCatalogConnected } from '@/components/appointments/memberships/memberships-catalog-connected'
import { ServiceBookingAdminClient } from '@/components/appointments/service-booking-admin-client'
import { WaitlistAdminClient } from '@/components/appointments/waitlist-admin-client'
import { AppointmentsAnalyticsShell } from '@/components/appointments/analytics-shell'
import { WorkflowsListClient } from '@/components/appointments/workflows-list-client'
import { AutomationsActivityClient } from '@/components/appointments/kimi-ui/automations-activity/components/AutomationsActivityClient'
import { AutomationsTemplatesClient } from '@/components/appointments/automations-templates-client'
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
import { ClassesWorkspaceConnected } from '@/components/appointments/classes/classes-workspace-connected'
import { WorkshopsWorkspaceConnected } from '@/components/appointments/workshops/workshops-workspace-connected'
import { AppointmentBookingSettingsClient } from '@/components/appointments/booking-settings-client'
import { BookingShareHubClient } from '@/components/appointments/booking-share-hub-client'
import { ContractsAdminClient } from '@/components/appointments/contracts-admin-client'
import { AvailabilityWorkspaceOpus } from '@/newui-transplant/connected/scheduling/availability-workspace-opus'
import { RoutingWorkspaceOpus } from '@/newui-transplant/connected/scheduling/routing-workspace-opus'
import { PackagesCatalogOpus } from '@/newui-transplant/connected/scheduling/packages-catalog-opus'
import { MembershipsCatalogOpus } from '@/newui-transplant/connected/scheduling/memberships-catalog-opus'
import type { AppointmentsAnalyticsSection } from '@/lib/products/appointments-settings-tabs'
import { AppointmentsAnalyticsOpusShell } from '@/newui-transplant/connected/scheduling/appointments-analytics-opus-shell'
import { WaitlistAdminOpus } from '@/newui-transplant/connected/scheduling/waitlist-admin-opus'
import { WorkflowsListOpus } from '@/newui-transplant/connected/scheduling/workflows-list-opus'
import {
  AiBookingOpus,
  AutomationsActivityOpus,
  AutomationsTemplatesOpus,
  BookingSettingsOpus,
  BookingShareOpus,
  CommerceHubOpus,
  ContractsOpus,
  EnterpriseOpus,
  FormsDocumentsOpus,
  MeetingPollsOpus,
  NoShowRecoveryOpus,
  PointOfSaleOpus,
  PoliciesOpus,
  PricingPaymentsOpus,
  RecallCampaignsOpus,
  RecallsOpus,
  RoutingFormsOpus,
  SegmentsOpus,
  SetupOpus,
  TeamBookingOpus,
  TeamPagesOpus,
  VoiceRemindersOpus,
} from '@/newui-transplant/connected/scheduling/scheduling-admin-surfaces-opus'
import { ClassesWorkspaceOpus } from '@/newui-transplant/connected/scheduling/classes-workspace-opus'
import { WorkshopsWorkspaceOpus } from '@/newui-transplant/connected/scheduling/workshops-workspace-opus'
import { ContactMergeOpus } from '@/newui-transplant/connected/scheduling/contact-merge-opus'
import { ContactMergeClient } from '@/components/appointments/commerce/contact-merge-client'

export function StaffDirectoryGate() {
  return <SchedulingPageGate opus={<StaffDirectoryOpus />} legacy={<StaffConnected />} />
}

export function LocationsDirectoryGate() {
  return (
    <SchedulingPageGate opus={<LocationsDirectoryOpus />} legacy={<LocationsConnected />} />
  )
}

export function ResourcesDirectoryGate() {
  return (
    <SchedulingPageGate opus={<ResourcesDirectoryOpus />} legacy={<ResourcesConnected />} />
  )
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
    <SchedulingPageGate
      opus={<MembershipsCatalogOpus />}
      legacy={<MembershipsCatalogConnected />}
    />
  )
}

export function WaitlistAdminGate() {
  return (
    <SchedulingPageGate opus={<WaitlistAdminOpus />} legacy={<WaitlistAdminClient />} />
  )
}

export function WorkflowsGate() {
  return (
    <SchedulingPageGate opus={<WorkflowsListOpus />} legacy={<WorkflowsListClient />} />
  )
}

export function AutomationsActivityGate() {
  return (
    <SchedulingPageGate
      opus={<AutomationsActivityOpus />}
      legacy={<AutomationsActivityClient />}
    />
  )
}

export function AutomationsTemplatesGate() {
  return (
    <SchedulingPageGate
      opus={<AutomationsTemplatesOpus />}
      legacy={<AutomationsTemplatesClient />}
    />
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
  return <SchedulingPageGate opus={<TeamBookingOpus />} legacy={<TeamBookingConnected />} />
}

export function TeamPagesGate({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <SchedulingPageGate
      opus={<TeamPagesOpus workspaceSlug={workspaceSlug} />}
      legacy={<TeamPagesClient workspaceSlug={workspaceSlug} />}
    />
  )
}

export function RoutingFormsGate({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <SchedulingPageGate
      opus={<RoutingFormsOpus workspaceSlug={workspaceSlug} />}
      legacy={<RoutingFormsClient workspaceSlug={workspaceSlug} />}
    />
  )
}

export function MeetingPollsGate() {
  return (
    <SchedulingPageGate
      opus={<MeetingPollsOpus />}
      legacy={<MeetingPollsLibraryConnected />}
    />
  )
}

export function AiBookingGate() {
  return (
    <SchedulingPageGate opus={<AiBookingOpus />} legacy={<AiBookingAdminClient />} />
  )
}

export function FormsDocumentsGate() {
  return (
    <SchedulingPageGate opus={<FormsDocumentsOpus />} legacy={<FormsDocumentsClient />} />
  )
}

export function PoliciesGate() {
  return (
    <SchedulingPageGate opus={<PoliciesOpus />} legacy={<AppointmentsPoliciesClient />} />
  )
}

export function SetupGate() {
  return <SchedulingPageGate opus={<SetupOpus />} legacy={<AppointmentsSetupClient />} />
}

export function EnterpriseGate() {
  return (
    <SchedulingPageGate opus={<EnterpriseOpus />} legacy={<EnterpriseSchedulingClient />} />
  )
}

export function ServiceBookingHubGate() {
  return (
    <SchedulingPageGate
      opus={<CommerceHubOpus />}
      legacy={<ServiceBookingAdminClient showPageHeader />}
    />
  )
}

export function PricingPaymentsGate() {
  return (
    <SchedulingPageGate opus={<PricingPaymentsOpus />} legacy={<PricingPaymentsClient />} />
  )
}

export function PointOfSaleGate() {
  return (
    <SchedulingPageGate opus={<PointOfSaleOpus />} legacy={<PointOfSaleConnected />} />
  )
}

export function RecallsGate() {
  return <SchedulingPageGate opus={<RecallsOpus />} legacy={<RecallsHubClient />} />
}

export function RecallCampaignsGate() {
  return (
    <SchedulingPageGate opus={<RecallCampaignsOpus />} legacy={<RecallCampaignsClient />} />
  )
}

export function NoShowRecoveryGate() {
  return (
    <SchedulingPageGate opus={<NoShowRecoveryOpus />} legacy={<NoShowRecoveryClient />} />
  )
}

export function VoiceRemindersGate() {
  return (
    <SchedulingPageGate opus={<VoiceRemindersOpus />} legacy={<VoiceRemindersClient />} />
  )
}

export function SegmentsGate() {
  return (
    <SchedulingPageGate opus={<SegmentsOpus />} legacy={<AppointmentSegmentsClient />} />
  )
}

export function ContractsGate() {
  return <SchedulingPageGate opus={<ContractsOpus />} legacy={<ContractsAdminClient />} />
}

export function BookingContractsGate() {
  return ContractsGate()
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
  const legacy = (
    <AppointmentBookingSettingsClient workspaceSlug={workspaceSlug} workspaceName={workspaceName} />
  )
  return (
    <SchedulingPageGate
      opus={<BookingSettingsOpus workspaceSlug={workspaceSlug} workspaceName={workspaceName} />}
      legacy={legacy}
    />
  )
}

export function BookingShareGate({
  workspaceSlug,
  workspaceName,
  types,
}: {
  workspaceSlug: string
  workspaceName: string
  types: { id: string; name: string }[]
}) {
  return (
    <SchedulingPageGate
      opus={
        <BookingShareOpus
          workspaceSlug={workspaceSlug}
          workspaceName={workspaceName}
          types={types}
        />
      }
      legacy={
        <BookingShareHubClient
          workspaceSlug={workspaceSlug}
          workspaceName={workspaceName}
          types={types}
        />
      }
    />
  )
}

export function ClassesWorkspaceGate({ classId }: { classId: string | null }) {
  return (
    <SchedulingPageGate
      opus={<ClassesWorkspaceOpus classId={classId} />}
      legacy={<ClassesWorkspaceConnected classId={classId} />}
    />
  )
}

export function WorkshopsWorkspaceGate({ workshopId }: { workshopId: string | null }) {
  return (
    <SchedulingPageGate
      opus={<WorkshopsWorkspaceOpus workshopId={workshopId} />}
      legacy={<WorkshopsWorkspaceConnected workshopId={workshopId} />}
    />
  )
}

function contactMergeLegacy() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Contact merge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Combine duplicate contacts. Appointments, packages, and memberships move to the surviving
          record.
        </p>
      </header>
      <ContactMergeClient />
    </div>
  )
}

export function ContactMergeGate() {
  return (
    <SchedulingPageGate opus={<ContactMergeOpus />} legacy={contactMergeLegacy()} />
  )
}

export function PaymentPlansGate() {
  return (
    <SchedulingPageGate
      opus={<ServiceBookingAdminOpus initialSection="paymentPlans" title="Payments" />}
      legacy={<ServiceBookingAdminClient initialSection="paymentPlans" title="Payments" />}
    />
  )
}
