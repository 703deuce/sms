"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Panel, Pill, Rows } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import { SimpleSelect } from "@/newui-transplant/components/app/simple-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/newui-transplant/components/ui/sheet";
import {
  useMctbNumberDrawerController,
  type MctbNumberDrawerMode,
} from "@/lib/mctb/numbers/mctb-number-drawer-controller";
import { VoiceProductSwitchDialog } from "@/components/solutions/appointment-receptionist/voice-product-switch-dialog";

export type { MctbNumberDrawerMode };

type Props = {
  open: MctbNumberDrawerMode;
  onClose: () => void;
  onOpenMode?: (mode: MctbNumberDrawerMode) => void;
  onNumbersChanged?: () => void;
};

export function MctbNumberDrawerOpus(props: Props) {
  const c = useMctbNumberDrawerController(props);
  const isOpen = Boolean(c.open);

  return (
    <Sheet open={isOpen} onOpenChange={(next) => !next && c.onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b pb-4 text-left">
          <SheetTitle>{c.title}</SheetTitle>
          <SheetDescription>{c.subtitle}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {c.error ? (
            <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
              {c.error}
            </p>
          ) : null}

          {c.loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-7 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : null}

          {c.open === "manage" && c.data && !c.loading ? (
            <>
              {c.active ? (
                <Panel className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground">Current number</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">{c.displayNumber(c.active.e164)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.active.friendlyName || "MCTB main line"} · Forwarding ingress and text-back sender
                  </p>
                  <Rows
                    className="mt-3"
                    items={[
                      { label: "Voice", value: c.voiceUiLabel(c.active) },
                      {
                        label: "Messaging",
                        value: (
                          <Pill tone={c.messagingUiLabel(c.active).tone === "ready" ? "success" : "warning"}>
                            {c.messagingUiLabel(c.active).label}
                          </Pill>
                        ),
                      },
                      { label: "Provider", value: c.active.provider || "—" },
                      c.tfv
                        ? {
                            label: "Verification",
                            value: (
                              <Pill tone={c.tfvTone(c.tfv.status, c.tfv.approved) === "ready" ? "success" : "neutral"}>
                                {c.tfv.approved ? "Verified" : c.tfv.statusLabel}
                              </Pill>
                            ),
                          }
                        : { label: "Verification", value: "—" },
                    ]}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => c.copyActiveNumber()}>
                      Copy
                    </Button>
                    {c.messagingUiLabel(c.active).tone !== "ready" ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => c.onOpenMode?.("verify")}>
                        Complete verification
                      </Button>
                    ) : null}
                  </div>
                </Panel>
              ) : (
                <p className="text-sm text-muted-foreground">No MCTB number yet.</p>
              )}

              {c.data.numbers.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">All numbers</p>
                  {c.data.numbers.slice(0, 5).map((n) => {
                    const msg = c.messagingUiLabel(n);
                    const selected = n.id === c.data!.activePhoneNumberId;
                    return (
                      <div
                        key={n.id}
                        className="flex items-center justify-between gap-3 border-b py-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{c.displayNumber(n.e164)}</p>
                          <p className="text-xs text-muted-foreground">
                            {n.friendlyName || c.formatNumberTypeLabel(n.type)} · Voice {c.voiceUiLabel(n)} · SMS{" "}
                            {msg.label}
                          </p>
                        </div>
                        {selected ? (
                          <span className="text-xs font-medium text-success">Selected</span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={c.busy}
                            onClick={() => void c.selectNumber(n.id)}
                          >
                            Use this number
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <Button type="button" className="mt-4 w-full" onClick={() => c.onOpenMode?.("add")}>
                Add another number
              </Button>
            </>
          ) : null}

          {c.open === "add" && !c.loading ? (
            <>
              {c.addStep === "choose" ? (
                <div className="space-y-2">
                  <Button type="button" className="w-full" disabled={c.busy} onClick={() => void c.provisionAuto()}>
                    Assign recommended MCTB number
                  </Button>
                  <Button type="button" variant="outline" className="w-full" onClick={() => c.setAddStep("search")}>
                    Search for a number
                  </Button>
                </div>
              ) : null}
              {c.addStep === "search" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mctb-drawer-area">Area code</Label>
                    <Input
                      id="mctb-drawer-area"
                      value={c.areaCode}
                      onChange={(e) => c.setAreaCode(e.target.value)}
                      placeholder="703"
                    />
                  </div>
                  <SimpleSelect
                    id="mctb-drawer-number-type"
                    label="Number type"
                    value={c.numberType}
                    onValueChange={(v) => c.setNumberType(v as "local" | "toll_free")}
                    options={[
                      { value: "toll_free", label: "Toll-free" },
                      { value: "local", label: "Local" },
                    ]}
                  />
                  <Button type="button" className="w-full" disabled={c.busy} onClick={() => void c.runSearch()}>
                    Search
                  </Button>
                  {c.searchResults.map((r) => (
                    <div key={r.e164} className="flex items-center justify-between gap-2 border-b py-2">
                      <div>
                        <p className="font-medium">{c.displayNumber(r.e164)}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.locality || "—"} · {c.formatNumberTypeLabel(c.numberType)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={c.busy}
                        onClick={() => void c.purchaseResult(r.e164)}
                      >
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
              {c.addStep === "provision" ? (
                <p className="text-sm text-muted-foreground">Getting your number…</p>
              ) : null}
            </>
          ) : null}

          {c.open === "verify" && !c.loading ? (
            <div className="space-y-4 text-sm">
              <section>
                <h3 className="font-medium">Business</h3>
                <p className="mt-1 text-muted-foreground">
                  Brand {c.complianceMeta?.brandStatus || "—"} · Campaign {c.complianceMeta?.campaignStatus || "—"}
                </p>
                <Link href="/compliance/business" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                  Edit business profile
                </Link>
              </section>
              <section>
                <h3 className="font-medium">Messaging use</h3>
                <p className="mt-1 text-muted-foreground">Customer care and missed-call recovery (MCTB).</p>
                {c.complianceActions.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                    {c.complianceActions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-success">Registration requirements look complete.</p>
                )}
                <Link href="/compliance/campaign" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                  Edit campaign & samples
                </Link>
              </section>
              <section>
                <h3 className="font-medium">Review</h3>
                <p className="mt-1 text-muted-foreground">
                  Number {c.active ? c.displayNumber(c.active.e164) : "—"}
                </p>
                {c.tfv && !c.tfv.approved ? (
                  <p className="mt-2 text-xs">
                    Status:{" "}
                    <Pill tone="neutral">{c.tfv.statusLabel}</Pill>
                  </p>
                ) : null}
                {c.tfv?.failureReason ? (
                  <p className="mt-2 text-xs text-destructive">{c.tfv.failureReason}</p>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        {c.open === "verify" ? (
          <SheetFooter className="border-t px-4 py-4">
            <Button
              type="button"
              className="w-full"
              disabled={c.busy || c.tfv?.approved}
              onClick={() => void c.submitVerification()}
            >
              {c.tfv?.approved ? "Verification complete" : "Submit verification"}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
      <VoiceProductSwitchDialog
        open={Boolean(c.voiceSwitchConflict)}
        conflict={c.voiceSwitchConflict}
        onCancel={c.cancelVoiceProductSwitch}
        onConfirm={() => void c.confirmVoiceProductSwitch()}
        busy={c.busy}
      />
    </Sheet>
  );
}
