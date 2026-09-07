"use client";

import "@/components/appointments/kimi-ui/public-embed-booking/reference.css";
import EmbedBookingShell from "@/components/appointments/kimi-ui/public-embed-booking/components/EmbedBookingShell";
import LoadingStep from "@/components/appointments/kimi-ui/public-embed-booking/components/LoadingStep";
import EmptyState from "@/components/appointments/kimi-ui/public-embed-booking/components/EmptyState";
import ServiceStep from "@/components/appointments/kimi-ui/public-embed-booking/components/ServiceStep";
import DateTimeStep from "@/components/appointments/kimi-ui/public-embed-booking/components/DateTimeStep";
import DetailsStep from "@/components/appointments/kimi-ui/public-embed-booking/components/DetailsStep";
import ConfirmationStep from "@/components/appointments/kimi-ui/public-embed-booking/components/ConfirmationStep";
import WaitlistStep from "@/components/appointments/kimi-ui/public-embed-booking/components/WaitlistStep";
import AiBookingStep from "@/components/appointments/kimi-ui/public-embed-booking/components/AiBookingStep";
import { SquarePaymentStep } from "@/components/appointments/square-payment-step";
import type { Step } from "@/components/appointments/kimi-ui/public-embed-booking/page";
import type { BookingType, Slot } from "@/components/appointments/kimi-ui/public-embed-booking/mock-data";
import {
  usePublicBookingFlow,
} from "@/features/appointments/kimi/public/use-public-booking-flow";
import type { PublicBookingFlowOptions } from "@/features/appointments/kimi/public/types";
import type { PublicBookingType } from "@/features/appointments/kimi/public/types";

function mapType(type: PublicBookingType): BookingType {
  return {
    id: type.id,
    name: type.name,
    durationMinutes: type.durationMinutes,
    config: type.config as BookingType["config"],
  };
}

function slotsForDateFromList(allSlots: Slot[], dateKey: string, durationMinutes: number) {
  return allSlots.filter((slot) => {
    const key = slot.startsAt.slice(0, 10);
    if (key !== dateKey) return false;
    const end = new Date(slot.endsAt).getTime();
    const start = new Date(slot.startsAt).getTime();
    return end - start >= durationMinutes * 60000 - 1000;
  });
}

