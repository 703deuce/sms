import { SmsOptIn } from "@/components/auth/sms-opt-in";
import { BRAND_NAME } from "@/lib/brand";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Opt-In & Phone Verification",
  description: `Opt in to receive a one-time verification code from ${BRAND_NAME} by SMS. Message and data rates may apply. Reply STOP to opt out, HELP for help.`,
};

export default function SmsOptInPage() {
  return (
    <div className="bg-mesh flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="surface rounded-2xl p-8">
          <div className="mb-6 text-center">
            <p className="font-display text-3xl font-semibold tracking-tight text-primary">
              {BRAND_NAME}
            </p>
            <h1 className="mt-3 font-display text-xl font-semibold">Verify your mobile number</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We use a one-time SMS code to confirm your number, the same way an email is verified.
            </p>
          </div>

          <SmsOptIn />

          <p className="mt-6 border-t border-border pt-4 text-center text-[11px] leading-5 text-muted-foreground">
            By entering your mobile number and requesting a code, you agree to receive a one-time
            verification code from {BRAND_NAME} by SMS. Message and data rates may apply. Message
            frequency varies. Reply STOP to opt out and HELP for help. View our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/login" className="hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
