import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import {
  Bell,
  Cake,
  Calendar,
  CreditCard,
  Gift,
  MessageCircle,
  Package,
  PhoneMissed,
  RefreshCw,
  Sparkles,
  Star,
  UserPlus,
  Zap,
} from "lucide-react";
import Link from "next/link";

const automationTabs = [
  { label: "Flows", href: "/automations" },
  { label: "Templates", href: "/automations/templates" },
  { label: "Logs", href: "/automations/logs" },
];

const flowTemplates = [
  {
    name: "Welcome series",
    description: "3-message onboarding sequence for new subscribers with opt-in confirmation.",
    trigger: "Contact joins list",
    steps: 3,
    icon: Sparkles,
  },
  {
    name: "Appointment reminder",
    description: "Reminder 24h and 2h before scheduled appointments with confirm/reschedule.",
    trigger: "Appointment date",
    steps: 2,
    icon: Calendar,
  },
  {
    name: "Estimate follow-up",
    description: "Follow up on open estimates after 48h with a gentle nudge to book.",
    trigger: "Tag added: estimate",
    steps: 2,
    icon: MessageCircle,
  },
  {
    name: "Missed-call response",
    description: "Auto-text callers when a call goes unanswered during business hours.",
    trigger: "Missed call",
    steps: 1,
    icon: PhoneMissed,
  },
  {
    name: "Birthday",
    description: "Send a personalized birthday greeting with an optional promo code.",
    trigger: "Birthday",
    steps: 1,
    icon: Cake,
  },
  {
    name: "Reactivation",
    description: "Win back inactive contacts who haven't engaged in 90+ days.",
    trigger: "No activity 90 days",
    steps: 3,
    icon: RefreshCw,
  },
  {
    name: "Event reminder",
    description: "Remind registrants before an event with location and check-in details.",
    trigger: "Event date",
    steps: 2,
    icon: Bell,
  },
  {
    name: "Payment reminder",
    description: "Friendly invoice reminders at 7, 3, and 1 day before due date.",
    trigger: "Invoice due date",
    steps: 3,
    icon: CreditCard,
  },
  {
    name: "Review request",
    description: "Ask happy customers for a review 24h after service completion.",
    trigger: "Service completed",
    steps: 1,
    icon: Star,
  },
  {
    name: "Order update",
    description: "Shipped, out for delivery, and delivered notifications for e-commerce.",
    trigger: "Order status change",
    steps: 3,
    icon: Package,
  },
  {
    name: "New lead follow-up",
    description: "Instant response plus 24h and 72h follow-ups for inbound leads.",
    trigger: "Form submission",
    steps: 3,
    icon: UserPlus,
  },
  {
    name: "Keyword response",
    description: "Auto-reply when contacts text a specific keyword like JOIN or HELP.",
    trigger: "Incoming keyword",
    steps: 1,
    icon: Zap,
  },
  {
    name: "No-response follow-up",
    description: "Re-engage contacts who didn't reply to your last outbound message.",
    trigger: "No reply after 48 hours",
    steps: 2,
    icon: MessageCircle,
  },
];

export default function AutomationTemplatesPage() {
  return (
    <div>
      <PageHeader
        title="Automation templates"
        description="Start from a proven flow template and customize triggers, timing, and messages."
        actions={
          <Link href="/automations/new">
            <Button>Start from scratch</Button>
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
              className="flex flex-col transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle>{template.name}</CardTitle>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {template.description}
                  </p>
                </div>
              </div>
              <dl className="mt-4 flex gap-4 text-xs">
                <div>
                  <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                    Trigger
                  </dt>
                  <dd className="mt-0.5 text-sm">{template.trigger}</dd>
                </div>
                <div>
                  <dt className="font-medium uppercase tracking-wide text-muted-foreground">
                    Steps
                  </dt>
                  <dd className="mt-0.5 text-sm">{template.steps}</dd>
                </div>
              </dl>
              <div className="mt-4 pt-2">
                <Link href="/automations/new">
                  <Button variant="outline" size="sm" className="w-full">
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
