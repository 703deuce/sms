"use client";

import type {
  AppointmentReceptionistWizardState,
  AppointmentTypeConfig,
  BookingPermission,
  VoiceWizardBookingStrategy,
} from "@/lib/solutions/appointment-receptionist/types";
import {
  isLiveCalendarStatus,
  resolveLiveCalendar,
} from "@/lib/solutions/appointment-receptionist/live-calendar";
import {
  pickWizardFieldComponents,
  WizardCheckboxInline,
  WizardSelectField,
  WizardToggleField,
} from "../wizard-field-kit";
import { CheckCircle2, MoreHorizontal, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel } from "@/newui-transplant/components/app/kit";
import { ReceptionistCollectFieldsOpus } from "@/newui-transplant/connected/voice/receptionist-editor/receptionist-collect-fields-opus";
import {
  OpusCompactPanel,
  OpusDensePanel,
  OpusSectionInset,
  OpusTableShell,
  SelectedAppointmentConfigShell,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  WizardSection,
} from "../wizard-opus-ui";
import { FieldRow } from "@/newui-transplant/components/app/kit";
import { InfoCallout, RadioRow, SelectableCard, SidePanel, StatusPill } from "../ui";
import {
  effectiveBookingStrategyForUi,
  normalizeWizardBookingStrategy,
  patchWizardBookingStrategy,
} from "@/lib/solutions/appointment-receptionist/booking-strategy-ui";
import {
  isCollectFieldEnabled,
  patchCollectFieldEnabled,
  patchCollectFieldRequired,
  requiredCollectFieldIds,
} from "@/lib/solutions/appointment-receptionist/collect-fields-ui";

const CALENDARS = [
  { id: "google", label: "Google Calendar" },
  { id: "microsoft", label: "Microsoft Outlook" },
  { id: "internal", label: "Transovo Calendar" },
];

const MCTB_BOOKING_PROVIDERS = [{ id: "microsoft", label: "Microsoft Calendar" }];

