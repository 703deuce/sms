/** Scheduling domain — provider-agnostic service/resource model. */

export type SchedulingResource = {
  id: string;
  name: string;
  skills: string[];
  zones: string[];
  businessHours?: { start: string; end: string; days?: number[] } | null;
  calendarConnected?: boolean;
  metadata?: Record<string, unknown>;
};

export type SchedulingService = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes?: number;
  requiredSkills: string[];
  eligibleResourceIds: string[];
  bookingPolicy?: string | null;
  metadata?: Record<string, unknown>;
};

export type SchedulingSlot = {
  slotId: string;
  start: string;
  end: string;
  resourceId: string;
  resourceName: string;
  zone?: string | null;
  spokenLabel?: string;
};

export type AvailabilityQuery = {
  workspaceId: string;
  agentId?: string;
  serviceName: string;
  serviceId?: string | null;
  zone?: string | null;
  urgency?: string | null;
  preferredStart?: string | null;
  preferredEnd?: string | null;
  daysAhead?: number;
  timezone: string;
  resourceIds?: string[];
};

export type AvailabilityResult = {
  slots: SchedulingSlot[];
  eligibleResources: SchedulingResource[];
  service: SchedulingService | null;
};

export type ResourceResolution = {
  service: SchedulingService;
  eligibleResources: SchedulingResource[];
};
