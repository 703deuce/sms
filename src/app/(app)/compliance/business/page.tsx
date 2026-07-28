import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { complianceOverview } from "@/lib/mock/data";
import Link from "next/link";

const complianceTabs = [
  { label: "Overview", href: "/compliance" },
  { label: "Business", href: "/compliance/business" },
  { label: "Brand", href: "/compliance/brand" },
  { label: "Campaign", href: "/compliance/campaign" },
  { label: "Readiness", href: "/compliance/check" },
  { label: "Consent", href: "/compliance/consent" },
  { label: "Suppression", href: "/compliance/suppression" },
  { label: "Events", href: "/compliance/events" },
];

export default function ComplianceBusinessPage() {
  return (
    <div>
      <PageHeader
        title="Business profile"
        description="Legal entity information required for A2P brand registration and carrier verification."
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={complianceOverview.customerProfile} />
            <Button>Save profile</Button>
          </div>
        }
      />

      <Tabs items={complianceTabs} />

      <Card>
        <CardTitle>Company information</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="legalName">Legal business name</Label>
            <Input id="legalName" defaultValue="Harbor Home Services LLC" />
          </div>
          <div>
            <Label htmlFor="dba">DBA / trade name</Label>
            <Input id="dba" defaultValue="Harbor Home" />
          </div>
          <div>
            <Label htmlFor="ein">EIN / tax ID</Label>
            <Input id="ein" defaultValue="12-3456789" />
          </div>
          <div>
            <Label htmlFor="entityType">Entity type</Label>
            <Select id="entityType" defaultValue="llc">
              <option value="llc">LLC</option>
              <option value="corp">Corporation</option>
              <option value="sole">Sole proprietorship</option>
              <option value="nonprofit">Non-profit</option>
              <option value="partnership">Partnership</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="industry">Industry</Label>
            <Select id="industry" defaultValue="home-services">
              <option value="home-services">Home services</option>
              <option value="retail">Retail</option>
              <option value="healthcare">Healthcare</option>
              <option value="finance">Financial services</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input id="website" defaultValue="https://harborhome.co" />
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle>Business address</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="street">Street address</Label>
            <Input id="street" defaultValue="1200 Bay Street, Suite 400" />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" defaultValue="San Francisco" />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Select id="state" defaultValue="CA">
              <option value="CA">California</option>
              <option value="NY">New York</option>
              <option value="TX">Texas</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="zip">ZIP code</Label>
            <Input id="zip" defaultValue="94109" />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Select id="country" defaultValue="US">
              <option value="US">United States</option>
            </Select>
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle>Primary contacts</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactName">Authorized representative</Label>
            <Input id="contactName" defaultValue="Alex Rivera" />
          </div>
          <div>
            <Label htmlFor="contactEmail">Email</Label>
            <Input id="contactEmail" type="email" defaultValue="alex@harborhome.co" />
          </div>
          <div>
            <Label htmlFor="contactPhone">Phone</Label>
            <Input id="contactPhone" defaultValue="+1 (415) 555-0142" />
          </div>
          <div>
            <Label htmlFor="contactTitle">Title</Label>
            <Input id="contactTitle" defaultValue="Owner" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="supportEmail">Support email (public-facing)</Label>
            <Input id="supportEmail" type="email" defaultValue="support@harborhome.co" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="businessDescription">Business description</Label>
            <Textarea
              id="businessDescription"
              defaultValue="Harbor Home provides residential HVAC, plumbing, and maintenance services in the San Francisco Bay Area."
              rows={3}
            />
          </div>
        </form>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        This information must match your EIN records and website. Changes may require re-verification.{" "}
        <Link href="/settings/business" className="text-primary hover:underline">
          Account business settings
        </Link>
      </p>
    </div>
  );
}
