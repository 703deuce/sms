"use client";

import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";
import { Button } from "@/newui-transplant/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/newui-transplant/components/ui/dropdown-menu";
import { Pill } from "@/newui-transplant/components/app/kit";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { performClientLogout } from "@/lib/auth/logout-client";

function ingressStatus(state: string | undefined) {
  if (state === "provisioning") return { label: "Provisioning", tone: "warning" as const };
  if (state === "ready") return { label: "Ready", tone: "success" as const };
  return { label: "Not configured", tone: "neutral" as const };
}

export function MctbHeaderIdentity() {
  const { business, workspaceName, loading, planUsage } = useOpusWorkspaceData();
  const name = business?.name || workspaceName || "Workspace";
  const line = business?.line && business.line !== "—" ? business.line : null;
  const ingress = ingressStatus(business?.forwardingLineState);
  const senderLabel = business?.sender || "Transovo Platform";

  if (loading) {
    return (
      <div className="hidden min-w-0 max-w-[220px] animate-pulse rounded-md bg-muted/60 px-2 py-1.5 sm:block md:max-w-xs">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="mt-1 h-3 w-16 rounded bg-muted" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="hidden h-auto max-w-[min(100%,14rem)] min-w-0 flex-col items-start gap-0 px-2 py-1 text-left sm:inline-flex md:max-w-xs"
          >
            <span className="flex w-full min-w-0 items-center gap-1">
              <span className="truncate text-xs font-medium text-foreground">{name}</span>
              <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {line ?? "Business line not set"}
            </span>
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {name}
        </DropdownMenuLabel>
        <div className="px-2 py-1.5 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Business line</p>
          <p className="font-medium">{line ?? "Not set"}</p>
          <span className="mt-1 inline-block">
            <Pill tone={line ? "success" : "neutral"} dot={false}>
              {line ? "Active" : "Needs setup"}
            </Pill>
          </span>
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Transovo forwarding
          </p>
          <p className="font-medium">{business?.forwardingLine ?? "—"}</p>
          <span className="mt-1 inline-block">
            <Pill tone={ingress.tone} dot={false}>{ingress.label}</Pill>
          </span>
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Text-back sender</p>
          <p className="font-medium">{senderLabel}</p>
          <span className="mt-1 inline-block">
            <Pill tone="success" dot={false}>Active</Pill>
          </span>
        </div>
        {planUsage ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Plan &amp; usage</p>
              <p className="font-medium">{planUsage.planLabel}</p>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{planUsage.usageShortLabel}</p>
              <span className="mt-1 inline-block">
                <Pill tone={planUsage.atLimit ? "warning" : "success"} dot={false}>
                  {planUsage.atLimit ? "Monthly limit reached" : "Recoveries this month"}
                </Pill>
              </span>
            </div>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings/billing">Billing &amp; plans →</Link>} />
        <DropdownMenuItem render={<Link href={MCTB_ROUTES.phone}>Phone &amp; Forwarding settings →</Link>} />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void performClientLogout("/login");
          }}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
