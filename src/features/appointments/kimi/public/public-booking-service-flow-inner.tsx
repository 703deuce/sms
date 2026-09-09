"use client";

import { Globe2, Phone } from "lucide-react";
import { Card } from "@/components/appointments/kimi-ui/public-booking-service/components/ui";
import { StepIndicator, type Step } from "@/components/appointments/kimi-ui/public-booking-service/components/StepIndicator";
import { ServiceStep } from "@/components/appointments/kimi-ui/public-booking-service/components/ServiceStep";
import { DateTimeStep } from "@/components/appointments/kimi-ui/public-booking-service/components/DateTimeStep";
import { InfoStep } from "@/components/appointments/kimi-ui/public-booking-service/components/InfoStep";
import { DoneStep } from "@/components/appointments/kimi-ui/public-booking-service/components/DoneStep";
import { WaitlistStep } from "@/components/appointments/kimi-ui/public-booking-service/components/WaitlistStep";
import { AiBookingStep } from "@/components/appointments/kimi-ui/public-booking-service/components/AiBookingStep";
import { EmailVerificationStep } from "@/components/appointments/kimi-ui/public-booking-service/components/EmailVerificationStep";
import { SquarePaymentStep } from "@/components/appointments/square-payment-step";
import type { BookingType as KimiServiceBookingType } from "@/components/appointments/kimi-ui/public-booking-service/mock-data";
import type { PublicBookingFlow } from "@/features/appointments/kimi/public/use-public-booking-flow";
import type { PublicBookingType } from "@/features/appointments/kimi/public/types";

type FlowStep = Step | "payment";

function toServiceType(type: PublicBookingType): KimiServiceBookingType {
  return {
    id: type.id,
    name: type.name,
    durationMinutes: type.durationMinutes,
    durationOptions: type.durationOptions || type.config?.durationOptions,
    config: type.config as KimiServiceBookingType["config"],
  };
}

