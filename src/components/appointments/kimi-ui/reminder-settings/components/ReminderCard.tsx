import {
  CalendarDays,
  Clock,
  MessageSquare,
  RotateCcw,
  Info,
} from 'lucide-react';
import type { ReminderItem } from '@/features/appointments/kimi/reminders/types';
import type { ReminderChannel } from '@/lib/appointments/types';
import PhonePreview from './PhonePreview';

const iconMap = {
  calendar: CalendarDays,
  clock: Clock,
  message: MessageSquare,
};

export default function ReminderCard({
  reminder,
  onToggle,
  onTemplateChange,
  onChannelChange,
  onReset,
}: {
  reminder: ReminderItem;
  onToggle: () => void;
  onTemplateChange: (value: string) => void;
  onChannelChange: (channel: ReminderChannel) => void;
  onReset: () => void;
}) {
  const Icon = iconMap[reminder.icon];
  const segmentCount =
    reminder.template.length > 160
      ? Math.ceil(reminder.template.length / 153)
      : reminder.segments;

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[#4f46e5] shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>

      <div className="mb-6 flex-1 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-foreground">
                {reminder.index}. {reminder.title}
              </h3>
              <span className="rounded-md bg-[#eef2ff] px-2 py-0.5 text-[11px] font-medium text-[#4f46e5]">
                {reminder.badge}
              </span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{reminder.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggle}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                reminder.enabled ? 'bg-[#4f46e5]' : 'bg-[#d1d5db]'
              }`}
              aria-label="Toggle reminder"
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  reminder.enabled ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-[12.5px] font-medium text-foreground">
              {reminder.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-3">
              <label className="text-[12px] font-medium text-foreground">Channel</label>
              <select
                value={reminder.channel === 'email' ? 'sms' : reminder.channel}
                onChange={(e) => onChannelChange(e.target.value as ReminderChannel)}
                className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-[12.5px]"
              >
                <option value="sms">SMS</option>
                <option value="voice">Voice call</option>
              </select>
              {reminder.channel === 'voice' ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Uses your Voice Reminders templates and keypad options.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sent from the Transovo platform number. Email reminders coming soon.
                </p>
              )}
            </div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[12px] font-medium text-foreground">
                {reminder.channel === 'voice' ? 'Call script' : 'Message template'}
              </label>
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset to default
              </button>
            </div>
            <textarea
              value={reminder.template}
              onChange={(e) => onTemplateChange(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-border bg-background p-3 text-[12.5px] leading-relaxed text-foreground outline-none focus:border-[#4f46e5] focus:ring-2 focus:ring-[#4f46e5]/15"
            />
            <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[11.5px] text-muted-foreground">
              {reminder.channel === 'sms' ? (
                <>
                  <span>
                    {reminder.template.length || reminder.characters} characters • {segmentCount} SMS
                    segment{segmentCount > 1 ? 's' : ''}
                  </span>
                  <Info className="h-3 w-3" />
                </>
              ) : reminder.channel === 'voice' ? (
                <span>Spoken on answer · voicemail script uses same template</span>
              ) : (
                <span>SMS and voice are supported today</span>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-foreground">Preview</label>
            <PhonePreview message={reminder.preview} />
          </div>
        </div>
      </div>
    </div>
  );
}
