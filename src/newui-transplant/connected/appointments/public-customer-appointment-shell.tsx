"use client";

import { Panel } from "@/newui-transplant/components/app/kit";

export function PublicCustomerAppointmentShell({
  businessName,
  children,
}: {
  businessName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-muted/40 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        {businessName ? (
          <p className="mb-3 text-center text-sm text-muted-foreground">{businessName}</p>
        ) : null}
        <Panel className="p-6 shadow-sm">{children}</Panel>
      </div>
    </div>
  );
}
