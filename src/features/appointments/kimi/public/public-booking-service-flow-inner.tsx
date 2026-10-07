"use client";

import { Globe2, Phone } from "lucide-react";
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
import { ApplySchedulerTheme } from "@/newui-transplant/components/public-booking/apply-scheduler-theme";
import {
  OpusPublicStepIndicator,
  type OpusPublicStep,
} from "@/newui-transplant/components/public-booking/opus-public-step-indicator";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

type FlowStep = OpusPublicStep;

function contentMaxWidth(step: FlowStep): string {
  if (step === "datetime") return "max-w-6xl";
  if (step === "service") return "max-w-5xl";
  return "max-w-3xl";
}

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
  const simple = flow.publicBookingProfile === "simple";
  const indicatorStep: FlowStep =
    flow.step === "payment" ? "info" : (flow.step as FlowStep);

  const widthClass = contentMaxWidth(indicatorStep === "payment" ? "info" : indicatorStep);

  return (
    <div className={cn(!embed && "min-h-screen bg-muted/30", embed && "w-full")}>
      <ApplySchedulerTheme theme={flow.schedulerTheme} />
      <div className={cn("mx-auto w-full", widthClass, embed ? "py-0" : "px-0 py-2 sm:py-4")}>
        <header className="mb-6 text-center">
          {ws.logoUrl ? (
            <img
              src={ws.logoUrl}
              alt=""
              className="mx-auto mb-3 h-14 w-14 rounded-xl border bg-card object-cover shadow-sm"
            />
          ) : (
            <div
              className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm"
              style={
                flow.schedulerTheme?.primaryColor
                  ? { backgroundColor: flow.schedulerTheme.primaryColor }
                  : undefined
              }
              aria-hidden
            >
              {ws.name.charAt(0)}
            </div>
          )}
          <h1 className="text-lg font-semibold tracking-tight text-foreground">{ws.name}</h1>
          {ws.businessAddress ? (
            <p className="mt-1 text-xs text-muted-foreground">{ws.businessAddress}</p>
          ) : null}
          <p className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            {ws.timezone ? (
              <span className="inline-flex items-center gap-1">
                <Globe2 className="h-3 w-3" aria-hidden /> {ws.timezone.replace(/_/g, " ")}
              </span>
            ) : null}
            {ws.businessPhone ? (
              <a
                href={`tel:${ws.businessPhone}`}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="h-3 w-3" aria-hidden /> {ws.businessPhone}
              </a>
            ) : null}
          </p>
        </header>

        {flow.step !== "done" && flow.step !== "waitlist" && flow.step !== "ai" ? (
          <OpusPublicStepIndicator step={indicatorStep === "payment" ? "info" : indicatorStep} />
        ) : null}

        <div className={cn(OPUS_CARD, "bg-card p-6 sm:p-8 lg:p-10")}>
          {flow.step === "service" ? (
            <ServiceStep
              types={flow.types.map(toServiceType)}
              categories={simple ? [] : flow.categories}
              activeCategorySlug={flow.initialCategorySlug}
              addingAdditional={simple ? false : flow.addingAdditionalService}
              onPick={(type) => void flow.pickType(flow.types.find((t) => t.id === type.id)!)}
            />
          ) : null}

          {flow.step === "datetime" && flow.selectedType ? (
            <DateTimeStep
              type={toServiceType(flow.selectedType)}
              timezone={ws.timezone}
              staffOptions={flow.eligibleStaff}
              locationOptions={flow.eligibleLocations}
              waitlistEnabled={!simple && ws.waitlistEnabled !== false}
              aiEnabled={!simple && ws.aiBookingEnabled !== false}
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
              onAddAnotherService={simple ? undefined : flow.addAdditionalService}
              additionalServiceNames={simple ? [] : flow.additionalServices.map((s) => s.name)}
              additionalServices={
                simple
                  ? []
                  : flow.additionalServices.map((s) => ({
                      id: s.id,
                      name: s.name,
                      staffAssignment: s.config?.staffAssignment,
                      staffIds: s.config?.staffIds,
                    }))
              }
              lineStaffIds={flow.lineStaffIds}
              onLineStaffChange={flow.setLineStaffId}
              onAddToSessionCart={simple ? undefined : flow.addToSessionCart}
              sessionLineCount={simple ? 0 : flow.sessionLines.length}
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
              entitlements={simple ? null : flow.entitlements}
              entitlementsLoading={simple ? false : flow.entitlementsLoading}
              entitlementMethod={simple ? "none" : flow.entitlementMethod}
              packageBalanceId={simple ? "" : flow.packageBalanceId}
              giftCertificateCode={simple ? "" : flow.giftCertificateCode}
              useSavedCard={simple ? false : flow.useSavedCard}
              onEntitlementMethodChange={flow.setEntitlementMethod}
              onPackageBalanceIdChange={flow.setPackageBalanceId}
              onGiftCertificateCodeChange={flow.setGiftCertificateCode}
              onUseSavedCardChange={flow.setUseSavedCard}
              walletApplyCents={simple ? 0 : flow.walletApplyCents}
              onWalletApplyCentsChange={flow.setWalletApplyCents}
              loyaltyProgramId={simple ? "" : flow.loyaltyProgramId}
              loyaltyRedeemPoints={simple ? 0 : flow.loyaltyRedeemPoints}
              onLoyaltyProgramIdChange={flow.setLoyaltyProgramId}
              onLoyaltyRedeemPointsChange={flow.setLoyaltyRedeemPoints}
              couponCode={simple ? "" : flow.couponCode}
              onCouponCodeChange={flow.setCouponCode}
              onLookupEntitlements={
                simple ? () => undefined : (phone, email) => void flow.lookupEntitlements(phone, email)
              }
              eligibleAddOns={simple ? [] : flow.eligibleAddOns}
              selectedAddOns={simple ? [] : flow.selectedAddOns}
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
              recurringPreview={simple ? null : flow.recurringPreview}
              recurringPreviewLoading={simple ? false : flow.recurringPreviewLoading}
              sessionLineCount={simple ? 0 : flow.sessionLines.length}
              additionalServiceNames={simple ? [] : flow.additionalServices.map((s) => s.name)}
              dynamicPriceCents={flow.dynamicPriceCents}
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

          {!simple && flow.step === "waitlist" ? (
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

          {!simple && flow.step === "ai" ? (
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
        </div>

        {embed ? null : (
          <footer className="mt-6 text-center text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">Transovo</span> ·{" "}
            <a href={ws.termsUrl} className="hover:text-foreground underline-offset-2 hover:underline">
              Terms
            </a>{" "}
            ·{" "}
            <a href={ws.privacyUrl} className="hover:text-foreground underline-offset-2 hover:underline">
              Privacy
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}
