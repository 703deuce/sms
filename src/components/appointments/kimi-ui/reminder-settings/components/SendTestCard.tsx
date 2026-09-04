import { useState } from 'react';
import { Send, ChevronDown, Check } from 'lucide-react';
import type { ReminderStepKey, ReminderTestOption } from '@/features/appointments/kimi/reminders/types';

type Props = {
  phone: string;
  stepKey: ReminderStepKey;
  options: ReminderTestOption[];
  testing?: boolean;
  sent?: boolean;
  error?: string;
  onPhoneChange: (phone: string) => void;
  onStepChange: (stepKey: ReminderStepKey) => void;
  onSend: () => void;
};

export default function SendTestCard({
  phone,
  stepKey,
  options,
  testing = false,
  sent = false,
  error = '',
  onPhoneChange,
  onStepChange,
  onSend,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === stepKey) || options[0];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-[#4f46e5]" />
        <h3 className="text-[14px] font-semibold text-foreground">Send yourself a test</h3>
      </div>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        See how your reminders look and feel.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-foreground">
            Your mobile number
          </label>
          <input
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15"
          />
        </div>
        <div className="relative">
          <label className="mb-1.5 block text-[12px] font-medium text-foreground">Reminder</label>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15"
          >
            {selected?.label}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card p-1 shadow-lg">
              {options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onStepChange(opt.key);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground hover:bg-accent"
                >
                  {opt.label}
                  {opt.key === stepKey && <Check className="h-3.5 w-3.5 text-[#4f46e5]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={onSend}
        disabled={testing || !phone.trim()}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#4f46e5] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#4338ca] disabled:opacity-60"
      >
        {sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {sent ? 'Test sent!' : testing ? 'Sending…' : 'Send test SMS'}
      </button>
    </div>
  );
}
