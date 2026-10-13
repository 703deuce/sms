'use client'

import type { ReactNode } from 'react'
import { SchedulingOpusBody } from '@/newui-transplant/connected/scheduling/scheduling-opus-body'
import { AutomationsActivityClient } from '@/components/appointments/kimi-ui/automations-activity/components/AutomationsActivityClient'
import { AutomationsTemplatesClient } from '@/components/appointments/automations-templates-client'
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
import { BookingShareHubClient } from '@/components/appointments/booking-share-hub-client'
import { ServiceBookingAdminClient } from '@/components/appointments/service-booking-admin-client'

function surface(title: string, description: string, children: ReactNode) {
  return (
    <SchedulingOpusBody title={title} description={description}>
      {children}
    </SchedulingOpusBody>
  )
}

export function AutomationsActivityOpus() {
  return surface(
    'Automation activity',
    'Recent automation runs and outcomes.',
    <AutomationsActivityClient />,
  )
}

export function AutomationsTemplatesOpus() {
  return surface(
    'Automation templates',
    'Reusable automation starting points.',
    <AutomationsTemplatesClient />,
  )
}

export function TeamPagesOpus({ workspaceSlug }: { workspaceSlug: string }) {
  return surface(
    'Team pages',
    'Public pages for team members.',
    <TeamPagesClient workspaceSlug={workspaceSlug} />,
  )
}

export function RoutingFormsOpus({ workspaceSlug }: { workspaceSlug: string }) {
  return surface(
    'Routing forms',
    'Qualify callers before booking.',
    <RoutingFormsClient workspaceSlug={workspaceSlug} />,
  )
}

export function MeetingPollsOpus() {
  return surface(
    'Meeting polls',
    'Group scheduling polls.',
    <MeetingPollsLibraryConnected />,
  )
}

export function AiBookingOpus() {
  return surface(
    'AI booking',
    'Configure AI-assisted booking.',
    <AiBookingAdminClient />,
  )
}

export function FormsDocumentsOpus() {
  return surface(
    'Forms & documents',
    'Intake forms and document collection.',
    <FormsDocumentsClient />,
  )
}

export function PoliciesOpus() {
  return surface(
    'Policies',
    'Cancellation, reschedule, and booking policies.',
    <AppointmentsPoliciesClient />,
  )
}

export function SetupOpus() {
  return surface('Get started', 'Finish appointments setup.', <AppointmentsSetupClient />)
}

export function EnterpriseOpus() {
  return surface(
    'Enterprise',
    'Enterprise scheduling options.',
    <EnterpriseSchedulingClient />,
  )
}

export function PricingPaymentsOpus() {
  return surface(
    'Pricing & payments',
    'Checkout, deposits, and payment rules.',
    <PricingPaymentsClient />,
  )
}

export function PointOfSaleOpus() {
  return surface('Point of sale', 'Take payment in person.', <PointOfSaleConnected />)
}

export function RecallsOpus() {
  return surface(
    'Recalls',
    'Bring clients back for rebooking.',
    <RecallsHubClient />,
  )
}

export function RecallCampaignsOpus() {
  return surface(
    'Recall campaigns',
    'Campaign-style recall outreach.',
    <RecallCampaignsClient />,
  )
}

export function NoShowRecoveryOpus() {
  return surface(
    'No-show recovery',
    'Recover missed appointments.',
    <NoShowRecoveryClient />,
  )
}

export function VoiceRemindersOpus() {
  return surface(
    'Voice reminders',
    'Outbound voice reminder settings.',
    <VoiceRemindersClient />,
  )
}

export function SegmentsOpus() {
  return surface(
    'Segments',
    'Client segments for outreach.',
    <AppointmentSegmentsClient />,
  )
}

export function ContractsOpus() {
  return surface(
    'Contracts',
    'Booking contracts and agreements.',
    <ContractsAdminClient />,
  )
}

export function BookingSettingsOpus({
  workspaceSlug,
  workspaceName,
}: {
  workspaceSlug: string
  workspaceName: string
}) {
  return surface(
    'Booking pages',
    'Public booking links, embeds, and scheduler entry points.',
    <AppointmentBookingSettingsClient workspaceSlug={workspaceSlug} workspaceName={workspaceName} />,
  )
}

export function BookingShareOpus({
  workspaceSlug,
  workspaceName,
  types,
}: {
  workspaceSlug: string
  workspaceName: string
  types: { id: string; name: string }[]
}) {
  return surface(
    'Share & embed',
    'Share booking links and embed codes.',
    <BookingShareHubClient
      workspaceSlug={workspaceSlug}
      workspaceName={workspaceName}
      types={types}
    />,
  )
}

export function CommerceHubOpus() {
  return surface(
    'Commerce',
    'Packages, memberships, pricing, and service-booking configuration.',
    <ServiceBookingAdminClient showPageHeader={false} />,
  )
}
