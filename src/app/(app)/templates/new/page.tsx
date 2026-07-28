import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { estimateSmsSegments } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const mergeFields = [
  "{{first_name}}",
  "{{last_name}}",
  "{{business_name}}",
  "{{appointment_date}}",
  "{{appointment_time}}",
  "{{phone}}",
];

const defaultBody =
  "Hi {{first_name}}, thanks for connecting with {{business_name}}! Reply HELP for help, STOP to opt out.";

export default function NewTemplatePage() {
  const segments = estimateSmsSegments(defaultBody);

  return (
    <div>
      <PageHeader
        title="Create template"
        description="Save a reusable message for campaigns, inbox replies, or automation steps."
        actions={
          <Link href="/templates">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardTitle>Template details</CardTitle>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="name">Template name</Label>
                <Input id="name" placeholder="e.g. Welcome SMS" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select id="category" defaultValue="Greetings">
                    <option>Greetings</option>
                    <option>Appointment reminders</option>
                    <option>Sales</option>
                    <option>Customer service</option>
                    <option>Promotions</option>
                    <option>Compliance</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="channel">Channel</Label>
                  <Select id="channel" defaultValue="SMS">
                    <option value="SMS">SMS</option>
                    <option value="MMS">MMS</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="type">Template type</Label>
                <Select id="type" defaultValue="Campaign">
                  <option>Campaign</option>
                  <option>Inbox reply</option>
                  <option>Automation message</option>
                  <option>Compliance message</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="body">Message body</Label>
                <Textarea id="body" defaultValue={defaultBody} rows={5} />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {segments.characters} characters · {segments.segments} segment
                  {segments.segments !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="shared"
                  defaultChecked
                  className="h-4 w-4 rounded border-border text-primary"
                />
                <Label htmlFor="shared" className="mb-0 cursor-pointer">
                  Share with team members
                </Label>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Merge fields</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Click to copy. Fields are replaced with contact data at send time.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {mergeFields.map((field) => (
                <button
                  key={field}
                  type="button"
                  className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 font-mono text-xs transition hover:border-primary hover:bg-primary/5"
                >
                  {field}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle>Preview</CardTitle>
          <div className="mt-4">
            <div className="rounded-2xl rounded-bl-sm bg-primary/10 px-4 py-3 text-sm leading-relaxed">
              {defaultBody.replace("{{first_name}}", "Maya").replace(
                "{{business_name}}",
                "Harbor Home",
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Preview uses sample data. Compliance footer is added automatically for marketing
              messages.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <Button>Save template</Button>
            <Button variant="outline">Save and create another</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
