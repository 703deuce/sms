'use client';

import { useState } from 'react';
import { Check, Plus, Lock } from 'lucide-react';
import MergeTagsCard from './components/MergeTagsCard';
import SendTestCard from './components/SendTestCard';
import ReminderCard from './components/ReminderCard';
import { initialReminders, type Reminder } from './mock-data';
import './reference.css';

export default function ReminderSettingsPage() {
  const [reminders, setReminders] = useState<Reminder[]>(initialReminders);
  const [saved, setSaved] = useState(true);

  const toggle = (id: string) => {
    setReminders((rs) => rs.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setSaved(false);
  };

  const updateTemplate = (id: string, value: string) => {
    setReminders((rs) => rs.map((r) => (r.id === id ? { ...r, template: value } : r)));
    setSaved(false);
  };

  const addReminder = () => {
    const n = reminders.length + 1;
    setReminders((rs) => [
      ...rs,
      {
        id: `custom-${n}`,
        index: n,
        icon: 'message',
        title: 'Custom reminder',
        badge: '1h before',
        description: 'Sent shortly before the appointment.',
        template: 'Reminder: {{service}} with {{business_name}} at {{appointment_time}}.',
        preview: 'Reminder: Consultation with Mass Texting Browser Cert at 9:00 AM.',
        characters: 64,
        segments: 1,
        enabled: true,
      },
    ]);
    setSaved(false);
  };

  return (
    <div className="reminder-settings-page mx-auto max-w-[1100px] px-8 py-7">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            Reminder Settings
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Automate appointment reminders to reduce no-shows and keep your schedule on track.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {saved && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-600">
              <Check className="h-4 w-4" /> All changes saved
            </span>
          )}
          <button
            onClick={() => setSaved(true)}
            className="h-9 rounded-lg bg-[#4f46e5] px-4 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#4338ca]"
          >
            Save reminder settings
          </button>
        </div>
      </div>

      {/* top cards */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <MergeTagsCard />
        <SendTestCard />
      </div>

      {/* sequence header */}
      <div className="mt-7 flex items-start justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Reminder sequence</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Confirmation is sent immediately after booking. Other reminders are scheduled relative
            to the appointment time.
          </p>
        </div>
        <button
          onClick={addReminder}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-[#4f46e5] shadow-sm transition-colors hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> Add reminder
        </button>
      </div>

      {/* sequence */}
      <div className="mt-4">
        {reminders.map((r) => (
          <ReminderCard
            key={r.id}
            reminder={r}
            onToggle={toggle}
            onTemplateChange={updateTemplate}
          />
        ))}
      </div>

      {/* footer */}
      <div className="mt-2 flex items-center justify-center gap-1.5 pb-6 text-[12px] text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Messages are sent via SMS from +1 (571) 407-3615. Standard message rates may apply.
      </div>
    </div>
  );
}
