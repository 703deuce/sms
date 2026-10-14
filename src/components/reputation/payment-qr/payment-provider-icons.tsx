import type { ReactElement } from "react";
import type { PaymentProvider } from "@/lib/reputation/payment-qr/types";
import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
  variant?: "color" | "mono";
};

/** Official-style Stripe / card mark for Payment Links */
export function StripeApplePayIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <rect x="6" y="11" width="28" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
        <rect x="6" y="15" width="28" height="4" fill="currentColor" opacity="0.35" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#635BFF" />
      <rect x="9" y="13" width="22" height="14" rx="2.5" fill="white" />
      <rect x="9" y="16" width="22" height="3.5" fill="#635BFF" opacity="0.35" />
      <rect x="12" y="21" width="8" height="4" rx="1" fill="#C4B5FD" />
    </svg>
  );
}

/** Venmo brand — blue tile with white angular V */
export function VenmoIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M26.2 9.5c-2.4 3.2-4.6 7-6.1 11.2 2-0.9 4.2-1.3 6.5-1.3 1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2c-4.5 0-8.3-1.8-10.9-4.8-2.2 3.5-4.3 7.4-5.7 11.8h4.8c1.3-3.5 3-6.6 5.1-9.2 1.3 1 3 1.7 4.8 2.1-1.3 2.6-2.2 5.6-2.6 8.7h4.8c0.4-3.9 1.7-7.8 3.9-11.1 1.7-2.6 3.9-4.8 6.5-6.5l-2.2-3.7z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#008CFF" />
      <path
        d="M26.2 9.5c-2.4 3.2-4.6 7-6.1 11.2 2-0.9 4.2-1.3 6.5-1.3 1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2c-4.5 0-8.3-1.8-10.9-4.8-2.2 3.5-4.3 7.4-5.7 11.8h4.8c1.3-3.5 3-6.6 5.1-9.2 1.3 1 3 1.7 4.8 2.1-1.3 2.6-2.2 5.6-2.6 8.7h4.8c0.4-3.9 1.7-7.8 3.9-11.1 1.7-2.6 3.9-4.8 6.5-6.5l-2.2-3.7z"
        fill="white"
        transform="translate(3, 1) scale(0.92)"
      />
    </svg>
  );
}

/** Cash App — green tile with white dollar mark */
export function CashAppIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M20 8c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12-5.4-12-12-12zm1.2 19.2h-2.4v-2h2.4c1.1 0 2-0.9 2-2s-0.9-2-2-2h-2.4v-2h2.4c2.2 0 4 1.8 4 4s-1.8 4-4 4zm-1.2-9.6h-2.4v-2h2.4c2.2 0 4 1.8 4 4h-2c0-1.1-0.9-2-2-2z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#00D632" />
      <path
        d="M20 10c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm1.2 17.2h-2.4v-2h2.4c1.1 0 2-0.9 2-2s-0.9-2-2-2h-2.4v-2h2.4c2.2 0 4 1.8 4 4s-1.8 4-4 4zm-1.2-8.8h-2.4v-2h2.4c2.2 0 4 1.8 4 4h-2c0-1.1-0.9-2-2-2z"
        fill="white"
      />
    </svg>
  );
}

/** PayPal dual-tone wordmark simplified for small tiles */
export function PayPalIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M15.5 11h5.8c3.1 0 4.9 1.6 4.5 4-.4 2.2-2.5 3.5-4.9 3.5H16l-1.2 6.5h-4.2l3.5-14zm2.2 7.2h2.9c1.8 0 2.8-1 3-2.6-.2-1.3-1.3-2.2-2.8-2.2H17l-1 4.8z"
          fill="currentColor"
        />
        <path
          d="M25.5 18.5h3.5l-1 5.5h-3.5l1-5.5zm1.3-7.5h5.2l-.4 2.2h-4.8l.4-2.2zm-.8 4.2h4.8l-.4 2.2h-4.8l.4-2.2z"
          fill="currentColor"
          opacity="0.75"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#003087" />
      <path
        d="M15.5 12h5.8c3.1 0 4.9 1.6 4.5 4-.4 2.2-2.5 3.5-4.9 3.5H16l-1.2 6.5h-4.2l3.5-14zm2.2 7.2h2.9c1.8 0 2.8-1 3-2.6-.2-1.3-1.3-2.2-2.8-2.2H17l-1 4.8z"
        fill="white"
      />
      <path
        d="M25.5 19.5h3.5l-1 5.5h-3.5l1-5.5zm1.3-7.5h5.2l-.4 2.2h-4.8l.4-2.2zm-.8 4.2h4.8l-.4 2.2h-4.8l.4-2.2z"
        fill="#009CDE"
      />
    </svg>
  );
}

/** Zelle — purple tile with white Z mark */
export function ZelleIcon({ className, variant = "color" }: IconProps) {
  if (variant === "mono") {
    return (
      <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
        <path
          d="M27 11H13v3.5h7.5L13 28.5h4.5l8.5-10.5H27v3.5h-7.5L27 11z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="10" fill="#6D1ED4" />
      <path
        d="M27 12H13v3.5h7.5L13 29.5h4.5l8.5-10.5H27v3.5h-7.5L27 12z"
        fill="white"
      />
    </svg>
  );
}

export function GoogleMarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const ICON_MAP: Record<PaymentProvider, (props: IconProps) => ReactElement> = {
  stripe: StripeApplePayIcon,
  venmo: VenmoIcon,
  cash_app: CashAppIcon,
  paypal: PayPalIcon,
  zelle: ZelleIcon,
};

export function PaymentProviderIcon({
  provider,
  className,
  variant = "color",
}: {
  provider: PaymentProvider;
  className?: string;
  variant?: "color" | "mono";
}) {
  const Icon = ICON_MAP[provider];
  return (
    <Icon
      className={cn("h-9 w-9 shrink-0", className)}
      variant={variant}
    />
  );
}
