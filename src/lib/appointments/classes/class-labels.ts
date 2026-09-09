import type { ClassPresentation } from "@/lib/appointments/booking-types-segments";

export type GroupBookingPresentation = ClassPresentation;

export function labelsForPresentation(presentation: GroupBookingPresentation) {
  if (presentation === "workshop_event") {
    return {
      segmentTitle: "Workshops & Events",
      itemSingular: "Workshop or event",
      itemPlural: "Workshops & events",
      createLabel: "Create workshop or event",
      createFirstLabel: "Create your first workshop or event",
      hostLabel: "Host",
      enrollVerb: "Register",
      enrollmentNoun: "Registration",
      attendeeNoun: "Registrant",
      attendeesNoun: "Registrations",
      sessionNoun: "Event date",
      waitlistNoun: "Event waitlist",
      backToList: "Workshops & Events",
      scheduleSection: "Date & time",
      scheduleQuestion: "When is this happening?",
    };
  }
  return {
    segmentTitle: "Classes",
    itemSingular: "Class",
    itemPlural: "Classes",
    createLabel: "Create class",
    createFirstLabel: "Create your first class",
    hostLabel: "Instructor",
    enrollVerb: "Enroll",
    enrollmentNoun: "Enrollment",
    attendeeNoun: "Attendee",
    attendeesNoun: "Attendees",
    sessionNoun: "Occurrence",
    waitlistNoun: "Class waitlist",
    backToList: "Classes",
    scheduleSection: "Schedule",
    scheduleQuestion: "When does this class happen?",
  };
}
