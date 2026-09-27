"use client";

import { CallbackRequiredFieldsEditor } from "@/components/solutions/appointment-receptionist/callback-required-fields-editor";
import { defaultCallbackRequiredCollectFieldIds } from "@/lib/solutions/appointment-receptionist/callback-required-field-defaults";
import { GoalsStep } from "@/components/solutions/appointment-receptionist/steps/goals-step";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { FieldRow, Panel, TextLink } from "@/newui-transplant/components/app/kit";
import { Switch } from "@/newui-transplant/components/ui/switch";
import { ReceptionistBookingOpus } from "../receptionist-booking-opus";
import { ReceptionistCollectFieldsOpus } from "../receptionist-collect-fields-opus";
import { BookOpen, Clock, PhoneForwarded } from "lucide-react";

export function ResponsibilitiesStage({
  state,
  patch,
  hoursSummary,
  transferIssues,
  calendarSummary,
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  hoursSummary: string;
  transferIssues: Array<{ message: string }>;
  calendarSummary: { connected: boolean; label: string };
}) {
  const transferDetail =
    state.capabilities.includes("transfer_calls")
      ? transferIssues.length
        ? transferIssues[0]?.message || "Needs call handling setup"
        : "Configured"
      : "Off";

  return (
    <div className="space-y-6">
      <Panel title="Responsibilities" description="Choose what your receptionist can handle for callers.">
        <GoalsStep
          state={state}
          patch={patch}
          presentation="opus"
          compactCapabilities
          hideSidePanel
          hideSolutionName
          hideAnswerWhen
        />
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border px-4 py-3">
          <div className="flex items-start gap-2">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Business hours</p>
              <p className="text-xs text-muted-foreground">{hoursSummary}</p>
              <TextLink href="/voice/knowledge">Manage</TextLink>
            </div>
          </div>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <div className="flex items-start gap-2">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Business knowledge</p>
              <p className="text-xs text-muted-foreground">
                {state.knowledgeBaseEnabled ? "Knowledge base linked" : "May need knowledge sources"}
              </p>
              <TextLink href="/voice/knowledge">Manage</TextLink>
            </div>
          </div>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <div className="flex items-start gap-2">
            <PhoneForwarded className="size-4 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Call handling</p>
              <p className="text-xs text-muted-foreground">{transferDetail}</p>
              <TextLink href="/voice/call-handling">Manage</TextLink>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Panel
            title="Caller information"
            description="Choose what Amy should collect during a call."
          >
            <ReceptionistCollectFieldsOpus state={state} patch={patch} />
          </Panel>
        </div>
        <div className="lg:col-span-5">
          <Panel title="Messages & callbacks">
            <FieldRow label="Take messages and callback requests">
              <Switch
                checked={state.callbackRequestsEnabled !== false}
                onCheckedChange={(on) => {
                  if (on && !state.callbackRequiredCollectFieldIds?.length) {
                    patch({
                      callbackRequestsEnabled: true,
                      callbackRequiredCollectFieldIds: defaultCallbackRequiredCollectFieldIds(
                        state.collectFields,
                      ),
                    });
                  } else {
                    patch({ callbackRequestsEnabled: on });
                  }
                }}
              />
            </FieldRow>
            {state.callbackRequestsEnabled !== false ? (
              <div className="mt-4 border-t pt-4">
                <CallbackRequiredFieldsEditor state={state} patch={patch} />
              </div>
            ) : null}
            <div className="mt-4 border-t pt-4">
              <FieldRow
                label="After-hours notifications"
                description="Who gets alerted after important outcomes"
              >
                <TextLink href="/voice/call-handling">Manage</TextLink>
              </FieldRow>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Appointment handling">
        <ReceptionistBookingOpus state={state} patch={patch} calendarSummary={calendarSummary} />
      </Panel>
    </div>
  );
}