export function PublicEmbedBookingConnected(props: PublicBookingFlowOptions) {
  const flow = usePublicBookingFlow(props);
  const ws = flow.workspace;
  const step = flow.step as Step;
  const selectedType = flow.selectedType ? mapType(flow.selectedType) : null;
  const durationMinutes =
    flow.effectiveDurationMinutes || selectedType?.durationMinutes || 30;

  const bookingState = {
    type: selectedType,
    staffId: flow.selectedStaffId,
    locationId: flow.selectedLocationId,
    durationMinutes,
    slot: flow.startsAt
      ? { startsAt: flow.startsAt, endsAt: new Date(new Date(flow.startsAt).getTime() + durationMinutes * 60000).toISOString() }
      : null,
    recurringMode: flow.recurringMode,
    recurringOccurrences: flow.recurringOccurrences,
    attendeeCount: flow.attendeeCount,
    firstName: flow.firstName,
    lastName: flow.lastName,
    email: flow.email,
    phone: flow.phone,
    notes: flow.notes,
    smsConsent: flow.smsConsent,
    answers: flow.bookingAnswers,
  };

  const loadState = flow.loading ? "loading" : flow.error && !ws ? "error" : "ready";

  return (
    <div className="embed-root min-h-screen bg-background">
      <EmbedBookingShell
        workspaceName={ws?.name || ""}
        timezone={ws?.timezone || ""}
        businessPhone={ws?.businessPhone || ""}
        businessAddress={ws?.businessAddress || ""}
        step={step === "payment" ? "info" : step === "service" || step === "datetime" || step === "info" || step === "done" || step === "waitlist" || step === "ai" ? step : "service"}
        loading={flow.loading}
        onAiBooking={() => flow.setStep("ai")}
      >
        {loadState === "loading" ? <LoadingStep /> : null}

        {loadState === "error" ? (
          <EmptyState
            tone="error"
            title="We couldn't load this booking page"
            body={flow.error || "Something went wrong while loading availability."}
            actionLabel="Try again"
            onAction={flow.load}
          />
        ) : null}

        {loadState === "ready" && step === "service" && flow.types.length === 0 ? (
          <EmptyState
            title="No services available to book"
            body="This booking page doesn't have any bookable services yet."
          />
        ) : null}

        {loadState === "ready" && step === "service" && flow.types.length > 0 ? (
          <ServiceStep
            types={flow.types.map(mapType)}
            onPick={(type) => {
              const match = flow.types.find((t) => t.id === type.id);
              if (match) void flow.pickType(match);
            }}
          />
        ) : null}

        {loadState === "ready" && step === "datetime" && selectedType ? (
          <DateTimeStep
            type={selectedType}
            staff={flow.eligibleStaff}
            locations={flow.eligibleLocations}
            selectedStaffId={flow.selectedStaffId}
            selectedLocationId={flow.selectedLocationId}
            durationMinutes={durationMinutes}
            onDurationChange={(minutes) => flow.setSelectedDuration(minutes)}
            recurringMode={flow.recurringMode}
            recurringOccurrences={flow.recurringOccurrences}
            onRecurringChange={(mode, occurrences) => {
              flow.setRecurringMode(mode);
              flow.setRecurringOccurrences(occurrences);
            }}
            onStaffChange={(id) => {
              flow.setSelectedStaffId(id);
              flow.setStartsAt("");
            }}
            onLocationChange={flow.setSelectedLocationId}
            slotsForDate={(dateKey, duration) =>
              slotsForDateFromList(flow.slots as Slot[], dateKey, duration)
            }
            onPickSlot={(slot) => {
              flow.setStartsAt(slot.startsAt);
              flow.setStep("info");
            }}
            onBack={() => flow.setStep("service")}
            onWaitlist={() => flow.setStep("waitlist")}
          />
        ) : null}

        {loadState === "ready" && step === "info" && selectedType && bookingState.slot ? (
          <DetailsStep
            state={bookingState}
            update={(patch) => {
              if (patch.firstName !== undefined) flow.setFirstName(patch.firstName);
              if (patch.lastName !== undefined) flow.setLastName(patch.lastName);
              if (patch.email !== undefined) flow.setEmail(patch.email);
              if (patch.phone !== undefined) flow.setPhone(patch.phone);
              if (patch.notes !== undefined) flow.setNotes(patch.notes);
              if (patch.smsConsent !== undefined) flow.setSmsConsent(patch.smsConsent);
              if (patch.answers !== undefined) flow.setBookingAnswers(patch.answers);
            }}
            staffName={flow.eligibleStaff.find((s) => s.id === flow.selectedStaffId)?.name}
            locationName={flow.eligibleLocations.find((l) => l.id === flow.selectedLocationId)?.name}
            consentText={ws?.consentText || ""}
            termsUrl={ws?.termsUrl || "/terms"}
            privacyUrl={ws?.privacyUrl || "/privacy"}
            submitting={flow.submitting}
            onBack={() => flow.setStep("datetime")}
            onSubmit={() =>
              void flow.book({
                firstName: flow.firstName,
                lastName: flow.lastName,
                phone: flow.phone,
                email: flow.email,
                notes: flow.notes,
                smsConsent: flow.smsConsent,
                bookingAnswers: flow.bookingAnswers,
              })
            }
          />
        ) : null}

        {loadState === "ready" && step === "payment" && flow.squareConfig && flow.pendingAppointmentId ? (
          <SquarePaymentStep
            slug={props.slug}
            appointmentId={flow.pendingAppointmentId}
            square={flow.squareConfig}
            onSuccess={() => void flow.onPaymentSuccess()}
            onCancel={() => flow.setStep("info")}
          />
        ) : null}

        {loadState === "ready" && step === "waitlist" && selectedType ? (
          <WaitlistStep
            type={selectedType}
            state={bookingState}
            update={(patch) => {
              if (patch.firstName !== undefined) flow.setFirstName(patch.firstName);
              if (patch.phone !== undefined) flow.setPhone(patch.phone);
              if (patch.email !== undefined) flow.setEmail(patch.email);
              if (patch.notes !== undefined) flow.setNotes(patch.notes);
            }}
            onBack={() => flow.setStep("datetime")}
            onJoined={() => flow.setStep("done")}
            submitting={flow.submitting}
            error={flow.error}
            onJoin={async () => {
              if (!flow.smsConsent) flow.setSmsConsent(true);
              const ok = await flow.joinWaitlist();
              return ok;
            }}
          />
        ) : null}

        {loadState === "ready" && step === "ai" ? (
          <AiBookingStep
            types={flow.types.map(mapType)}
            onSelectSlot={(type, slot) => {
              const match = flow.types.find((t) => t.id === type.id);
              if (match) flow.setSelectedType(match);
              flow.setStartsAt(slot.startsAt);
              flow.setStep("info");
            }}
            onManual={() => flow.setStep("service")}
          />
        ) : null}

        {loadState === "ready" && step === "done" && selectedType ? (
          <ConfirmationStep
            state={bookingState}
            staffName={flow.eligibleStaff.find((s) => s.id === flow.selectedStaffId)?.name}
            locationName={flow.eligibleLocations.find((l) => l.id === flow.selectedLocationId)?.name}
            workspaceName={ws?.name || ""}
            businessPhone={ws?.businessPhone || ""}
            waitlist={flow.waitlistSubmitted}
          />
        ) : null}
      </EmbedBookingShell>
    </div>
  );
}
