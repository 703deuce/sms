/** Client-safe view model for `/api/appointments/team-booking/workspace`. */
export type TeamBookingServiceRow = {
  id: string
  name: string
  teamMode: 'team_required' | 'single_staff'
  requiredStaff: number
  teamRuleLabel: string
  locationCount: number
  status: 'ready' | 'needs_setup' | 'not_enabled'
}

export type TeamBookingWorkspaceData = {
  services: TeamBookingServiceRow[]
  templates: Array<{ id: string; name: string; requirements: unknown[]; active?: boolean }>
  locations: Array<{ id: string; name: string }>
  upcoming: Array<{
    id: string
    at: string
    serviceName: string
    customer: string
    teamLabel: string
  }>
  activity: Array<{
    id: string
    at: string
    bookingLabel: string
    serviceName: string
    teamLabel: string
    source: string
    status: string
  } | null>
  overview: {
    teamServices: number
    activeRules: number
    staffParticipating: number
    ready: number
    needsSetup: number
    upcomingTeamBookings: number
    issues: Array<{ id: string; message: string }>
  }
}
