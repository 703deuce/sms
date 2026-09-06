import { BellRing, CheckCircle2, Clock, MessageSquare, Phone, Mail, User } from "lucide-react";
import { describeTiming, TRIGGER_OPTIONS, type WorkflowStep } from "../mock-data";

const channelIcon = (c: string) =>
  c === "voice" ? <Phone className="h-3 w-3" /> : c === "email" ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />;

function fillPreview(template: string) {
  return template
    .replaceAll("{{first_name}}", "Sarah")
    .replaceAll("{{business_name}}", "Bright Dental")
    .replaceAll("{{service}}", "Initial Consultation")
    .replaceAll("{{appointment_date}}", "Thursday, September 10")
    .replaceAll("{{appointment_time}}", "2:00 PM")
    .replaceAll("{{confirm_link}}", "transovo.app/c/x7Kq")
    .replaceAll("{{reschedule_link}}", "transovo.app/r/x7Kq")
    .replaceAll("{{cancel_link}}", "transovo.app/x/x7Kq")
    .replaceAll("{{payment_link}}", "transovo.app/p/x7Kq")
    .replaceAll("{{review_link}}", "transovo.app/v/x7Kq");
}

export default function WorkflowPreviewPane({
  trigger,
  steps,
  typeScope,
  types,
}: {
  trigger: string;
  steps: WorkflowStep[];
  typeScope: "all" | "selected";
  types: string[];
}) {
  const active = steps.filter((s) => s.enabled);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-3.5">
        <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">Preview</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">How this workflow runs for a sample appointment</p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Sample appointment */}
        <div className="rounded-xl border border-border bg-muted/50 p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-foreground">Sarah Johnson</p>
              <p className="text-xs text-muted-foreground">Initial Consultation · Thu, Sep 10 · 2:00 PM ET</p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground ring-1 ring-border">
              <BellRing className="h-3 w-3" />
              {TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label || trigger}
            </span>
            <span className="rounded-full bg-card px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground ring-1 ring-border">
              {typeScope === "all" ? "All booking types" : `${types.length} booking type${types.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        {/* Timeline */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Execution timeline</p>
          {active.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
              <p className="text-sm font-medium text-foreground">No enabled steps</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Add or enable a step to see the schedule.</p>
            </div>
          ) : (
            <ol className="relative space-y-3 border-l border-border pl-5">
              {active.map((s) => (
                <li key={s.id} className="relative">
                  <span className="absolute -left-[26px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-card" />
                  <div className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground">{s.name}</p>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                        {channelIcon(s.channel)}
                        <Clock className="h-3 w-3" />
                        {describeTiming(s.timing)}
                      </span>
                    </div>
                    {s.messageTemplate ? (
                      <p className="mt-1.5 line-clamp-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                        {fillPreview(s.messageTemplate)}
                      </p>
                    ) : null}
                    {s.stopIfConfirmed ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-success">
                        <CheckCircle2 className="h-3 w-3" /> Skipped when already confirmed
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <p className="rounded-lg bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          If the appointment is canceled, all pending steps are stopped automatically. Rescheduling recalculates every
          relative-time step.
        </p>
      </div>
    </div>
  );
}
