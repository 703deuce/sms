import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { complianceOverview } from "@/lib/mock/data";

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

export default function ComplianceCampaignPage() {
  return (
    <div>
      <PageHeader
        title="Campaign registration"
        description="Register your A2P 10DLC campaign use case, sample messages, and opt-in workflow with carriers."
        actions={
          <div className="flex items-center gap-2">
            <StatusChip status={complianceOverview.campaign} />
            <Button>Submit campaign</Button>
          </div>
        }
      />

      <Tabs items={complianceTabs} />

      <Card>
        <CardTitle>Campaign identity</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="campaignName">Campaign name</Label>
            <Input id="campaignName" defaultValue="Harbor Home Customer Care" />
          </div>
          <div>
            <Label htmlFor="useCase">Use case</Label>
            <Select id="useCase" defaultValue="customer-care">
              <option value="customer-care">Customer care</option>
              <option value="marketing">Marketing</option>
              <option value="mixed">Mixed</option>
              <option value="account-notifications">Account notifications</option>
              <option value="delivery-notifications">Delivery notifications</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="campaignDescription">Campaign description</Label>
            <Textarea
              id="campaignDescription"
              defaultValue="Transactional and promotional messages for existing customers and opted-in leads regarding appointments, service updates, and seasonal offers."
              rows={3}
            />
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle>Sample messages</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Provide 2–5 representative messages that reflect actual content you will send.
        </p>
        <form className="mt-4 space-y-4">
          <div>
            <Label htmlFor="sample1">Sample message 1</Label>
            <Textarea
              id="sample1"
              defaultValue="Harbor Home: Book your July tune-up and save 15%. Reply YES to schedule. Msg&data rates may apply. STOP to opt out."
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="sample2">Sample message 2</Label>
            <Textarea
              id="sample2"
              defaultValue="Hi {{first_name}}, reminder: your appointment is tomorrow at {{appointment_time}}. Reply C to confirm."
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="sample3">Sample message 3</Label>
            <Textarea id="sample3" placeholder="Additional sample message" rows={2} />
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle>Opt-in &amp; message flow</CardTitle>
        <form className="mt-4 space-y-4">
          <div>
            <Label htmlFor="messageFlow">Message flow / opt-in description</Label>
            <Textarea
              id="messageFlow"
              defaultValue="Users opt in via website form at harborhome.co/sms with checkbox consent, keyword JOIN to +1 (415) 555-0142, or event QR signup. Confirmation message sent immediately."
              rows={4}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="optInKeywords">Opt-in keywords</Label>
              <Input id="optInKeywords" defaultValue="JOIN, START, YES" />
            </div>
            <div>
              <Label htmlFor="optOutKeywords">Opt-out keywords</Label>
              <Input id="optOutKeywords" defaultValue="STOP, END, CANCEL, UNSUBSCRIBE" />
            </div>
          </div>
          <div>
            <Label htmlFor="optInFormUrl">Opt-in form URL</Label>
            <Input id="optInFormUrl" defaultValue="https://forms.transovo.com/harbor-optin" />
          </div>
          <div>
            <Label htmlFor="helpMessage">Help message response</Label>
            <Textarea
              id="helpMessage"
              defaultValue="Harbor Home SMS: Reply STOP to unsubscribe. Msg&data rates may apply. Help: support@harborhome.co or (415) 555-0142."
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="optOutMessage">Opt-out confirmation message</Label>
            <Textarea
              id="optOutMessage"
              defaultValue="You have been unsubscribed from Harbor Home messages. You will receive no further texts."
              rows={2}
            />
          </div>
        </form>
      </Card>

      <Card className="mt-4">
        <CardTitle>Campaign attributes</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="subscriberOptIn">Subscriber opt-in</Label>
            <Select id="subscriberOptIn" defaultValue="yes">
              <option value="yes">Yes — explicit consent required</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="subscriberOptOut">Subscriber opt-out</Label>
            <Select id="subscriberOptOut" defaultValue="yes">
              <option value="yes">Yes — STOP supported</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="embeddedLinks">Embedded links</Label>
            <Select id="embeddedLinks" defaultValue="yes">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="embeddedPhone">Embedded phone numbers</Label>
            <Select id="embeddedPhone" defaultValue="no">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ageGated">Age-gated content</Label>
            <Select id="ageGated" defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="directLending">Direct lending</Label>
            <Select id="directLending" defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="affiliateMarketing">Affiliate marketing</Label>
            <Select id="affiliateMarketing" defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="numberPool">Number pool size</Label>
            <Input id="numberPool" type="number" defaultValue="2" min={1} />
          </div>
          <div>
            <Label htmlFor="dailyVolume">Estimated daily volume</Label>
            <Input id="dailyVolume" defaultValue="500 messages" />
          </div>
        </form>
      </Card>
    </div>
  );
}
