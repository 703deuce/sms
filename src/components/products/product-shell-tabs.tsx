"use client";

import {
  defaultProductShell,
  mctbShellHome,
  massSmsShellHome,
  productShellLabel,
  productShellShortLabel,
  PRODUCT_SWITCHER_ONBOARDING_KEY,
  readStoredProductShell,
  resolveProductShellFromPath,
  shellHomePath,
  writeStoredProductShell,
  type ProductShell,
} from "@/lib/products/product-shell";
import { cn } from "@/lib/utils";
import { LayoutGrid, Megaphone, PhoneMissed, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Props = {
  hasMctb: boolean;
  hasMassSms: boolean;
  className?: string;
};

export function useProductShell(hasMctb: boolean, hasMassSms: boolean) {
  const pathname = usePathname();
  const fromPath = useMemo(() => resolveProductShellFromPath(pathname), [pathname]);
  const [shell, setShellState] = useState<ProductShell>(() =>
    defaultProductShell({ hasMctb, hasMassSms }),
  );

  useEffect(() => {
    if (fromPath) {
      setShellState(fromPath);
      writeStoredProductShell(fromPath);
      return;
    }
    const stored = readStoredProductShell();
    if (stored) {
      setShellState(stored);
      return;
    }
    setShellState(defaultProductShell({ hasMctb, hasMassSms }));
  }, [fromPath, hasMctb, hasMassSms]);

  const setShell = (next: ProductShell) => {
    writeStoredProductShell(next);
    setShellState(next);
  };

  return { shell: fromPath ?? shell, setShell };
}

function ShellTab({
  active,
  shell,
  icon: Icon,
  label,
  shortLabel,
  onSelect,
}: {
  active: boolean;
  shell: ProductShell;
  icon: typeof Megaphone;
  label: string;
  shortLabel: string;
  onSelect: (shell: ProductShell) => void;
}) {
  const home = shellHomePath(shell);
  return (
    <Link
      href={home}
      onClick={() => onSelect(shell)}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden md:inline">{label}</span>
      <span className="md:hidden">{shortLabel}</span>
    </Link>
  );
}

export function ProductShellTabs({ hasMctb, hasMassSms, className }: Props) {
  const router = useRouter();
  const { shell, setShell } = useProductShell(hasMctb, hasMassSms);
  const showSwitcher = hasMctb && hasMassSms;
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!showSwitcher) return;
    try {
      const seen = window.localStorage.getItem(PRODUCT_SWITCHER_ONBOARDING_KEY);
      if (!seen) setShowOnboarding(true);
    } catch {
      // ignore
    }
  }, [showSwitcher]);

  if (!showSwitcher) return null;

  function dismissOnboarding() {
    setShowOnboarding(false);
    try {
      window.localStorage.setItem(PRODUCT_SWITCHER_ONBOARDING_KEY, "1");
    } catch {
      // ignore
    }
  }

  function selectShell(next: ProductShell) {
    setShell(next);
    const target = next === "mass_sms" ? massSmsShellHome() : mctbShellHome();
    router.push(target);
  }

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <div className="hidden items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:flex">
        <LayoutGrid className="h-3.5 w-3.5" />
        Switch product
      </div>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
        <ShellTab
          active={shell === "mass_sms"}
          shell="mass_sms"
          icon={Megaphone}
          label={productShellLabel("mass_sms")}
          shortLabel={productShellShortLabel("mass_sms")}
          onSelect={selectShell}
        />
        <ShellTab
          active={shell === "mctb"}
          shell="mctb"
          icon={PhoneMissed}
          label={productShellLabel("mctb")}
          shortLabel={productShellShortLabel("mctb")}
          onSelect={selectShell}
        />
      </div>

      {showOnboarding ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-primary/20 bg-card p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-foreground">You have 2 platforms</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Switch anytime between Mass SMS campaigns and your Missed Call Engine. Each tab
                shows that product&apos;s own menu.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={dismissOnboarding}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground"
          >
            Got it
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProductShellActiveLabel({
  shell,
  className,
}: {
  shell: ProductShell;
  className?: string;
}) {
  return (
    <p className={cn("text-[11px] text-muted-foreground", className)}>
      Currently active:{" "}
      <span className="font-semibold text-foreground">{productShellLabel(shell)}</span>
    </p>
  );
}
