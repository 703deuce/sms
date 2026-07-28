import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import Link from "next/link";

const numberTabs = [
  { label: "My Numbers", href: "/numbers" },
  { label: "Buy", href: "/numbers/buy" },
  { label: "Port", href: "/numbers/port" },
  { label: "Sender Pools", href: "/numbers/pools" },
];

export default function PortNumberPage() {
  return (
    <div>
      <PageHeader
        title="Port a number"
        description="Submit a port request to move an existing business number to Transovo SMS."
        actions={
          <Link href="/numbers">
            <Button variant="outline">Back to numbers</Button>
          </Link>
        }
      />

      <Tabs items={numberTabs} />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle>Port request</CardTitle>
          <form className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="phoneNumber">Phone number to port</Label>
                <Input id="phoneNumber" name="phoneNumber" placeholder="+1 (555) 555-0100" />
              </div>
              <div>
                <Label htmlFor="numberType">Number type</Label>
                <Select id="numberType" name="numberType" defaultValue="local">
                  <option value="local">Local</option>
                  <option value="tollfree">Toll-free</option>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="currentCarrier">Current carrier</Label>
                <Input id="currentCarrier" name="currentCarrier" placeholder="e.g. Verizon Business" />
              </div>
              <div>
                <Label htmlFor="accountNumber">Account number</Label>
                <Input id="accountNumber" name="accountNumber" placeholder="Carrier account ID" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="accountPin">Account PIN / passcode</Label>
                <Input id="accountPin" name="accountPin" type="password" placeholder="If required by carrier" />
              </div>
              <div>
                <Label htmlFor="billingPhone">Billing telephone number</Label>
                <Input id="billingPhone" name="billingPhone" placeholder="On file with current carrier" />
              </div>
            </div>

            <div>
              <Label htmlFor="businessName">Business name on account</Label>
              <Input id="businessName" name="businessName" defaultValue="Harbor Home Services" />
            </div>

            <div>
              <Label htmlFor="serviceAddress">Service address</Label>
              <Textarea
                id="serviceAddress"
                name="serviceAddress"
                placeholder="Street, city, state, ZIP — must match carrier records"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="authorizedName">Authorized signatory</Label>
              <Input id="authorizedName" name="authorizedName" defaultValue="Alex Rivera" />
            </div>

            <div>
              <Label htmlFor="notes">Additional notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Multiple numbers, partial ports, or special routing instructions"
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button">Submit port request</Button>
              <Button type="button" variant="outline">
                Save draft
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>What to expect</CardTitle>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Typical port time: 5–10 business days</li>
              <li>Keep service active with your current carrier until port completes</li>
              <li>Letter of Authorization (LOA) may be required for verification</li>
              <li>SMS capability is enabled after A2P registration is approved</li>
            </ul>
          </Card>
          <Card>
            <CardTitle>Required documents</CardTitle>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Signed LOA (generated after submission)</li>
              <li>Recent carrier bill or CSR</li>
              <li>Proof of business ownership for toll-free ports</li>
            </ul>
            <Link href="/compliance/business" className="mt-4 inline-flex text-sm font-medium text-primary hover:underline">
              Update business profile
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
