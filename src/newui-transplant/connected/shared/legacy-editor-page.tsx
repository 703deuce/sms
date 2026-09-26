import type { ReactNode } from "react";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";

/** Wraps a production editor view in newui page chrome (Stage 2 boundary). */
export function NewUiLegacyEditorPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Page>
      <PageHeader title={title} description={description} />
      <div className="min-w-0">{children}</div>
    </Page>
  );
}
