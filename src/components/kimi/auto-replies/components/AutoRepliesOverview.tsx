import { MessageSquareReply, ShieldCheck, Tags, Inbox, ArrowRight, Zap } from "lucide-react";

export type Section = "optin" | "compliance" | "keywords" | "inbox";

const cards: {
  id: Section;
  title: string;
  desc: string;
  icon: any;
  tint: string;
  stat: string;
}[] = [
  {
    id: "optin",
    title: "Opt-In Auto-Responses",
    desc: "Default messages sent when contacts subscribe: opt-in, double opt-in, already-subscribed and re-opt-in replies.",
    icon: MessageSquareReply,
    tint: "bg-indigo-50 text-indigo-600",
    stat: "4 messages configured",
  },
  {
    id: "compliance",
    title: "Compliance Messaging",
    desc: "TCPA-required verbiage: pre opt-in statements, opt-in compliance, opt-out and help messages.",
    icon: ShieldCheck,
    tint: "bg-teal-50 text-teal-600",
    stat: "4 statements · locked",
  },
  {
    id: "keywords",
    title: "Keyword Auto-Responses",
    desc: "Override the default opt-in reply for each text-to-join keyword with custom offers and copy.",
    icon: Tags,
    tint: "bg-violet-50 text-violet-600",
    stat: "5 keywords active",
  },
  {
    id: "inbox",
    title: "Inbox Auto-Response",
    desc: "Automatically reply to new inbound conversations, with separate messages for inside and outside office hours.",
    icon: Inbox,
    tint: "bg-amber-50 text-amber-600",
    stat: "Office hours aware",
  },
];

export default function AutoRepliesOverview({ onOpen }: { onOpen: (s: Section) => void }) {
  return (
    <div>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <h1 className="text-[26px] font-bold text-foreground tracking-tight">Auto-Replies</h1>
          </div>
          <p className="text-[14px] text-muted-foreground mt-2 max-w-2xl">
            Manage the automated text messages Transovo sends on your behalf — opt-in confirmations,
            compliance verbiage, keyword replies, and inbox auto-responses.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-7">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="text-left bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.tint}`}>
                  <Icon size={20} />
                </div>
                <ArrowRight
                  size={18}
                  className="text-muted-foreground group-hover:text-indigo-600 group-hover:translate-x-1 transition-all"
                />
              </div>
              <h3 className="text-[16px] font-semibold text-foreground mt-4">{c.title}</h3>
              <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">{c.desc}</p>
              <span className="inline-block mt-4 text-[12px] font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
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
