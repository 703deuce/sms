import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, ArrowRight, BookOpen, Calendar, Phone, Sparkles } from "lucide-react";
import Link from "next/link";

export default function AppointmentAssistantSolutionPage() {
  return (
    <div>
      <PageHeader
        title="Answer Calls and Book Appointments"
        description="Answer incoming calls, respond to questions, check availability, book appointments, and transfer callers when necessary."
        actions={
          <>
            <Link href="/solutions/ai-call-handling">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                AI Call Handling
              </Button>
            </Link>
            <Link href="/solutions/ai-call-handling/appointment-assistant/setup">
              <Button size="sm" className="gap-1.5">
                Set Up
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">Appointment Receptionist</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                A guided wizard configures phone routing, business knowledge, calendars,
                booking behavior, voice, and testing — without building a technical flow by
                hand. The visual workflow is generated underneath.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Requires
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-success" />
                  Phone
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple" />
                  AI Voice
                </li>
                <li className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  Calendar
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Optional
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>SMS</li>
                <li>CRM</li>
                <li>Human transfer</li>
                <li>Knowledge base</li>
                <li>Call recording</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/solutions/ai-call-handling/appointment-assistant/setup">
              <Button className="gap-1.5">
                Set Up
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href="/voice/agents">
              <Button variant="outline" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Learn More
              </Button>
            </Link>
          </div>
        </Card>

        <Card>
          <CardTitle>What the wizard covers</CardTitle>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>1. Goals — what the receptionist should handle</li>
            <li>2. Phone — number, ringing, connection greeting</li>
            <li>3. Information — business knowledge</li>
            <li>4. Appointments — calendars and bookable services</li>
            <li>5. Call Handling — booking flow and transfers</li>
            <li>6. Voice — identity, personality, and voice</li>
            <li>7. Test — guided scenarios and live tools log</li>
            <li>8. Activate — review and go live</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
