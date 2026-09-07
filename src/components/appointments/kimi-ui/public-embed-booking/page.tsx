"use client";

import { useEffect, useMemo, useState } from "react";
import "./reference.css";
import { bookingData, slotsForDate, formatPrice, type BookingType, type Slot } from "./mock-data";
import EmbedBookingShell from "./components/EmbedBookingShell";
import ServiceStep from "./components/ServiceStep";
import DateTimeStep from "./components/DateTimeStep";
import DetailsStep from "./components/DetailsStep";
import PaymentStep from "./components/PaymentStep";
import ConfirmationStep from "./components/ConfirmationStep";
import WaitlistStep from "./components/WaitlistStep";
import AiBookingStep from "./components/AiBookingStep";
import OtpStep from "./components/OtpStep";
import LoadingStep from "./components/LoadingStep";
import EmptyState from "./components/EmptyState";

export type Step =
  | "service"
  | "datetime"
  | "info"
  | "payment"
  | "otp"
  | "done"
  | "waitlist"
  | "ai";

export type LoadState = "loading" | "ready" | "error" | "unavailable";

export interface BookingState {
  type: BookingType | null;
  staffId: string;
  locationId: string;
  durationMinutes: number | null;
  slot: Slot | null;
  recurringMode: "once" | "weekly" | "biweekly" | "monthly";
  recurringOccurrences: number;
  attendeeCount: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  smsConsent: boolean;
  answers: Record<string, string>;
}

const initialState: BookingState = {
  type: null,
  staffId: "",
  locationId: "",
  durationMinutes: null,
  slot: null,
  recurringMode: "once",
  recurringOccurrences: 4,
  attendeeCount: 1,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
  smsConsent: false,
  answers: {},
};