export function PublicBookingServiceFlowInner({
  flow,
  slug,
  embed,
}: {
  flow: PublicBookingFlow;
  slug: string;
  embed?: boolean;
}) {
  const ws = flow.workspace!;
  const indicatorStep: FlowStep =
    flow.step === "payment" ? "info" : (flow.step as FlowStep);

  return (
    <div className={`booking-shell min-h-screen px-4 py-8 sm:py-12 ${embed ? "min-h-0 py-4" : ""}`}>
      <div className={flow.step === "datetime" ? "mx-auto max-w-2xl" : "mx-auto max-w-lg"}>
        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground shadow-sm">
            {ws.name.charAt(0)}
          </div>
          <h1 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
            {ws.name}
          </h1>
          <p className="mt-0.5 flex items-center justify-center gap-3 text-[12px] text-muted-foreground">
            {ws.timezone ? (
              <span className="inline-flex items-center gap-1">
                <Globe2 className="h-3 w-3" /> {ws.timezone.replace(/_/g, " ")}
              </span>
            ) : null}
            {ws.businessPhone ? (
              <a href={`tel:${ws.businessPhone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="h-3 w-3" /> {ws.businessPhone}
              </a>
            ) : null}
          </p>
        </header>

        {flow.step !== "done" && flow.step !== "waitlist" && flow.step !== "ai" ? (
          <StepIndicator step={indicatorStep === "payment" ? "info" : indicatorStep} />
        ) : null}

        <Card className="p-5 sm:p-7">
          {flow.step === "service" ? (
            <ServiceStep
              types={flow.types.map(toServiceType)}
              categories={flow.categories}
              activeCategorySlug={flow.initialCategorySlug}
              addingAdditional={flow.addingAdditionalService}
              onPick={(type) => void flow.pickType(flow.types.find((t) => t.id === type.id)!)}
            />
          ) : null}

          {flow.step === "datetime" && flow.selectedType ? (
            <DateTimeStep
              type={toServiceType(flow.selectedType)}
              timezone={ws.timezone}
              staffOptions={flow.eligibleStaff}
              locationOptions={flow.eligibleLocations}
              waitlistEnabled={ws.waitlistEnabled !== false}
              aiEnabled={ws.aiBookingEnabled !== false}
              startsAt={flow.startsAt}
              selectedStaffId={flow.selectedStaffId}
              selectedLocationId={flow.selectedLocationId}
              onSelectStaff={flow.setSelectedStaffId}
              onSelectLocation={flow.setSelectedLocationId}
              onSelectSlot={(iso) => void flow.selectSlot(iso)}
              onContinue={() => flow.setStep("info")}
              onBack={() => flow.setStep("service")}
              onWaitlist={() => flow.setStep("waitlist")}
              onAi={() => flow.setStep("ai")}
              externalSlots={flow.slots}
              externalLoadingSlots={flow.loadingSlots}
              onAddAnotherService={flow.addAdditionalService}
              additionalServiceNames={flow.additionalServices.map((s) => s.name)}
              onAddToSessionCart={flow.addToSessionCart}
              sessionLineCount={flow.sessionLines.length}
            />
          ) : null}

          {flow.step === "info" && flow.selectedType && flow.challengeRequired && !flow.otpVerified ? (
            <EmailVerificationStep
              email={flow.email}
              otpCode={flow.otpCode}
              otpSent={flow.otpSent}
              submitting={flow.submitting}
              error={flow.error}
              onEmailChange={flow.setEmail}
              onOtpChange={flow.setOtpCode}
              onSend={() => void flow.sendOtp()}
              onVerify={() => void flow.verifyOtp()}
              onBack={() => {
                flow.setError("");
                flow.setStep("datetime");
              }}
            />
          ) : null}

          {flow.step === "info" && flow.selectedType && (!flow.challengeRequired || flow.otpVerified) ? (
            <InfoStep
              type={toServiceType(flow.selectedType)}
              startsAt={flow.startsAt}
              timezone={ws.timezone}
              submitting={flow.submitting || flow.paymentPending}
              error={flow.error}
              entitlements={flow.entitlements}
              entitlementsLoading={flow.entitlementsLoading}
              entitlementMethod={flow.entitlementMethod}
              packageBalanceId={flow.packageBalanceId}
              giftCertificateCode={flow.giftCertificateCode}
              useSavedCard={flow.useSavedCard}
              onEntitlementMethodChange={flow.setEntitlementMethod}
              onPackageBalanceIdChange={flow.setPackageBalanceId}
              onGiftCertificateCodeChange={flow.setGiftCertificateCode}
              onUseSavedCardChange={flow.setUseSavedCard}
              onLookupEntitlements={(phone, email) => void flow.lookupEntitlements(phone, email)}
              eligibleAddOns={flow.eligibleAddOns}
              selectedAddOns={flow.selectedAddOns}
              onSelectedAddOnsChange={flow.setSelectedAddOns}
              customFieldDefinitions={flow.customFieldDefinitions}
              customFieldValues={flow.customFieldValues}
              onCustomFieldValuesChange={flow.setCustomFieldValues}
              intakeForms={flow.activeIntakeForms}
              intakeAnswers={flow.intakeAnswers}
              onIntakeAnswersChange={(formId, fieldId, value) => {
                flow.setIntakeAnswers((prev) => ({
                  ...prev,
                  [formId]: { ...(prev[formId] || {}), [fieldId]: value },
                }));
              }}
              onBack={() => flow.setStep("datetime")}
              onBook={(payload) => {
                flow.setFirstName(payload.firstName);
                flow.setLastName(payload.lastName);
                flow.setPhone(payload.phone);
                flow.setEmail(payload.email);
                flow.setNotes(payload.notes);
                flow.setSmsConsent(payload.smsConsent);
                flow.setBookingAnswers(payload.answers);
                if (payload.recurringMode && payload.recurringMode !== "once") {
                  flow.setRecurringMode(payload.recurringMode as "weekly" | "biweekly" | "monthly");
                } else {
                  flow.setRecurringMode("once");
                }
                flow.setRecurringOccurrences(payload.recurringOccurrences);
                void flow.book(payload);
              }}
              recurringPreview={flow.recurringPreview}
              recurringPreviewLoading={flow.recurringPreviewLoading}
              sessionLineCount={flow.sessionLines.length}
              additionalServiceNames={flow.additionalServices.map((s) => s.name)}
              onCheckoutSession={() => void flow.checkoutSession()}
              termsRequired={Boolean(ws.termsVersion)}
              termsUrl={ws.termsUrl}
              termsAccepted={flow.termsAccepted}
              onTermsAcceptedChange={flow.setTermsAccepted}
              uploadSlug={slug}
            />
          ) : null}

          {flow.step === "payment" && flow.squareConfig && flow.pendingAppointmentId ? (
            <SquarePaymentStep
              slug={slug}
              appointmentId={flow.pendingAppointmentId}
              square={flow.squareConfig}
              onSuccess={() => void flow.onPaymentSuccess()}
              onCancel={() => flow.setStep("info")}
            />
          ) : null}

          {flow.step === "done" && flow.selectedType ? (
            <DoneStep
              type={toServiceType(flow.selectedType)}
              startsAt={flow.startsAt}
              timezone={ws.timezone}
              paid={Boolean(flow.squareConfig)}
            />
          ) : null}

          {flow.step === "waitlist" ? (
            <WaitlistStep
              type={flow.selectedType ? toServiceType(flow.selectedType) : null}
              onBack={() => flow.setStep(flow.selectedType ? "datetime" : "service")}
              submitting={flow.submitting}
              error={flow.error}
              onJoin={async ({ name, phone: waitPhone }) => {
                const parts = name.trim().split(/\s+/);
                flow.setFirstName(parts[0] || "");
                flow.setLastName(parts.slice(1).join(" "));
                flow.setPhone(waitPhone);
                flow.setSmsConsent(true);
                const ok = await flow.joinWaitlist();
                if (ok) flow.setStep("done");
              }}
            />
          ) : null}

          {flow.step === "ai" ? (
            <AiBookingStep
              timezone={ws.timezone}
              workspaceName={ws.name}
              messages={flow.aiHistory}
              input={flow.aiInput}
              onInputChange={flow.setAiInput}
              onSend={() => flow.sendAiMessage()}
              loading={flow.aiLoading}
              error={flow.error}
              slots={flow.aiSlots}
              onSelectSlot={(slot) => flow.selectAiSlot(slot)}
              onBack={() => flow.setStep("datetime")}
            />
          ) : null}
        </Card>

        <footer className="mt-6 text-center text-[11px] text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">Transovo</span> ·{" "}
          <a href={ws.termsUrl} className="hover:text-foreground">Terms</a> ·{" "}
          <a href={ws.privacyUrl} className="hover:text-foreground">Privacy</a>
        </footer>
      </div>
    </div>
  );
}
