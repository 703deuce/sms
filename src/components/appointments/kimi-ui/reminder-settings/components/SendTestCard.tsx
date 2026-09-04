import { useState } from 'react';
import { Send, ChevronDown, Check } from 'lucide-react';
import { reminderOptions } from '../mock-data';

export default function SendTestCard() {
  const [phone, setPhone] = useState('(555) 123-4567');
  const [reminder, setReminder] = useState(reminderOptions[0]);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

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
            onChange={(e) => setPhone(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15"
          />
        </div>
        <div className="relative">
          <label className="mb-1.5 block text-[12px] font-medium text-foreground">Reminder</label>
          <button
            onClick={() => setOpen(!open)}
            className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15"
          >
            {reminder}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card p-1 shadow-lg">
              {reminderOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setReminder(opt);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground hover:bg-accent"
                >
                  {opt}
                  {opt === reminder && <Check className="h-3.5 w-3.5 text-[#4f46e5]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          setSent(true);
          setTimeout(() => setSent(false), 2500);
        }}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[#4f46e5] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#4338ca]"
      >
        {sent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {sent ? 'Test sent!' : 'Send test SMS'}
      </button>
    </div>
  );
}
