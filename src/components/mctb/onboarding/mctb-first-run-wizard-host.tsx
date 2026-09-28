"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MctbOnboardingRuntime } from "@/lib/mctb/onboarding/mctb-onboarding-runtime";
import type { MctbFirstRunWizardPolicy } from "@/lib/mctb/onboarding/first-run-policy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";

export const MCTB_SETUP_GUIDE_QUERY = "mctbSetupGuide";

type PolicyResponse = {
  firstRun?: MctbFirstRunWizardPolicy;
};

export function MctbFirstRunWizardHost() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setupGuide = searchParams.get(MCTB_SETUP_GUIDE_QUERY) === "1";
  const onMctbSurface = pathname?.startsWith("/mctb") ?? false;

  const [policy, setPolicy] = useState<MctbFirstRunWizardPolicy | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissedThisVisit, setDismissedThisVisit] = useState(false);

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
    setDismissedThisVisit(false);
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
    if (dismissedThisVisit && policy.trigger !== "setup_guide" && !policy.everyLoginTesting) {
      setOpen(false);
      return;
    }
    if (policy.shouldAutoOpen) setOpen(true);
  }, [onMctbSurface, policy, dismissedThisVisit, setupGuide]);

  const title = useMemo(() => {
    if (policy?.trigger === "setup_guide") return "Setup guide";
    return "Set up Missed Call Text Back";
  }, [policy?.trigger]);

  if (!onMctbSurface) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDismissedThisVisit(true);
      }}
    >
      <DialogContent
        className="flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={true}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Guided MCTB configuration using your live workspace settings.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MctbOnboardingRuntime
            shell="opus"
            presentation="modal"
            onFinished={() => {
              setOpen(false);
              setDismissedThisVisit(true);
              void loadPolicy(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Imperative opener for Setup overview actions. */
export function openMctbSetupGuide(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(MCTB_SETUP_GUIDE_QUERY, "1");
  window.history.pushState({}, "", url.toString());
  window.dispatchEvent(new Event("mctb:setup-guide-request"));
}
