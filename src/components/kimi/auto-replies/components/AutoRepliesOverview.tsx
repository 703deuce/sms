import { MessageSquareReply, ShieldCheck, Tags, Inbox, ArrowRight } from "lucide-react";

export type Section = "optin" | "compliance" | "keywords" | "inbox";

const cards: {
  id: Section;
  title: string;
  desc: string;
  icon: any;
  tint: string;
  stat: string;
  emoji: string;
}[] = [
  {
    id: "optin",
    title: "Opt-In Auto-Responses",
    desc: "Default messages sent when contacts subscribe: opt-in, double opt-in, already-subscribed and re-opt-in replies.",
    icon: MessageSquareReply,
    tint: "bg-indigo-50 text-indigo-600",
    stat: "4 messages configured",
    emoji: "✅",
  },
  {
    id: "compliance",
    title: "Compliance Messaging",
    desc: "TCPA-required verbiage: pre opt-in statements, opt-in compliance, opt-out and help messages.",
    icon: ShieldCheck,
    tint: "bg-teal-50 text-teal-600",
    stat: "4 statements · locked",
    emoji: "🛡️",
  },
  {
    id: "keywords",
    title: "Keyword Auto-Responses",
    desc: "Override the default opt-in reply for each text-to-join keyword with custom offers and copy.",
    icon: Tags,
    tint: "bg-violet-50 text-violet-600",
    stat: "5 keywords active",
    emoji: "🏷️",
  },
  {
    id: "inbox",
    title: "Inbox Auto-Response",
    desc: "Automatically reply to new inbound conversations, with separate messages for inside and outside office hours.",
    icon: Inbox,
    tint: "bg-amber-50 text-amber-600",
    stat: "Office hours aware",
    emoji: "💬",
  },
];

export default function AutoRepliesOverview({ onOpen }: { onOpen: (s: Section) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-indigo-600 text-[22px] shadow-sm">
              ⚡
            </span>
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-foreground">Auto-Replies</h1>
              <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
                Manage the automated texts Transovo sends — opt-in confirmations, compliance, keyword replies,
                and inbox auto-responses.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="group rounded-[14px] border border-border bg-card p-6 text-left transition hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[24px]">{c.emoji}</span>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-[12px] ${c.tint}`}>
                    <Icon size={18} />
                  </div>
                </div>
                <ArrowRight
                  size={18}
                  className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-indigo-600"
                />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-foreground">{c.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{c.desc}</p>
              <span className="mt-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-[12px] font-medium text-indigo-600">
                {c.stat}
              </span>
            </button>
          );
        })}
      </div>

      <div className="info-note mt-8">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>
          Compliance statements are automatically appended to your auto-replies where required by
          TCPA and cellular carriers. Editable replies can be customized per opt-in method.
        </span>
      </div>
    </div>
  );
}
