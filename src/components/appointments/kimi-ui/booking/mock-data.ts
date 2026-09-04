export { mockBookingPageModel as bookingData } from "@/features/appointments/kimi/fixtures/booking/mock-data";
export { mockBookingPageModel } from "@/features/appointments/kimi/fixtures/booking/mock-data";

// Legacy named exports for Kimi preview tooling
import { mockBookingPageModel } from "@/features/appointments/kimi/fixtures/booking/mock-data";

export const businessInfo = mockBookingPageModel.businessInfo;
export const smsConsent = mockBookingPageModel.smsConsent;
export const appointmentTypes = mockBookingPageModel.appointmentTypes;
export const whyBookItems = mockBookingPageModel.whyBookItems;
export const protectionLevels = mockBookingPageModel.protectionOptions.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  selected: p.id === mockBookingPageModel.protectionMode,
}));
