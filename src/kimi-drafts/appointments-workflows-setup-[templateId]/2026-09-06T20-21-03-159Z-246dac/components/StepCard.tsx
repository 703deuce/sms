import { CalendarClock, ChevronDown, ChevronUp, Copy, GripVertical, Mail, MessageSquare, Phone, Trash2 } from "lucide-react";
import { ACTION_OPTIONS, describeTiming, type WorkflowStep } from "../mock-data";

const channelIcon = (channel: string) => {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" />;
  if (channel === "voice") return <Phone className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
};

export default function StepCard({
  step,
  index,
  total,
  selected,
  onSelect,
  onMove,
  onRemove,
  onToggle,
  onDuplicate,
}: {
  step: WorkflowStep;
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onToggle: (index: number) => void;
  onDuplicate: (index: number) => void;
}) {
  const action = ACTION_OPTIONS.find((a) => a.value === step.action);
  return (
    <div
      onClick={onSelect}
      className={`group relative flex cursor-pointer items-stretch gap-3 rounded-xl border bg-card p-3.5 transition-all duration-150 ${
        selected ? "border-primary/40 shadow-sm ring-1 ring-primary/20" : "border-border hover:border-primary/30 hover:shadow-sm"
      } ${!step.enabled ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col items-center gap-0.5 pt-1 text-muted-foreground/60">
        <GripVertical className="h-4 w-4" />
        <button
          aria-label="Move step up"
          disabled={index === 0}
          onClick={(e) => { e.stopPropagation(); onMove(index, -1); }}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="Move step down"
          disabled={index === total - 1}
          onClick={(e) => { e.stopPropagation(); onMove(index, 1); }}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
            {index + 1}
          </span>
          <p className="truncate text-[13.5px] font-semibold tracking-tight text-foreground">{step.name}</p>
          {step.stopIfConfirmed ? (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-semibold text-success">
              Skip if confirmed
            </span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" />
            {describeTiming(step.timing)}
          </span>
          <span className="inline-flex items-center gap-1">
            {channelIcon(step.channel)}
            {action?.label || step.action}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-0.5">
        <button
          aria-label={step.enabled ? "Disable step" : "Enable step"}
          onClick={(e) => { e.stopPropagation(); onToggle(index); }}
          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${step.enabled ? "bg-primary" : "bg-border"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${step.enabled ? "left-4.5 left-[18px]" : "left-0.5"}`}
          />
        </button>
        <button
          aria-label="Duplicate step"
          onClick={(e) => { e.stopPropagation(); onDuplicate(index); }}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="Remove step"
          onClick={(e) => { e.stopPropagation(); onRemove(index); }}
          className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