export function AppointmentsStep({
  state,
  patch,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  presentation?: "legacy" | "mctb" | "opus";
}) {
  const isMctb = presentation === "mctb";
  const isOpus = presentation === "opus";
  const uiVariant = isOpus ? "opus" : "legacy";
  const { Input, Label, Button } = pickWizardFieldComponents(presentation);
  const providerCards = isMctb ? MCTB_BOOKING_PROVIDERS : CALENDARS;
  const selected =
    state.appointmentTypes.find((t) => t.id === state.selectedAppointmentTypeId) ||
    state.appointmentTypes[0];

  function updateSelected(partial: Partial<AppointmentTypeConfig>) {
    if (!selected) return;
    patch({
      appointmentTypes: state.appointmentTypes.map((t) =>
        t.id === selected.id ? { ...t, ...partial } : t,
      ),
    });
  }

  const [calendars, setCalendars] = useState<Array<{ id: string; name: string; provider: string; status: string }>>([]);
  const [integrationProviders, setIntegrationProviders] = useState<
    Array<{ provider: string; status: string; config?: Record<string, unknown> | null }>
  >([]);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [smsNumbers, setSmsNumbers] = useState<
    Array<{ id: string; e164: string; friendlyName: string | null; status: string }>
  >([]);

  useEffect(() => {
    void (async () => {
      try {
        const [calRes, intRes] = await Promise.all([
          fetch("/api/integrations/calendars"),
          fetch("/api/integrations/connections"),
        ]);
        const json = await calRes.json();
        const intJson = await intRes.json().catch(() => ({ data: {} }));
        const rows = (json.data || []) as Array<{
          id: string;
          name: string;
          provider: string;
          status: string;
        }>;
        const connections = (intJson.data?.connections || []) as Array<{
          provider: string;
          status: string;
          config?: Record<string, unknown> | null;
        }>;
        setCalendars(rows);
        setIntegrationProviders(connections);
        const live = resolveLiveCalendar({
          voiceCalendars: rows,
          integrationConnections: connections,
        });
        if (live.connected) {
          patch({
            calendarConnected: true,
            calendarProvider: live.provider,
            calendarEmail: live.name,
          });
        } else if (
          state.calendarConnected ||
          state.calendarEmail?.endsWith("@connected.local")
        ) {
          patch({ calendarConnected: false, calendarEmail: null });
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const normalized = normalizeWizardBookingStrategy(state);
    if (normalized.bookingStrategy !== state.bookingStrategy) {
      patch({
        bookingStrategy: normalized.bookingStrategy,
        appointmentTypes: normalized.appointmentTypes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bookingStrategyUi = effectiveBookingStrategyForUi(state);

  useEffect(() => {
    if ((state.bookingStrategy || "MICROSOFT_365") !== "SEND_LINK") return;
    void fetch("/api/phone/numbers")
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data || []) as Array<{
          id: string;
          e164: string;
          friendlyName: string | null;
          status: string;
        }>;
        setSmsNumbers(rows.filter((n) => n.status === "Active"));
        if (!state.outboundSmsPhoneNumberId && rows[0]) {
          patch({
            outboundSmsPhoneNumberId: rows[0].id,
            outboundSmsE164: rows[0].e164,
            outboundSmsMode: "explicit_number",
          });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.bookingStrategy]);

  async function connectCalendar(providerId: string) {
    setBusyProvider(providerId);
    try {
      const provider = providerId === "outlook" ? "microsoft" : providerId;

      if (isProviderConnected(providerId)) {
        const row = calendars.find((c) => c.provider === provider);
        const live = resolveLiveCalendar({
          voiceCalendars: calendars,
          integrationConnections: integrationProviders,
        });
        patch({
          calendarProvider: provider,
          calendarConnected: true,
          calendarEmail:
            row?.name ||
            (live.connected && live.provider === provider ? live.name : null) ||
            state.calendarEmail,
        });
        return;
      }

      // Calendly / Acuity / Cal.com — prefer live Integrations connection.
      if (["calendly", "acuity", "calcom"].includes(provider)) {
        const intRes = await fetch("/api/integrations/connections");
        const intJson = await intRes.json().catch(() => ({ data: {} }));
        const connections = (intJson.data?.connections || []) as Array<{
          provider: string;
          status: string;
          config?: Record<string, unknown> | null;
        }>;
        setIntegrationProviders(connections);
        if (provider === "calendly") {
          const live = resolveLiveCalendar({
            voiceCalendars: calendars,
            integrationConnections: connections,
          });
          if (live.connected && live.provider === "calendly") {
            patch({
              calendarProvider: "calendly",
              calendarConnected: true,
              calendarEmail: live.name,
            });
            return;
          }
          // No live Calendly — send user to Integrations to connect.
          window.location.href = isMctb
            ? "/integrations/native/calendly"
            : "/integrations/native/calendly";
          return;
        }
        if (isMctb && provider === "microsoft") {
          window.location.href = "/integrations";
          return;
        }
        // acuity / calcom not wired for live booking yet
        patch({
          calendarProvider: provider,
          calendarConnected: false,
          calendarEmail: null,
        });
        return;
      }

      const existing = calendars.find((c) => c.provider === provider);
      let connectionId = existing?.id;
      if (!connectionId) {
        const res = await fetch("/api/integrations/calendars", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: CALENDARS.find((c) => c.id === providerId)?.label || "Calendar",
            provider,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create calendar");
        connectionId = json.data.id as string;
      }
      if (provider === "google" || provider === "microsoft") {
        const returnTo =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/voice/receptionist/edit";
        window.location.href = `/api/integrations/calendars/oauth/${provider}?connectionId=${connectionId}&returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }

      // Refresh local list so status reflects what the API actually created.
      const listRes = await fetch("/api/integrations/calendars");
      const listJson = await listRes.json().catch(() => ({ data: [] }));
      const rows = (listJson.data || []) as Array<{
        id: string;
        name: string;
        provider: string;
        status: string;
      }>;
      setCalendars(rows);
      const row = rows.find((c) => c.id === connectionId) || rows.find((c) => c.provider === provider);

      if (provider === "internal") {
        const live = row && isLiveCalendarStatus(row.status);
        patch({
          calendarProvider: provider,
          calendarConnected: Boolean(live),
          calendarEmail: live ? row?.name || "Transovo Calendar" : null,
        });
        return;
      }

      patch({
        calendarProvider: provider,
        calendarConnected: false,
        calendarEmail: null,
      });
    } catch {
      // leave UI unchanged
    } finally {
      setBusyProvider(null);
    }
  }

  function isProviderConnected(providerId: string) {
    const provider = providerId === "outlook" ? "microsoft" : providerId;
    if (provider === "calendly") {
      const live = resolveLiveCalendar({
        voiceCalendars: calendars,
        integrationConnections: integrationProviders,
      });
      if (live.connected && live.provider === "calendly") return true;
      return (
        state.calendarConnected &&
        (state.calendarProvider === "calendly" || state.calendarProvider === providerId)
      );
    }
    if (["acuity", "calcom"].includes(provider)) {
      // Not live-bookable yet — creating a VoiceCalendarConnection row alone does not count.
      return false;
    }
    const row = calendars.find((c) => c.provider === provider);
    if (row && isLiveCalendarStatus(row.status)) return true;
    return (
      state.calendarConnected &&
      (state.calendarProvider === providerId || state.calendarProvider === provider)
    );
  }

  const appointmentsTitle = isMctb ? "Booking" : "What can callers book?";
  const appointmentsDescription = isMctb
    ? "Choose how the voice agent handles scheduling. Connections are managed in Integrations."
    : "Connect a calendar to show real-time availability.";

  const providerGrid = (
          <div
            className={
              isMctb
                ? isOpus
                  ? "grid gap-2 sm:grid-cols-2"
                  : "mt-4 grid gap-2 sm:grid-cols-2"
                : isOpus
                  ? "grid gap-2 sm:grid-cols-3 xl:grid-cols-6"
                  : "mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6"
            }
          >
            {providerCards.map((cal) => {
              const connected = isProviderConnected(cal.id);
              const row = calendars.find((c) => c.provider === cal.id);
              return (
                <SelectableCard
                  key={cal.id}
                  variant={uiVariant}
                  selected={connected}
                  onClick={() => void connectCalendar(cal.id)}
                  title={cal.label}
                  description={
                    busyProvider === cal.id
                      ? "Connecting…"
                      : connected
                        ? "Connected"
                        : isMctb || ["calendly", "acuity", "calcom"].includes(cal.id)
                          ? "Connect in Integrations"
                          : row?.status === "pending_oauth"
                            ? "Finish OAuth"
                            : row?.status === "pending"
                              ? "Pending setup"
                              : "Connect"
                  }
                  className="min-h-[88px]"
                />
              );
            })}
          </div>
  );

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        {isOpus ? (
          <Panel title={appointmentsTitle} description={appointmentsDescription}>
            {providerGrid}
          </Panel>
        ) : (
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">{appointmentsTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{appointmentsDescription}</p>
            {providerGrid}
          </div>
        )}

        <WizardSection opus={isOpus} title="When someone wants an appointment">
        <div className={isOpus ? undefined : "rounded-xl border border-border bg-card p-4"}>
          {!isOpus ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            When someone wants an appointment
          </p>
          ) : null}
          {!isOpus ? (
          <p className="mt-1 mb-3 text-[12px] text-muted-foreground">
            Amy stays the same assistant — this chooses what she is allowed to do on the call.
          </p>
          ) : (
          <p className="mb-3 text-[12px] text-muted-foreground">
            Amy stays the same assistant — this chooses what she is allowed to do on the call.
          </p>
          )}
          <div className="space-y-2">
            {(
              [
                [
                  "MICROSOFT_365",
                  "Book an appointment for them",
                  "Check live Google or Microsoft calendar availability and book on the call.",
                ],
                [
                  "REQUEST_ONLY",
                  "Take their preferred time and have us confirm it",
                  "Collect preferred day/time and details — the team confirms later.",
                ],
                [
                  "SEND_LINK",
                  "Send our booking link",
                  "Text a link so they can pick a time themselves.",
                ],
                [
                  "NONE",
                  "Take a message / have us follow up",
                  "General message or callback — not an appointment request flow.",
                ],
              ] as Array<[VoiceWizardBookingStrategy, string, string]>
            ).map(([id, label, desc]) => (
              <RadioRow
                key={id}
                variant={uiVariant}
                selected={bookingStrategyUi === id}
                onClick={() => patch(patchWizardBookingStrategy(state, id))}
                label={label}
                description={desc}
              />
            ))}
          </div>
          {bookingStrategyUi === "SEND_LINK" ? (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <p className="text-sm font-medium">Send a booking link</p>
              <div>
                <Label htmlFor="booking-link-url">
                  Booking URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="booking-link-url"
                  type="url"
                  required
                  className="mt-1"
                  placeholder="https://example.com/book"
                  value={state.bookingLinkUrl || ""}
                  onChange={(e) => patch({ bookingLinkUrl: e.target.value })}
                />
                <p className="mt-1 text-[12px] text-muted-foreground">
                  This is the page callers will receive when they ask to schedule an appointment.
                </p>
              </div>
              <WizardSelectField
                presentation={presentation}
                id="booking-link-sms-sender"
                label="Text message sender *"
                value={state.outboundSmsPhoneNumberId || ""}
                onChange={(v) => {
                  const row = smsNumbers.find((n) => n.id === v);
                  patch({
                    outboundSmsPhoneNumberId: row?.id ?? null,
                    outboundSmsE164: row?.e164 ?? null,
                    outboundSmsMode: "explicit_number",
                  });
                }}
                options={[
                  { value: "", label: "Select SMS-enabled number…" },
                  ...smsNumbers.map((n) => ({
                    value: n.id,
                    label: `${n.e164}${n.friendlyName ? ` — ${n.friendlyName}` : ""}`,
                  })),
                ]}
              />
              <p className="text-[12px] text-muted-foreground">
                The booking link will be sent from this SMS-enabled number.
              </p>
              <WizardToggleField
                presentation={presentation}
                label="Ask for permission before sending"
                description="Caller receives the link only after explicitly agreeing to receive the text."
                checked={state.bookingLinkSmsConsentRequired !== false}
                onCheckedChange={(on) => patch({ bookingLinkSmsConsentRequired: on })}
              />
              {isOpus ? (
                <OpusDensePanel title="Message preview" bodyClassName="p-3">
                  <p className="whitespace-pre-wrap text-sm text-foreground">
                    {`${state.businessName || state.solutionName || "Your business"}: Book your appointment here:\n${state.bookingLinkUrl?.trim() || "https://example.com/book"}\nMsg & data rates may apply. Reply STOP to opt out, HELP for help.`}
                  </p>
                </OpusDensePanel>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Message preview
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {`${state.businessName || state.solutionName || "Your business"}: Book your appointment here:\n${state.bookingLinkUrl?.trim() || "https://example.com/book"}\nMsg & data rates may apply. Reply STOP to opt out, HELP for help.`}
                  </p>
                </div>
              )}
              <div>
                <Label htmlFor="booking-link-label">Link label (optional)</Label>
                <Input
                  id="booking-link-label"
                  className="mt-1"
                  placeholder="Book your appointment"
                  value={state.bookingLinkLabel || ""}
                  onChange={(e) => patch({ bookingLinkLabel: e.target.value })}
                />
              </div>
            </div>
          ) : null}
        </div>
        </WizardSection>

        <WizardSection opus={isOpus} title="Appointment types">
        <div className={isOpus ? undefined : "rounded-xl border border-border bg-card"}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            {!isOpus ? <h3 className="text-sm font-semibold">Appointment types</h3> : <span />}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              onClick={() => {
                const id = `type_${Date.now()}`;
                patch({
                  appointmentTypes: [
                    ...state.appointmentTypes,
                    {
                      id,
                      name: "New appointment",
                      durationMin: 30,
                      calendar: "Primary calendar",
                      status: "needs_rules",
                      enabled: true,
                      description: "",
                      location: "",
                      modality: "in_person",
                      bookingHours: "Mon - Fri, 8:00 AM - 6:00 PM",
                      minNotice: "2 hours",
                      maxDaysAhead: "30 days",
                      requiredFields: ["full_name", "phone"],
                      bookingPermission: "book_directly",
                    },
                  ],
                  selectedAppointmentTypeId: id,
                });
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add appointment
            </Button>
          </div>
          <div className="overflow-x-auto">
            {isOpus ? (
              <OpusTableShell>
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Appointment</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Calendar</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.appointmentTypes.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`cursor-pointer ${
                        selected?.id === row.id ? "bg-primary/5" : undefined
                      }`}
                      onClick={() => patch({ selectedAppointmentTypeId: row.id })}
                    >
                      <TableCell className="font-medium">
                        <span
                          className="inline-flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <WizardCheckboxInline
                            presentation={presentation}
                            label={row.name}
                            checked={row.enabled}
                            onCheckedChange={() => {
                              patch({
                                appointmentTypes: state.appointmentTypes.map((t) =>
                                  t.id === row.id ? { ...t, enabled: !t.enabled } : t,
                                ),
                              });
                            }}
                          />
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.durationMin} min</TableCell>
                      <TableCell className="text-muted-foreground">{row.calendar}</TableCell>
                      <TableCell>
                        <StatusPill
                          variant="opus"
                          tone={row.status === "ready" ? "success" : "warning"}
                        >
                          {row.status === "ready" ? "Ready" : "Needs rules"}
                        </StatusPill>
                      </TableCell>
                      <TableCell className="text-right">
                        <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </OpusTableShell>
            ) : (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Appointment</th>
                    <th className="px-4 py-2 font-medium">Duration</th>
                    <th className="px-4 py-2 font-medium">Calendar</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {state.appointmentTypes.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-border ${
                        selected?.id === row.id ? "bg-primary/5" : "hover:bg-muted/30"
                      }`}
                      onClick={() => patch({ selectedAppointmentTypeId: row.id })}
                    >
                      <td className="px-4 py-3 font-medium">
                        <span
                          className="inline-flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <WizardCheckboxInline
                            presentation={presentation}
                            label={row.name}
                            checked={row.enabled}
                            onCheckedChange={() => {
                              patch({
                                appointmentTypes: state.appointmentTypes.map((t) =>
                                  t.id === row.id ? { ...t, enabled: !t.enabled } : t,
                                ),
                              });
                            }}
                          />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.durationMin} min</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.calendar}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={row.status === "ready" ? "success" : "warning"}>
                          {row.status === "ready" ? "Ready" : "Needs rules"}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selected ? (
          <SelectedAppointmentConfigShell
            isOpus={isOpus}
            onClose={() => patch({ selectedAppointmentTypeId: null })}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Appointment details
                </p>
                <div>
                  <Label>Appointment name</Label>
                  <Input
                    className="mt-1"
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </div>
                <WizardSelectField
                  presentation={presentation}
                  label="Duration"
                  value={String(selected.durationMin)}
                  onChange={(v) => updateSelected({ durationMin: Number(v) })}
                  options={[15, 30, 45, 60, 90].map((m) => ({
                    value: String(m),
                    label: `${m} min`,
                  }))}
                />
                <div>
                  <Label>Assigned staff / calendar</Label>
                  <Input
                    className="mt-1"
                    value={selected.calendar}
                    onChange={(e) => updateSelected({ calendar: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Booking settings
                </p>
                {isOpus ? (
                  <FieldRow
                    label="Booking hours"
                    description={selected.bookingHours || "Mon - Fri, 8:00 AM - 6:00 PM"}
                  >
                    <span className="text-sm text-muted-foreground">As configured</span>
                  </FieldRow>
                ) : (
                  <div className="rounded-lg border border-border px-3 py-2 text-sm">
                    Booking hours: {selected.bookingHours || "Mon - Fri, 8:00 AM - 6:00 PM"}
                  </div>
                )}
                <WizardSelectField
                  presentation={presentation}
                  label="Minimum notice"
                  value={selected.minNotice || "2 hours"}
                  onChange={(v) => updateSelected({ minNotice: v })}
                  options={["1 hour", "2 hours", "4 hours", "1 day"].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                />
                <WizardSelectField
                  presentation={presentation}
                  label="Maximum days ahead"
                  value={selected.maxDaysAhead || "30 days"}
                  onChange={(v) => updateSelected({ maxDaysAhead: v })}
                  options={["14 days", "30 days", "60 days", "90 days"].map((v) => ({
                    value: v,
                    label: v,
                  }))}
                />
              </div>
            </div>

            <OpusSectionInset isOpus={isOpus}>
              <WizardToggleField
                presentation={presentation}
                label="Enable caller qualification"
                description="Use collected fields and simple rules to decide fit before booking, sending a link, or taking a message. Works with any booking mode."
                checked={state.qualificationEnabled === true}
                onCheckedChange={(on) =>
                  patch({
                    qualificationEnabled: on,
                    capabilities: on
                      ? [...new Set([...state.capabilities, "qualify_callers"])]
                      : state.capabilities.filter((c) => c !== "qualify_callers"),
                  })
                }
              />
              {state.qualificationEnabled ? (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <WizardToggleField
                    presentation={presentation}
                    label="Require qualification before live booking or sending a booking link"
                    checked={state.qualificationRequiredBeforePrimaryAction === true}
                    onCheckedChange={(on) =>
                      patch({ qualificationRequiredBeforePrimaryAction: on })
                    }
                  />
                  <div>
                    <Label className="text-xs">Supported ZIP codes (comma-separated)</Label>
                    <Input
                      className="mt-1"
                      value={(state.qualificationSupportedZipCodes || []).join(", ")}
                      onChange={(e) =>
                        patch({
                          qualificationSupportedZipCodes: e.target.value
                            .split(/[,;\s]+/)
                            .map((z) => z.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="22191, 22192, 22193"
                    />
                  </div>
                  {(state.qualificationRules || []).map((rule, ri) => (
                    <OpusCompactPanel
                      key={rule.id}
                      isOpus={isOpus}
                      className="text-xs sm:grid-cols-2"
                      bodyClassName="grid gap-2 p-3 sm:grid-cols-2"
                    >
                      <Input
                        value={rule.fieldKey}
                        onChange={(e) => {
                          const next = [...(state.qualificationRules || [])];
                          next[ri] = { ...rule, fieldKey: e.target.value };
                          patch({ qualificationRules: next });
                        }}
                        placeholder="Field key (e.g. zip_code)"
                      />
                      <WizardSelectField
                        presentation={presentation}
                        className="min-w-0"
                        label="Operator"
                        value={rule.operator}
                        onChange={(v) => {
                          const next = [...(state.qualificationRules || [])];
                          next[ri] = {
                            ...rule,
                            operator: v as typeof rule.operator,
                          };
                          patch({ qualificationRules: next });
                        }}
                        options={[
                          { value: "IN", label: "is one of" },
                          { value: "NOT_IN", label: "is not one of" },
                          { value: "EQUALS", label: "equals" },
                          { value: "GREATER_THAN_OR_EQUAL", label: "≥" },
                          { value: "LESS_THAN_OR_EQUAL", label: "≤" },
                        ]}
                      />
                      <Input
                        className="sm:col-span-2"
                        value={rule.value}
                        onChange={(e) => {
                          const next = [...(state.qualificationRules || [])];
                          next[ri] = { ...rule, value: e.target.value };
                          patch({ qualificationRules: next });
                        }}
                        placeholder="Values (comma-separated if needed)"
                      />
                      <WizardSelectField
                        presentation={presentation}
                        label="Result"
                        value={rule.resultStatus}
                        onChange={(v) => {
                          const next = [...(state.qualificationRules || [])];
                          next[ri] = {
                            ...rule,
                            resultStatus: v as typeof rule.resultStatus,
                          };
                          patch({ qualificationRules: next });
                        }}
                        options={[
                          { value: "QUALIFIED", label: "If match → Qualified" },
                          { value: "NOT_QUALIFIED", label: "If match → Not qualified" },
                          { value: "NEEDS_REVIEW", label: "If match → Needs review" },
                        ]}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[11px] font-semibold text-destructive"
                        onClick={() =>
                          patch({
                            qualificationRules: (state.qualificationRules || []).filter(
                              (_, i) => i !== ri,
                            ),
                          })
                        }
                      >
                        Remove rule
                      </Button>
                    </OpusCompactPanel>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      patch({
                        qualificationRules: [
                          ...(state.qualificationRules || []),
                          {
                            id: `rule_${Date.now()}`,
                            fieldKey: "zip_code",
                            operator: "IN",
                            value: "",
                            resultStatus: "QUALIFIED",
                            reasonCode: "RULE_MATCH",
                          },
                        ],
                      })
                    }
                  >
                    Add rule
                  </Button>
                </div>
              ) : null}
            </OpusSectionInset>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                {isOpus ? (
                  <WizardSection
                    opus
                    title="What Amy must collect"
                    description="Defaults cover name, callback number, and service. Add business-specific fields."
                  >
                    <ReceptionistCollectFieldsOpus state={state} patch={patch} />
                  </WizardSection>
                ) : (
                <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What Amy must collect
                </p>
                <p className="mb-3 text-[12px] text-muted-foreground">
                  Defaults cover name, callback number, and service. Add business-specific fields
                  (address, vehicle, gate code, etc.).
                </p>
                <div className="space-y-2">
                  {state.collectFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <WizardCheckboxInline
                        presentation={presentation}
                        label={field.label}
                        checked={isCollectFieldEnabled(field)}
                        onCheckedChange={(on) => {
                          const next = patchCollectFieldEnabled(
                            state.collectFields,
                            index,
                            on,
                          );
                          patch({ collectFields: next });
                          if (selected) {
                            updateSelected({
                              requiredFields: requiredCollectFieldIds(next),
                            });
                          }
                        }}
                      />
                      <WizardCheckboxInline
                        presentation={presentation}
                        label="Required"
                        checked={Boolean(field.required)}
                        onCheckedChange={(on) => {
                          const next = patchCollectFieldRequired(
                            state.collectFields,
                            index,
                            on,
                          );
                          patch({ collectFields: next });
                          if (selected) {
                            updateSelected({
                              requiredFields: requiredCollectFieldIds(next),
                            });
                          }
                        }}
                      />
                      {state.qualificationEnabled ? (
                        <WizardCheckboxInline
                          presentation={presentation}
                          label="Qualification"
                          checked={field.useForQualification === true}
                          onCheckedChange={() => {
                            const next = state.collectFields.map((f, i) =>
                              i === index
                                ? { ...f, useForQualification: !f.useForQualification }
                                : f,
                            );
                            patch({ collectFields: next });
                          }}
                        />
                      ) : null}
                      {!["full_name", "phone", "service"].includes(field.id) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-[11px] font-semibold text-destructive"
                          onClick={() => {
                            patch({
                              collectFields: state.collectFields.filter((_, i) => i !== index),
                            });
                          }}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    id="new-collect-field"
                    className="h-9 min-w-[10rem] flex-1"
                    placeholder="New field label"
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const input = e.currentTarget;
                      const label = input.value.trim();
                      if (!label) return;
                      const id = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
                      patch({
                        collectFields: [
                          ...state.collectFields,
                          {
                            id,
                            label,
                            required: true,
                            enabled: true,
                          },
                        ],
                      });
                      input.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="inline-flex h-9 items-center gap-1"
                    onClick={() => {
                      const input = document.getElementById(
                        "new-collect-field",
                      ) as HTMLInputElement | null;
                      const label = input?.value.trim();
                      if (!label || !input) return;
                      const id = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
                      patch({
                        collectFields: [
                          ...state.collectFields,
                          { id, label, required: true, enabled: true },
                        ],
                      });
                      input.value = "";
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add field
                  </Button>
                </div>
                </>
                )}
              </div>
              {isOpus || state.bookingStrategy ? (
                <p className="text-xs text-muted-foreground">
                  Booking behavior for this type follows{" "}
                  <strong className="font-medium text-foreground">
                    When someone wants an appointment
                  </strong>{" "}
                  above — change it there so live calls stay consistent.
                </p>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Booking permissions
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        ["book_directly", "Book directly", "Allow callers to book the appointment."],
                        [
                          "suggest_then_confirm",
                          "Suggest times first",
                          "Show options and confirm with the caller.",
                        ],
                        [
                          "send_booking_link",
                          "Send booking link",
                          "Send a link for the caller to book later.",
                        ],
                      ] as Array<[BookingPermission, string, string]>
                    ).map(([id, label, desc]) => (
                      <RadioRow
                        key={id}
                        variant={uiVariant}
                        selected={selected.bookingPermission === id}
                        onClick={() => updateSelected({ bookingPermission: id })}
                        label={label}
                        description={desc}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SelectedAppointmentConfigShell>
        ) : null}
        </WizardSection>
      </div>

      <SidePanel variant={uiVariant} title="Appointment tools">
        <ul className="space-y-2 text-xs">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Check availability
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Book appointment
          </li>
        </ul>
        {isOpus ? (
          <OpusDensePanel title="Calendar connection" bodyClassName="p-3 text-xs">
            <p className="text-muted-foreground">
              {state.calendarConnected
                ? [
                    state.calendarProvider
                      ? CALENDARS.find((c) => c.id === state.calendarProvider)?.label ||
                        state.calendarProvider
                      : null,
                    state.calendarEmail,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Connected"
                : "No calendar connected yet"}
            </p>
            {state.calendarConnected ? (
              <StatusPill variant="opus" tone="success">Connected</StatusPill>
            ) : (
              <StatusPill variant="opus" tone="warning">Not connected</StatusPill>
            )}
          </OpusDensePanel>
        ) : (
        <div className="rounded-xl border border-border p-3 text-xs">
          <p className="font-medium">Calendar connection</p>
          <p className="mt-1 text-muted-foreground">
            {state.calendarConnected
              ? [
                  state.calendarProvider
                    ? CALENDARS.find((c) => c.id === state.calendarProvider)?.label ||
                      state.calendarProvider
                    : null,
                  state.calendarEmail,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Connected"
              : "No calendar connected yet"}
          </p>
          {state.calendarConnected ? (
            <StatusPill tone="success">Connected</StatusPill>
          ) : (
            <StatusPill tone="warning">Needed</StatusPill>
          )}
        </div>
        )}
        <InfoCallout variant={uiVariant}>
          AI calls your calendar in real time to check availability and book appointments
          instantly. You never copy event IDs or API keys.
        </InfoCallout>
      </SidePanel>
    </div>
  );
}
