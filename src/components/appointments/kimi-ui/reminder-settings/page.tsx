'use client';

import { Check, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MergeTagsCard from './components/MergeTagsCard';
import SendTestCard from './components/SendTestCard';
import ReminderCard from './components/ReminderCard';
import type { RemindersPageActions, RemindersPageModel } from '@/features/appointments/kimi/reminders/types';
import type { ReminderStepKey } from '@/features/appointments/kimi/reminders/types';
import './reference.css';

type Props = {
  model: RemindersPageModel;
  actions: RemindersPageActions;
  saved?: boolean;
  saving?: boolean;
  testPhone?: string;
  testStep?: ReminderStepKey;
  testing?: boolean;
  testSent?: boolean;
  testError?: string;
};

export default function ReminderSettingsView({
  model,
  actions,
  saved = true,
  saving = false,
  testPhone = '',
  testStep = 'confirmation',
  testing = false,
  testSent = false,
  testError = '',
}: Props) {
  return (
    <div className="reminder-settings-page mx-auto max-w-[1100px] px-8 py-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
            Reminder Settings
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Automate appointment reminders to reduce no-shows and keep your schedule on track.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 pt-1">
          {saved && !saving ? (
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-600">
              <Check className="h-4 w-4" /> All changes saved
            </span>
          ) : null}
          <Button onClick={actions.onSave} disabled={saving} size="md" className="text-[13px]">
            {saving ? 'Saving…' : 'Save reminder settings'}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <MergeTagsCard tags={model.mergeTags} />
        <SendTestCard
          phone={testPhone}
          stepKey={testStep}
          options={model.testStepOptions}
          testing={testing}
          sent={testSent}
          error={testError}
          onPhoneChange={actions.onTestPhoneChange}
          onStepChange={actions.onTestStepChange}
          onSend={actions.onSendTest}
        />
      </div>

      <div className="mt-7 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            Reminder sequence
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Confirmation is sent immediately after booking. Other reminders are scheduled relative
            to the appointment time.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {model.reminders.map((r) => (
          <ReminderCard
            key={r.id}
            reminder={r}
            onToggle={() => actions.onToggle(r.stepKey)}
            onTemplateChange={(value) => actions.onTemplateChange(r.stepKey, value)}
            onChannelChange={(channel) => actions.onChannelChange(r.stepKey, channel)}
            onReset={() => actions.onResetTemplate(r.stepKey)}
            onAdvancedChange={(patch) => actions.onAdvancedChange(r.stepKey, patch)}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5 pb-6 text-[12px] text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        {model.smsSenderLabel}
      </div>
    </div>
  );
}
