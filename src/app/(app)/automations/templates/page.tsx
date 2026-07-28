import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/metric";
import { Tabs } from "@/components/ui/tabs";
import { automationTabs } from "@/lib/automation-tabs";
import {
  Bell,
  Cake,
  Calendar,
  CreditCard,
  MessageCircle,
  Package,
  PhoneMissed,
  Plus,
  RefreshCw,
  Sparkles,
  Star,
  UserPlus,
  Zap,
} from "lucide-react";
import Link from "next/link";

const flowTemplates = [
  {
    name: "Welcome series",
    description: "3-message onboarding sequence for new subscribers with opt-in confirmation.",
    trigger: "Contact joins list",
    steps: 3,
    icon: Sparkles,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    name: "Appointment reminder",
    description: "Reminder 24h and 2h before scheduled appointments with confirm/reschedule.",
    trigger: "Appointment date",
    steps: 2,
    icon: Calendar,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    name: "Estimate follow-up",
    description: "Follow up on open estimates after 48h with a gentle nudge to book.",
    trigger: "Tag added: estimate",
    steps: 2,
    icon: MessageCircle,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    name: "Missed-call response",
    description: "Auto-text callers when a call goes unanswered during business hours.",
    trigger: "Missed call",
    steps: 1,
    icon: PhoneMissed,
    tone: "bg-orange-50 text-orange-600",
  },
  {
    name: "Birthday",
    description: "Send a personalized birthday greeting with an optional promo code.",
    trigger: "Birthday",
    steps: 1,
    icon: Cake,
    tone: "bg-pink-50 text-pink-600",
  },
  {
    name: "Reactivation",
    description: "Win back inactive contacts who haven't engaged in 90+ days.",
    trigger: "No activity 90 days",
    steps: 3,
    icon: RefreshCw,
    tone: "bg-amber-50 text-amber-600",
  },
  {
    name: "Event reminder",
    description: "Remind registrants before an event with location and check-in details.",
    trigger: "Event date",
    steps: 2,
    icon: Bell,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    name: "Payment reminder",
    description: "Friendly invoice reminders at 7, 3, and 1 day before due date.",
    trigger: "Invoice due date",
    steps: 3,
    icon: CreditCard,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    name: "Review request",
    description: "Ask happy customers for a review 24h after service completion.",
    trigger: "Service completed",
    steps: 1,
    icon: Star,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    name: "Order update",
    description: "Shipped, out for delivery, and delivered notifications for e-commerce.",
    trigger: "Order status change",
    steps: 3,
    icon: Package,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    name: "New lead follow-up",
    description: "Instant response plus 24h and 72h follow-ups for inbound leads.",
    trigger: "Form submission",
    steps: 3,
    icon: UserPlus,
    tone: "bg-emerald-50 text-emerald-600",
  },
  {
    name: "Keyword response",
    description: "Auto-reply when contacts text a specific keyword like JOIN or HELP.",
    trigger: "Incoming keyword",
    steps: 1,
    icon: Zap,
    tone: "bg-amber-50 text-amber-600",
  },
  {
    name: "No-response follow-up",
    description: "Re-engage contacts who didn't reply to your last outbound message.",
    trigger: "No reply after 48 hours",
    steps: 2,
    icon: MessageCircle,
    tone: "bg-orange-50 text-orange-600",
  },
];

export default function AutomationTemplatesPage() {
  return (
    <div className="text-[13px]">
      <SectionHeader
        title="Automation templates"
        description="Start from a proven flow template and customize triggers, timing, and messages."
        actions={
          <Link href="/automations/new">
            <Button className="rounded-[10px]">
              <Plus className="h-4 w-4" />
              Start from scratch
            </Button>
          </Link>
        }
      />

      <Tabs items={automationTabs} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {flowTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Card
              key={template.name}
              className="flex flex-col rounded-[12px] p-4 transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${template.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold text-foreground">{template.name}</h3>
                  <p className="mt-1 text-[12px] text-muted-foreground">{template.description}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Trigger
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-medium">{template.trigger}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
                    Steps
                  </dt>
                  <dd className="mt-0.5 text-[13px] font-medium">{template.steps}</dd>
                </div>
              </dl>
              <div className="mt-auto pt-4">
                <Link href="/automations/new">
                  <Button variant="outline" size="sm" className="w-full rounded-[10px]">
                    Use template
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
