/** Domain scheduling interface — Amy never sees provider specifics. */

export type SchedulingSlot = {
  start_time: string;
  end_time?: string;
  label?: string;
};

export type SchedulingAvailabilityRequest = {
  service_name: string;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
};

export type SchedulingBookRequest = {
  operation_id: string;
  service_name: string;
  start_time: string;
  timezone: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  address?: string | null;
};

export type SchedulingBookResult = {
  provider: string;
  provider_reference: string | null;
  sync_status: "pending" | "synced" | "not_required" | "failed";
};

export type SchedulingProvider = {
  readonly name: string;
  checkAvailability(req: SchedulingAvailabilityRequest): Promise<SchedulingSlot[]>;
  bookAppointment(req: SchedulingBookRequest): Promise<SchedulingBookResult>;
  cancelAppointment(providerReference: string, reason?: string): Promise<void>;
  rescheduleAppointment(
    providerReference: string,
    newStartTime: string,
    timezone: string,
  ): Promise<void>;
};
