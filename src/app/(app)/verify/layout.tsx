import { requireWorkspaceContext } from "@/lib/workspace-data";

export default async function VerifyLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceContext();
  return children;
}
