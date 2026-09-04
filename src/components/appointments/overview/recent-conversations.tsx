import { formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type ConversationRow = {
  id: string;
  name: string;
  preview: string;
  updatedAt: string;
  unread: boolean;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function conversationTag(unread: boolean): { label: string; tone: "green" | "violet" | "blue" } {
  if (unread) return { label: "Unread", tone: "violet" };
  return { label: "Recent", tone: "blue" };
}

const avatarTones = ["bg-primary/15 text-primary", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700"];

export function OverviewRecentConversations({ rows }: { rows: ConversationRow[] }) {
  return (
    <div className="appt-overview__card flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold text-foreground">Recent conversations</h2>
        <Link href="/conversations" className="appt-overview__link">View all</Link>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">No recent conversations.</div>
      ) : (
        <ul className="divide-y divide-border/70">
          {rows.slice(0, 4).map((c, idx) => {
            const tag = conversationTag(c.unread);
            return (
              <li key={c.id}>
                <Link href={`/conversations?conversationId=${c.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/30">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", avatarTones[idx % avatarTones.length])}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-[13px]", c.unread ? "font-semibold" : "font-medium")}>{c.name}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatAppointmentWhen(c.updatedAt).split(",")[0]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{c.preview || "No messages yet"}</p>
                    <span className={`appt-overview__badge appt-overview__badge-${tag.tone} mt-1.5`}>{tag.label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-border px-5 py-3">
        <Link href="/conversations" className="appt-overview__link">Go to conversations →</Link>
      </div>
    </div>
  );
}
