"use client";

import { useEffect, useState } from "react";
import { bookingTypes, BookingType } from "../mock-data";
import { StepIndicator, FlowStep } from "./StepIndicator";
import { ServiceStep } from "./ServiceStep";
import { DateTimeStep } from "./DateTimeStep";
import { DetailsStep } from "./DetailsStep";
import { ConfirmationStep } from "./ConfirmationStep";
import { AiBookingStep } from "./AiBookingStep";
import { WaitlistStep } from "./WaitlistStep";
import { PaymentStep } from "./PaymentStep";
import { OtpStep } from "./OtpStep";

export function PublicBookingClient({
  initialServiceId,
  preselectTypeId,
}: {
  initialServiceId?: string;
  preselectTypeId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<FlowStep>("service");
  const [selectedType, setSelectedType] = useState<BookingType | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [recurringMode, setRecurringMode] = useState("once");
  const [recurringOccurrences, setRecurringOccurrences] = useState(4);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [paidAmount, setPaidAmount] = useState<string | undefined>();
  const [customer, setCustomer] = useState({ firstName: "", lastName: "", phone: "", email: "" });

  // GET /api/public/book/{slug}
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const pre = bookingTypes.find((t) => t.id === (initialServiceId || preselectTypeId));
    if (pre) pickType(pre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialServiceId, preselectTypeId]);

  function pickType(t: BookingType) {
    setSelectedType(t);
    setStep("datetime");
  }

  async function book(payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    notes: string;
    answers: Record<string, string>;
    smsConsent: boolean;
  }) {
    setSubmitting(true);
    setSubmitError("");
    setCustomer(payload);
    // POST /api/public/book/{slug}
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    const hasPayment = selectedType?.payment && selectedType.payment.mode !== "none";
    if (hasPayment) {
      setStep("payment");
    } else {
      setStep("done");
    }
  }

  function reset() {
    setStep("service");
    setSelectedType(null);
    setStartsAt("");
    setRecurringMode("once");
    setAttendeeCount(1);
    setPaidAmount(undefined);
    setNeedsOtp(false);
    setSubmitError("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="tv-spinner" /> Loading booking page…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-danger">{loadError}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          This booking page couldn't be loaded. Please check the link or contact the business directly.
        </p>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator step={step} />

      {step === "service" ? (
        <ServiceStep types={bookingTypes} onPick={pickType} onAi={() => setStep("ai")} onWaitlist={() => setStep("waitlist")} />
      ) : null}

      {step === "datetime" && selectedType ? (
        <DateTimeStep
          type={selectedType}
          onBack={() => setStep("service")}
          onContinue={(p) => {
            setStartsAt(p.startsAt);
            setRecurringMode(p.recurringMode);
            setRecurringOccurrences(p.recurringOccurrences);
            setAttendeeCount(p.attendeeCount);
            setStep("info");
          }}
        />
      ) : null}

      {step === "info" && selectedType ? (
        <DetailsStep
          type={selectedType}
          startsAt={startsAt}
          attendeeCount={attendeeCount}
          onBack={() => setStep("datetime")}
          onSubmit={book}
          submitting={submitting}
          error={submitError}
        />
      ) : null}

      {step === "payment" && selectedType?.payment ? (
        <PaymentStep
          type={selectedType}
          onCancel={() => setStep("info")}
          onSuccess={() => {
            const p = selectedType.payment!;
            const cents = p.mode === "deposit"
              ? p.depositCents || Math.round((p.priceCents || 0) * ((p.depositPercent || 0) / 100))
              : p.priceCents || 0;
            setPaidAmount((cents / 100).toFixed(2));
            setStep("done");
          }}
        />
      ) : null}

      {needsOtp && step === "info" ? (
        <OtpStep phone={customer.phone} onBack={() => setNeedsOtp(false)} onVerified={() => setStep("done")} />
      ) : null}

      {step === "done" && selectedType ? (
        <ConfirmationStep
          type={selectedType}
          startsAt={startsAt}
          firstName={customer.firstName}
          email={customer.email}
          attendeeCount={attendeeCount}
          recurringMode={recurringMode}
          recurringOccurrences={recurringOccurrences}
          paidAmount={paidAmount}
          onBookAnother={reset}
        />
      ) : null}

      {step === "ai" ? (
        <AiBookingStep
          onBack={() => setStep("service")}
          onSelectSlot={(typeId, iso) => {
            const t = bookingTypes.find((x) => x.id === typeId) || bookingTypes[0];
            setSelectedType(t);
            setStartsAt(iso);
            setStep("info");
          }}
        />
      ) : null}

      {step === "waitlist" ? <WaitlistStep onBack={() => setStep("service")} /> : null}
    </div>
  );
}
