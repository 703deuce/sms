"use client";

import {
  aiAfterHoursShellHome,
  defaultProductShell,
  mctbShellHome,
  massSmsShellHome,
  productShellLabel,
  PRODUCT_SWITCHER_ONBOARDING_KEY,
  readStoredProductShell,
  resolveProductShellFromPath,
  shellHomePath,
  writeStoredProductShell,
  type ProductShell,
} from "@/lib/products/product-shell";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  LayoutGrid,
  Megaphone,
  Moon,
  PhoneMissed,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  hasMctb: boolean;
  hasMassSms: boolean;
  hasAiAfterHours: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
};

export function useProductShell(
  hasMctb: boolean,
  hasMassSms: boolean,
  hasAiAfterHours: boolean,
) {
  const pathname = usePathname();
  const fromPath = useMemo(() => resolveProductShellFromPath(pathname), [pathname]);
  const [shell, setShellState] = useState<ProductShell>(() =>
    defaultProductShell({ hasMctb, hasMassSms, hasAiAfterHours }),
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
    setShellState(defaultProductShell({ hasMctb, hasMassSms, hasAiAfterHours }));
  }, [fromPath, hasMctb, hasMassSms, hasAiAfterHours]);

  const setShell = (next: ProductShell) => {
    writeStoredProductShell(next);
    setShellState(next);
  };

  return { shell: fromPath ?? shell, setShell };
}

const SHELL_OPTIONS: {
  shell: ProductShell;
  icon: typeof Megaphone;
  description: string;
  visible: (input: { hasMctb: boolean; hasMassSms: boolean; hasAiAfterHours: boolean }) => boolean;
}[] = [
  {
    shell: "mass_sms",
    icon: Megaphone,
    description: "Campaigns, conversations, contacts, and playbooks",
    visible: (input) => input.hasMassSms,
  },
  {
    shell: "mctb",
    icon: PhoneMissed,
    description: "Missed calls, voicemail, consent, and text-back setup",
    visible: (input) => input.hasMctb,
  },
  {
    shell: "ai_after_hours",
    icon: Moon,
    description: "After-hours AI agent, calls, knowledge, and call handling",
    visible: (input) => input.hasAiAfterHours,
  },
];

export function ProductShellSwitcher({
  hasMctb,
  hasMassSms,
  hasAiAfterHours,
  collapsed = false,
  onNavigate,
  className,
}: Props) {
  const router = useRouter();
  const entitlement = { hasMctb, hasMassSms, hasAiAfterHours };
  const { shell, setShell } = useProductShell(hasMctb, hasMassSms, hasAiAfterHours);
  const showSwitcher =
    [hasMctb, hasMassSms, hasAiAfterHours].filter(Boolean).length >= 2;
  const [open, setOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const visibleOptions = SHELL_OPTIONS.filter((option) => option.visible(entitlement));

  useEffect(() => {
    if (!showSwitcher) return;
    try {
      const seen = window.localStorage.getItem(PRODUCT_SWITCHER_ONBOARDING_KEY);
      if (!seen) setShowOnboarding(true);
    } catch {
      // ignore
    }
  }, [showSwitcher]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

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
    if (next === shell) {
      setOpen(false);
      return;
    }
    setShell(next);
    setOpen(false);
    onNavigate?.();
    router.push(shellHomePath(next));
  }

  return (
    <div ref={rootRef} className={cn("relative shrink-0 px-2 pb-2", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-2 rounded-[10px] border border-[#e6e8ef] bg-[#f8f9fc] text-left transition hover:border-primary/30 hover:bg-[#f3f4ff]",
          collapsed ? "justify-center px-2 py-2" : "px-2.5 py-2",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={collapsed ? "Switch product" : undefined}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <LayoutGrid className="h-4 w-4" />
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                Switch product
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-semibold text-[#111827]">
                {productShellLabel(shell)}
              </span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-sidebar-muted transition", open && "rotate-180")}
            />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Switch product"
          className={cn(
            "absolute z-50 overflow-hidden rounded-xl border border-border bg-card shadow-lg",
            collapsed ? "left-full top-0 ml-2 w-[min(280px,calc(100vw-4rem))]" : "left-2 right-2 top-[calc(100%+6px)]",
          )}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Choose product
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Currently active:{" "}
              <span className="font-semibold text-foreground">{productShellLabel(shell)}</span>
            </p>
          </div>
          <div className="p-1.5">
            {visibleOptions.map(({ shell: optionShell, icon: Icon, description }) => {
              const active = shell === optionShell;
              return (
                <button
                  key={optionShell}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => selectShell(optionShell)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                    active ? "bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-foreground">
                        {productShellLabel(optionShell)}
                      </span>
                      {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showOnboarding && !collapsed ? (
        <div className="absolute left-2 right-2 top-[calc(100%+10px)] z-50 rounded-xl border border-primary/20 bg-card p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Multiple products</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Use Switch product to move between SMS, Missed Call Text Back, and AI After Hours.
                Each product shows its own menu in the same workspace.
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

/** @deprecated Use ProductShellSwitcher in the sidebar instead. */
export function ProductShellTabs(props: Props) {
  return (
    <ProductShellSwitcher
      hasMctb={props.hasMctb}
      hasMassSms={props.hasMassSms}
      hasAiAfterHours={props.hasAiAfterHours}
      collapsed={props.collapsed}
      onNavigate={props.onNavigate}
      className={props.className}
    />
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

// Re-export home helpers for legacy imports
export { massSmsShellHome, mctbShellHome, aiAfterHoursShellHome };
