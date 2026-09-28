"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MctbOnboardingRuntime } from "@/lib/mctb/onboarding/mctb-onboarding-runtime";
import type { MctbFirstRunWizardPolicy } from "@/lib/mctb/onboarding/first-run-policy";
import { MCTB_SETUP_GUIDE_QUERY } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";

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

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const title = useMemo(() => {
    if (policy?.trigger === "setup_guide") return "Setup guide";
    return "Set up Missed Call Text Back";
  }, [policy?.trigger]);

  if (!onMctbSurface) return null;

  const mandatoryFirstRun =
    Boolean(policy?.shouldAutoOpen) && policy?.trigger === "incomplete_onboarding";
  const dismissible =
    policy?.trigger === "setup_guide" || Boolean(policy?.everyLoginTesting);

  return (
    <Dialog
      open={open}
      modal
      disablePointerDismissal={mandatoryFirstRun || !dismissible}
      onOpenChange={(next) => {
        if (!next && mandatoryFirstRun) return;
        if (!next && !dismissible) return;
        setOpen(next);
        if (!next) setDismissedThisVisit(true);
      }}
    >
      <DialogContent
        className="flex h-[min(760px,calc(100vh-64px))] w-[min(760px,calc(100vw-48px))] max-w-none flex-col overflow-hidden gap-0 p-0 sm:max-w-none max-sm:fixed max-sm:inset-0 max-sm:top-0 max-sm:left-0 max-sm:h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-none max-sm:rounded-none"
        overlayClassName="bg-black/40 supports-backdrop-filter:backdrop-blur-[2px]"
        showCloseButton={dismissible}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Guided MCTB configuration using your live workspace settings.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden">
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
