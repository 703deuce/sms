import { SmsOptIn } from "@/components/auth/sms-opt-in";
import {
  SMS_2FA_ADDITIONAL_DETAILS,
  SMS_2FA_USE_CASE_SUMMARY,
  SMS_OPT_IN_DISCLOSURE,
} from "@/lib/auth/sms-opt-in-copy";
import { BRAND_NAME } from "@/lib/brand";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Opt-In & Phone Verification",
  description: SMS_OPT_IN_DISCLOSURE,
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
            <p className="mt-1 text-sm text-muted-foreground">{SMS_2FA_USE_CASE_SUMMARY}</p>
          </div>

          <p className="mb-4 text-xs leading-5 text-muted-foreground">
            Enter your mobile phone number during account registration, sign-in verification,
            phone-number verification, or password recovery. Before requesting the code, you are
            informed that {BRAND_NAME} will send a one-time verification code by SMS. The message is
            sent only after you actively request it.
          </p>

          <SmsOptIn />

          <p className="mt-6 border-t border-border pt-4 text-center text-[11px] leading-5 text-muted-foreground">
            {SMS_OPT_IN_DISCLOSURE} {SMS_2FA_ADDITIONAL_DETAILS} View our{" "}
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
          {" · "}
          <Link href="/forgot-password" className="hover:underline">
            Reset password
          </Link>
        </p>
      </div>
    </div>
  );
}
