import { MessageSquareReply, ShieldCheck, Tags, Inbox, ArrowRight } from "lucide-react";

export type Section = "optin" | "compliance" | "keywords" | "inbox";

const cards: {
  id: Section;
  title: string;
  desc: string;
  icon: any;
  tint: string;
  chip: string;
  stat: string;
}[] = [
  {
    id: "optin",
    title: "Opt-In Auto-Responses",
    desc: "Default messages sent when contacts subscribe: opt-in, double opt-in, already-subscribed and re-opt-in replies.",
    icon: MessageSquareReply,
    tint: "bg-indigo-50 text-indigo-600",
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    stat: "4 messages configured",
  },
  {
    id: "compliance",
    title: "Compliance Messaging",
    desc: "TCPA-required verbiage: pre opt-in statements, opt-in compliance, opt-out and help messages.",
    icon: ShieldCheck,
    tint: "bg-teal-50 text-teal-600",
    chip: "bg-teal-50 text-teal-700 ring-teal-100",
    stat: "4 statements · locked",
  },
  {
    id: "keywords",
    title: "Keyword Auto-Responses",
    desc: "Override the default opt-in reply for each text-to-join keyword with custom offers and copy.",
    icon: Tags,
    tint: "bg-violet-50 text-violet-600",
    chip: "bg-violet-50 text-violet-700 ring-violet-100",
    stat: "5 keywords active",
  },
  {
    id: "inbox",
    title: "Inbox Auto-Response",
    desc: "Automatically reply to new inbound conversations, with separate messages for inside and outside office hours.",
    icon: Inbox,
    tint: "bg-amber-50 text-amber-600",
    chip: "bg-amber-50 text-amber-700 ring-amber-100",
    stat: "Office hours aware",
  },
];

export default function AutoRepliesOverview({ onOpen }: { onOpen: (s: Section) => void }) {
  return (
    <div>
      <div className="mb-8 flex items-start gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <MessageSquareReply className="h-5 w-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h1 className="font-display text-[24px] font-bold leading-tight tracking-tight text-foreground">
            Auto-Replies
          </h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            Manage the automated texts Transovo sends — opt-in confirmations, compliance, keyword replies,
            and inbox auto-responses.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="group surface flex flex-col rounded-xl bg-card p-5 text-left transition-all duration-150 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${c.tint}`}>
                  <Icon size={18} />
                </div>
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/60 transition-all duration-150 group-hover:bg-primary/10 group-hover:text-primary">
                  <ArrowRight
                    size={15}
                    className="transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                </span>
              </div>
              <h3 className="mt-3.5 text-[15px] font-semibold tracking-tight text-foreground">
                {c.title}
              </h3>
              <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted-foreground">
                {c.desc}
              </p>
              <span
                className={`mt-4 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ${c.chip}`}
              >
                {c.stat}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
        <span>
          Compliance statements are automatically appended to your auto-replies where required by
          TCPA and cellular carriers. Editable replies can be customized per opt-in method.
        </span>
      </div>
    </div>
  );
}
