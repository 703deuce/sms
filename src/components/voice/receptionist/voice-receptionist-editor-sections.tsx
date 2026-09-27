"use client";

import { TestStep } from "@/components/solutions/appointment-receptionist/steps/test-step";
import { GoalsStep } from "@/components/solutions/appointment-receptionist/steps/goals-step";
import { VoiceStep } from "@/components/solutions/appointment-receptionist/steps/voice-step";
import { CallbackRequiredFieldsEditor } from "@/components/solutions/appointment-receptionist/callback-required-fields-editor";
import { defaultCallbackRequiredCollectFieldIds } from "@/lib/solutions/appointment-receptionist/callback-required-field-defaults";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { DependencyRow } from "@/components/voice/dependency-row";
import { RECEPTIONIST_EDITOR_SECTIONS } from "@/lib/voice/receptionist/receptionist-editor-shared";
import { ReceptionistCollectFieldsEditor } from "./receptionist-collect-fields-editor";
import { ReceptionistBookingHandlingSection } from "./receptionist-booking-handling-section";
import { Panel } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";

type Props = {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  hoursSummary: string;
  transferIssues: Array<{ message: string }>;
  calendarSummary: { connected: boolean; label: string };
  showTestPanel: boolean;
  onEnsureAgent: () => Promise<{ agentId: string } | null>;
  sectionClassName?: string;
};

export function VoiceReceptionistEditorSections({
  state,
  patch,
  hoursSummary,
  transferIssues,
  calendarSummary,
  showTestPanel,
  onEnsureAgent,
  sectionClassName,
}: Props) {
  const sectionCn = cn("scroll-mt-24", sectionClassName);

  return (
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-8">
      <nav className="hidden shrink-0 lg:block lg:w-48" aria-label="Receptionist sections">
        <ul className="sticky top-4 space-y-1 text-sm">
          {RECEPTIONIST_EDITOR_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-wrap gap-1 lg:hidden">
        {RECEPTIONIST_EDITOR_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-border px-2.5 py-1 text-xs font-medium"
          >
            {s.label}
          </a>
        ))}
      </div>

      <div className="min-w-0 flex-1 space-y-6">
        <Panel id="identity-voice" title="Identity & voice" description="Name, role, and how Amy sounds on the phone." className={sectionCn}>
          <VoiceStep state={state} patch={patch} parts={["identity", "voice"]} showSidePanel={false} />
        </Panel>

        <Panel id="greeting-conversation" title="Greeting & conversation" className={sectionCn}>
          <VoiceStep state={state} patch={patch} parts={["greeting"]} showSidePanel={false} />
        </Panel>

        <Panel id="responsibilities" title="Responsibilities" className={sectionCn}>
          <GoalsStep state={state} patch={patch} compactCapabilities hideSidePanel hideSolutionName />
          <div className="mt-6 divide-y border-t pt-4">
            <DependencyRow
              title="Business hours"
              detail={hoursSummary}
              href="/voice/knowledge"
              linkLabel="Manage business hours"
            />
            <DependencyRow
              title="Business knowledge"
              detail={
                state.knowledgeBaseEnabled
                  ? "Knowledge base linked"
                  : "Answer questions may need knowledge sources"
              }
              href="/voice/knowledge"
              linkLabel="Manage business knowledge"
            />
            <DependencyRow
              title="Transfer calls"
              detail={
                state.capabilities.includes("transfer_calls")
                  ? transferIssues.length
                    ? "Needs call handling setup"
                    : "Configured"
                  : "Off"
              }
              href="/voice/call-handling"
              linkLabel="Manage call handling"
            />
          </div>
        </Panel>

        <Panel id="caller-information" title="Caller information" className={sectionCn}>
          <ReceptionistCollectFieldsEditor state={state} patch={patch} />
        </Panel>

        <Panel id="appointment-handling" title="Appointment handling" className={sectionCn}>
          <ReceptionistBookingHandlingSection
            state={state}
            patch={patch}
            calendarSummary={calendarSummary}
          />
        </Panel>

        <Panel
          id="messages-callbacks"
          title="Messages & callbacks"
          description="What Amy may collect on the call. Operational notifications live in Call Handling."
          className={sectionCn}
        >
          <div className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={state.callbackRequestsEnabled !== false}
                onChange={(e) => {
                  const on = e.target.checked;
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
              <span className="font-medium">Take messages and callback requests</span>
            </label>
            {state.callbackRequestsEnabled !== false ? (
              <CallbackRequiredFieldsEditor state={state} patch={patch} />
            ) : null}
            <DependencyRow
              title="After-hours notifications"
              detail="Who gets alerted after important outcomes"
              href="/voice/call-handling"
              linkLabel="Manage in call handling"
            />
          </div>
        </Panel>

        {showTestPanel ? (
          <Panel id="test" title="Test receptionist" className={sectionCn}>
            <TestStep state={state} patch={patch} onEnsureAgent={onEnsureAgent} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
