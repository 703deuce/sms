"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BookingType, Slot } from "../mock-data";
import { bookingTypes, staffOptions, locationOptions, workspace } from "../mock-data";
import { StepIndicator, type Step } from "./StepIndicator";
import { ServiceStep } from "./ServiceStep";
import { DateTimeStep } from "./DateTimeStep";
import { InfoStep } from "./InfoStep";
import { PaymentStep } from "./PaymentStep";
import { DoneStep } from "./DoneStep";
import { WaitlistStep } from "./WaitlistStep";
import { AiBookingStep } from "./AiBookingStep";
import { OtpStep } from "./OtpStep";
import { BookingLoading, BookingError } from "./BookingStates";
import { Card } from "./ui";
import { Globe2, Phone } from "lucide-react";

type FlowStep = Step | "otp";

export function PublicBookingClient({
  slug,
  initialServiceId,
}: {
  slug: string;
  initialServiceId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<FlowStep>("service");
  const [selectedType, setSelectedType] = useState<BookingType | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookError, setBookError] = useState("");
  const [paid, setPaid] = useState(false);
  const [bookedPhone, setBookedPhone] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    // Sandbox: simulate GET /api/public/book/${slug}
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Preselect service from /book/[slug]/[serviceId]
  useEffect(() => {
    if (initialServiceId && !loading) {
      const found = bookingTypes.find((t) => t.id === initialServiceId);
      if (found) {
        setSelectedType(found);
        setStep("datetime");
      }
    }
  }, [initialServiceId, loading]);

  const payment = useMemo(() => selectedType?.config?.payment, [selectedType]);
  const requiresPayment = payment && payment.mode !== "none";

  function pickType(type: BookingType) {
    setSelectedType(type);
    setStartsAt("");
    setSelectedStaffId("");
    setStep("datetime");
  }

  function selectAiSlot(slot: Slot) {
    setStartsAt(slot.startsAt);
    setStep("info");
  }

  async function book(payload: { phone: string }) {
    setSubmitting(true);
    setBookError("");
    setBookedPhone(payload.phone);
    // Sandbox: simulate POST booking; new phone numbers must verify via OTP
    await new Promise((r) => setTimeout(r, 1100));
    setSubmitting(false);
    if (!otpVerified) {
      setStep("otp");
      return;
    }
    if (requiresPayment && !paid) {
      setStep("payment");
    } else {
      setStep("done");
    }
  }

  function afterOtp() {
    setOtpVerified(true);
    if (requiresPayment && !paid) {
      setStep("payment");
    } else {
      setStep("done");
    }
  }

  if (loading) return <BookingLoading />;
  if (loadError) return <BookingError message={loadError} onRetry={load} />;

  const indicatorStep: Step = step === "otp" ? "info" : step;

  return (
    <div className="booking-shell min-h-screen px-4 py-8 sm:py-12">
      <div className={step === "datetime" ? "mx-auto max-w-2xl" : "mx-auto max-w-lg"}>
        {/* Brand header */}
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground shadow-sm">
            {workspace.name.charAt(0)}
          </div>
          <h1 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
            {workspace.name}
          </h1>
          <p className="mt-0.5 flex items-center justify-center gap-3 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Globe2 className="h-3 w-3" /> {workspace.timezone.replace("_", " ")}
            </span>
            <a href={`tel:${workspace.businessPhone}`} className="inline-flex items-center gap-1 hover:text-foreground">
              <Phone className="h-3 w-3" /> {workspace.businessPhone}
            </a>
          </p>
        </header>

        <StepIndicator step={indicatorStep} />

        <Card className="p-5 sm:p-7">
          {step === "service" ? (
            <ServiceStep types={bookingTypes} onPick={pickType} />
          ) : null}

          {step === "datetime" && selectedType ? (
            <DateTimeStep
              type={selectedType}
              timezone={workspace.timezone}
              staffOptions={staffOptions}
              locationOptions={locationOptions}
              waitlistEnabled={workspace.waitlistEnabled}
              aiEnabled={workspace.aiBookingEnabled}
              startsAt={startsAt}
              selectedStaffId={selectedStaffId}
              selectedLocationId={selectedLocationId}
              onSelectStaff={setSelectedStaffId}
              onSelectLocation={setSelectedLocationId}
              onSelectSlot={setStartsAt}
              onContinue={() => setStep("info")}
              onBack={() => setStep("service")}
              onWaitlist={() => setStep("waitlist")}
              onAi={() => setStep("ai")}
            />
          ) : null}

          {step === "info" && selectedType ? (
            <InfoStep
              type={selectedType}
              startsAt={startsAt}
              timezone={workspace.timezone}
              submitting={submitting}
              error={bookError}
              onBack={() => setStep("datetime")}
              onBook={(payload) => book(payload)}
            />
          ) : null}

          {step === "otp" ? (
            <OtpStep
              phone={bookedPhone}
              onVerified={afterOtp}
              onBack={() => setStep("info")}
            />
          ) : null}

          {step === "payment" && payment ? (
            <PaymentStep
              payment={payment}
              onSuccess={() => {
                setPaid(true);
                setStep("done");
              }}
              onCancel={() => setStep("info")}
            />
          ) : null}

          {step === "done" && selectedType ? (
            <DoneStep type={selectedType} startsAt={startsAt} timezone={workspace.timezone} paid={paid} />
          ) : null}

          {step === "waitlist" ? (
            <WaitlistStep type={selectedType} onBack={() => setStep(selectedType ? "datetime" : "service")} />
          ) : null}

          {step === "ai" ? (
            <AiBookingStep
              timezone={workspace.timezone}
              workspaceName={workspace.name}
              messages={aiMessages}
              input={aiInput}
              onInputChange={setAiInput}
              onSend={async () => {
                const text = aiInput.trim();
                if (!text || aiLoading) return;
                setAiInput("");
                setAiMessages((m) => [...m, { role: "user", content: text }]);
                setAiLoading(true);
                await new Promise((r) => setTimeout(r, 900));
                setAiMessages((m) => [
                  ...m,
                  {
                    role: "assistant",
                    content: "Design preview only — production booking uses the live AI scheduling API.",
                  },
                ]);
                setAiLoading(false);
              }}
              loading={aiLoading}
              slots={[]}
              onSelectSlot={selectAiSlot}
              onBack={() => setStep("datetime")}
            />
          ) : null}
        </Card>

        <footer className="mt-6 text-center text-[11px] text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">Transovo</span> ·{" "}
          <a href={workspace.termsUrl} className="hover:text-foreground">Terms</a> ·{" "}
          <a href={workspace.privacyUrl} className="hover:text-foreground">Privacy</a>
        </footer>
      </div>
    </div>
  );
}