export default function ReferencePage() {
  const [step, setStep] = useState<Step>("service");
  const [state, setState] = useState<BookingState>(initialState);
  const [submitted, setSubmitted] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  // Sandbox load lifecycle: simulate GET /api/public/book/[slug]
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    const t = setTimeout(() => setLoadState("ready"), 900);
    return () => clearTimeout(t);
  }, []);

  const update = (patch: Partial<BookingState>) =>
    setState((s) => ({ ...s, ...patch }));

  const paymentLabel = useMemo(
    () => formatPrice(state.type?.config?.payment),
    [state.type],
  );

  function pickType(type: BookingType) {
    const defaultDuration =
      type.config?.durationOptions?.find((d) => d.active)?.minutes ?? null;
    update({
      type,
      slot: null,
      staffId: "",
      locationId: "",
      durationMinutes: defaultDuration,
      recurringMode: "once",
      attendeeCount: 1,
    });
    setStep("datetime");
  }

  function pickSlot(slot: Slot) {
    update({ slot });
    setStep("info");
  }

  function submitBooking() {
    setSubmitted(true);
    const requiresPayment = paymentLabel !== null;
    const requiresOtp = state.phone.trim().length > 0 && !requiresPayment;
    setTimeout(() => {
      setSubmitted(false);
      if (requiresPayment) setStep("payment");
      else if (requiresOtp) setStep("otp");
      else setStep("done");
    }, 700);
  }

  const staff = bookingData.staff.find((s) => s.id === state.staffId);
  const location = bookingData.locations.find((l) => l.id === state.locationId);

  return (
    <div className="embed-root">
      <EmbedBookingShell
        workspaceName={bookingData.workspaceName}
        timezone={bookingData.timezone}
        businessPhone={bookingData.businessPhone}
        businessAddress={bookingData.businessAddress}
        step={step}
        loading={loadState === "loading"}
        onAiBooking={() => setStep("ai")}
      >
        {loadState === "loading" && <LoadingStep />}

        {loadState === "error" && (
          <EmptyState
            tone="error"
            title="We couldn't load this booking page"
            body="Something went wrong while loading availability. Your information was not submitted. Please try again."
            actionLabel="Try again"
            onAction={() => {
              setLoadState("loading");
              setTimeout(() => setLoadState("ready"), 900);
            }}
            secondaryLabel={`Call ${bookingData.businessPhone}`}
            secondaryHref={`tel:${bookingData.businessPhone.replace(/[^\d]/g, "")}`}
          />
        )}

        {loadState === "unavailable" && (
          <EmptyState
            title="Online booking isn't available right now"
            body={`${bookingData.workspaceName} isn't accepting online bookings at the moment. Please contact the business directly to schedule.`}
            secondaryLabel={`Call ${bookingData.businessPhone}`}
            secondaryHref={`tel:${bookingData.businessPhone.replace(/[^\d]/g, "")}`}
          />
        )}

        {loadState === "ready" && step === "service" && bookingData.types.length === 0 && (
          <EmptyState
            title="No services available to book"
            body="This booking page doesn't have any bookable services yet. Please check back soon or contact the business directly."
            secondaryLabel={`Call ${bookingData.businessPhone}`}
            secondaryHref={`tel:${bookingData.businessPhone.replace(/[^\d]/g, "")}`}
          />
        )}

        {loadState === "ready" && step === "service" && bookingData.types.length > 0 && (
          <ServiceStep types={bookingData.types} onPick={pickType} />
        )}

        {loadState === "ready" && step === "datetime" && state.type && (
          <DateTimeStep
            type={state.type}
            staff={bookingData.staff}
            locations={bookingData.locations}
            selectedStaffId={state.staffId}
            selectedLocationId={state.locationId}
            durationMinutes={state.durationMinutes}
            onDurationChange={(durationMinutes) => update({ durationMinutes, slot: null })}
            recurringMode={state.recurringMode}
            recurringOccurrences={state.recurringOccurrences}
            onRecurringChange={(recurringMode, recurringOccurrences) =>
              update({ recurringMode, recurringOccurrences })
            }
            onStaffChange={(staffId) => update({ staffId, slot: null })}
            onLocationChange={(locationId) => update({ locationId })}
            slotsForDate={slotsForDate}
            onPickSlot={pickSlot}
            onBack={() => setStep("service")}
            onWaitlist={() => setStep("waitlist")}
          />
        )}

        {loadState === "ready" && step === "info" && state.type && state.slot && (
          <DetailsStep
            state={state}
            update={update}
            staffName={staff?.name}
            locationName={location?.name}
            consentText={bookingData.smsConsentText}
            termsUrl={bookingData.termsUrl}
            privacyUrl={bookingData.privacyUrl}
            submitting={submitted}
            onBack={() => setStep("datetime")}
            onSubmit={submitBooking}
          />
        )}

        {loadState === "ready" && step === "payment" && state.type && (
          <PaymentStep
            type={state.type}
            onCancel={() => setStep("info")}
            onSuccess={() => setStep("otp")}
          />
        )}

        {loadState === "ready" && step === "otp" && (
          <OtpStep phone={state.phone} onVerified={() => setStep("done")} />
        )}

        {loadState === "ready" && step === "waitlist" && state.type && (
          <WaitlistStep
            type={state.type}
            state={state}
            update={update}
            onBack={() => setStep("datetime")}
            onJoined={() => {
              setWaitlistJoined(true);
              setStep("done");
            }}
          />
        )}

        {loadState === "ready" && step === "ai" && (
          <AiBookingStep
            types={bookingData.types}
            onSelectSlot={(type, slot) => {
              update({ type, slot, durationMinutes: null });
              setStep("info");
            }}
            onManual={() => setStep("service")}
          />
        )}

        {loadState === "ready" && step === "done" && state.type && (
          <ConfirmationStep
            state={state}
            staffName={staff?.name}
            locationName={location?.name}
            locationAddress={location?.address}
            workspaceName={bookingData.workspaceName}
            businessPhone={bookingData.businessPhone}
            waitlist={waitlistJoined}
          />
        )}
      </EmbedBookingShell>
    </div>
  );
}
