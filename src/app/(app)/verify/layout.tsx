import { redirect } from "next/navigation";
import { isVerifyLaunchEnabled } from "@/lib/products/v1-product-status";
import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function VerifyLayout({ children }: { children: React.ReactNode }) {
  if (!isVerifyLaunchEnabled()) {
    redirect("/dashboard");
  }
  await requireWorkspaceContext();
  return children;
}
