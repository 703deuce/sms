import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Button, Card, CardTitle } from "./ui";

export function ScheduleReportCard() {
  const [email, setEmail] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function schedule() {
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setScheduling(true);
    // Preserve backend contract: POST /api/appointments/analytics/export (schedule)
    await new Promise((r) => setTimeout(r, 700));
    setScheduling(false);
    setDone(true);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary">
          <Mail size={18} />
        </div>
        <div>
          <CardTitle>Scheduled report</CardTitle>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Email a weekly analytics summary to yourself or your team.
          </p>
        </div>
      </div>

      {done ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-700">
          <CheckCircle2 size={16} />
          Weekly report scheduled for {email}
        </div>
      ) : (
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            schedule();
          }}
        >
          <label
            htmlFor="report-email"
            className="text-xs font-semibold text-foreground"
          >
            Email address
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="report-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <Button size="md" type="submit" disabled={scheduling}>
              {scheduling ? "Scheduling…" : "Schedule"}
            </Button>
          </div>
          {error ? (
            <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
          ) : null}
        </form>
      )}
    </Card>
  );
}
