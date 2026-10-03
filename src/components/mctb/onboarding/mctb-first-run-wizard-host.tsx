"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MctbOnboardingRuntime } from "@/lib/mctb/onboarding/mctb-onboarding-runtime";
import {
  isMctbDedicatedSetupPath,
  shouldShowMctbFirstRunWizardModal,
  type MctbFirstRunWizardPolicy,
} from "@/lib/mctb/onboarding/first-run-policy";
import { MCTB_SETUP_GUIDE_QUERY } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";

const MCTB_FIRST_RUN_DISMISSED_SESSION_KEY = "mctb-first-run-wizard-dismissed";

type PolicyResponse = {
  firstRun?: MctbFirstRunWizardPolicy;
};

function readFirstRunDismissedFromSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(MCTB_FIRST_RUN_DISMISSED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function persistFirstRunDismissedToSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(MCTB_FIRST_RUN_DISMISSED_SESSION_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function MctbFirstRunWizardHost() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupGuide = searchParams.get(MCTB_SETUP_GUIDE_QUERY) === "1";
  const onMctbSurface = pathname?.startsWith("/mctb") ?? false;

  const [policy, setPolicy] = useState<MctbFirstRunWizardPolicy | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissedThisVisit, setDismissedThisVisit] = useState(() =>
    readFirstRunDismissedFromSession(),
  );

  const clearSetupGuideParam = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has(MCTB_SETUP_GUIDE_QUERY)) return;
    url.searchParams.delete(MCTB_SETUP_GUIDE_QUERY);
    const next = `${url.pathname}${url.search}${url.hash}`;
    router.replace(next, { scroll: false });
  }, [router]);

  const loadPolicy = useCallback(async (guide: boolean) => {
    const url = guide
      ? `/api/mctb/onboarding?${MCTB_SETUP_GUIDE_QUERY}=1`
      : "/api/mctb/onboarding";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as PolicyResponse;
    if (json.firstRun) setPolicy(json.firstRun);
  }, []);

  useEffect(() => {
    if (!onMctbSurface) return;
    if (!setupGuide) {
      setDismissedThisVisit(readFirstRunDismissedFromSession());
    }
    void loadPolicy(setupGuide);
  }, [onMctbSurface, setupGuide, loadPolicy]);

  useEffect(() => {
    const onGuide = () => {
      void loadPolicy(true);
      setOpen(true);
    };
    window.addEventListener("mctb:setup-guide-request", onGuide);
    return () => window.removeEventListener("mctb:setup-guide-request", onGuide);
  }, [loadPolicy]);

  useEffect(() => {
    if (!onMctbSurface || !policy) return;
    if (
      isMctbDedicatedSetupPath(pathname) &&
      policy.trigger === "incomplete_onboarding" &&
      !setupGuide
    ) {
      setOpen(false);
      return;
    }
    if (dismissedThisVisit && !policy.everyLoginTesting) {
      if (setupGuide) {
        // User opened setup guide intentionally (?setup_guide=1).
      } else if (policy.trigger === "incomplete_onboarding") {
        // Mandatory first-run — keep open until onboarding completes.
      } else {
        setOpen(false);
        return;
      }
    }
    if (shouldShowMctbFirstRunWizardModal(policy, pathname, setupGuide)) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [onMctbSurface, policy, dismissedThisVisit, setupGuide, pathname]);

  const title = useMemo(() => {
    if (policy?.trigger === "setup_guide") return "Setup guide";
    return "Set up Missed Call Text Back";
  }, [policy?.trigger]);

  if (!onMctbSurface) return null;

  return (
    <Dialog
      open={open}
      modal
      disablePointerDismissal={false}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setDismissedThisVisit(true);
          persistFirstRunDismissedToSession();
          clearSetupGuideParam();
        }
      }}
    >
      <DialogContent
        className="flex h-[min(760px,calc(100vh-64px))] w-[min(760px,calc(100vw-48px))] max-w-none flex-col overflow-hidden gap-0 border-0 bg-card p-0 text-card-foreground shadow-xl sm:max-w-none max-sm:fixed max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-none max-sm:rounded-none"
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-[2px]"
        showCloseButton
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Guided MCTB configuration using your live workspace settings.</DialogDescription>
        </DialogHeader>
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <MctbOnboardingRuntime
            shell="opus"
            presentation="modal"
            onFinished={() => {
              setOpen(false);
              setDismissedThisVisit(true);
              persistFirstRunDismissedToSession();
              clearSetupGuideParam();
              void loadPolicy(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
