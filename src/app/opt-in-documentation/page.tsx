import { LegalShell } from "@/components/landing/legal-shell";
import optInFlowDiagram from "@/components/landing/mctb/mctb-opt-in-flow-diagram.jpg";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Opt-In Documentation",
  description:
    "Transovo Missed Call Text Back (MCTB) opt-in flow: IVR disclosure, Press-1 consent, opt-in confirmation SMS, and STOP/HELP handling.",
  alternates: {
    canonical: "/opt-in-documentation",
  },
};

export default function OptInDocumentationPage() {
  return (
    <LegalShell title="SMS Opt-In Documentation" effectiveDate="September 21, 2026">
      <p>
        This page documents how consumers opt in to Transovo&apos;s conversational SMS messaging
        program through the Missed Call Text Back (MCTB) flow. It is intended for carrier toll-free
        verification, compliance review, and internal reference.
      </p>

      <h2>MCTB opt-in flow diagram</h2>
      <p>
        <strong>Brand / sender of record:</strong> Transovo. Example business context in the diagram
        (e.g., Lakeside Dental) illustrates how a participating business appears in message body copy
        only — not as the SMS sender prefix.
      </p>

      <figure className="my-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
        <Image
          src={optInFlowDiagram}
          alt="MCTB Opt-In Flow Diagram for Transovo: caller dials business, call is unanswered, forwards to Transovo IVR with consent disclosure, Press 1 to consent, opt-in SMS sent, subsequent conversational messages, and STOP or HELP handling."
          className="h-auto w-full"
          sizes="(max-width: 768px) 100vw, 768px"
          priority
        />
      </figure>

      <h2>Summary</h2>
      <ul>
        <li>
          <strong>Consent:</strong> Obtained only when the caller presses 1 after the IVR disclosure.
          No Press 1 / hang up → no SMS, no consent recorded.
        </li>
        <li>
          <strong>First SMS:</strong> Includes required disclaimers (rates, frequency, terms, privacy).
          Later messages include STOP/HELP as applicable.
        </li>
        <li>
          <strong>Consent is not a condition of purchase.</strong>
        </li>
        <li>
          <strong>Privacy:</strong> See our{" "}
          <a href="/privacy#sms-messaging-privacy">SMS Messaging Privacy</a> section and{" "}
          <a href="/terms#sms-messaging-terms">SMS Messaging Terms</a>.
        </li>
      </ul>

      <p>
        Related policies: <a href="/privacy">Privacy Policy</a>, <a href="/terms">Terms of Service</a>,{" "}
        <a href="/acceptable-use">Acceptable Use Policy</a>.
      </p>
    </LegalShell>
  );
}
