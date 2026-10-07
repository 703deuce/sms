"use client";

import { useState } from "react";
import { startPlatformProductCheckout } from "@/lib/mctb/start-platform-checkout";

type Props = {
  productKey: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  loginNextPath: string;
};

export function MctbLandingCheckoutButton({
  productKey,
  className,
  style,
  children,
  loginNextPath,
}: Props) {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void startPlatformProductCheckout({
          productKey,
          successPath: "/mctb",
        })
          .catch(() => {
            const next = encodeURIComponent(loginNextPath);
            window.location.href = `/login?next=${next}`;
          })
          .finally(() => setBusy(false));
      }}
    >
      {children}
    </button>
  );
}
