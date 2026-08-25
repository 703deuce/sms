import { FaxSubnav } from "@/components/fax/fax-subnav";
import { SendFaxForm } from "@/components/fax/send-fax-form";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getPrimaryFaxNumber } from "@/lib/fax/fax-number-provisioning";

export default async function FaxSendPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const number = await getPrimaryFaxNumber(workspaceId);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Send Fax</h1>
      <p className="mt-1 text-sm text-muted-foreground">Upload a PDF and send it to any fax number.</p>
      <div className="mt-6">
        <FaxSubnav />
      </div>
      <div className="mt-6">
        <SendFaxForm fromNumber={number?.e164} />
      </div>
    </div>
  );
}
