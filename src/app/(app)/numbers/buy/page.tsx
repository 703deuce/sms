import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatCurrency, formatPhone } from "@/lib/utils";
import Link from "next/link";

const numberTabs = [
  { label: "My Numbers", href: "/numbers" },
  { label: "Buy", href: "/numbers/buy" },
  { label: "Port", href: "/numbers/port" },
  { label: "Sender Pools", href: "/numbers/pools" },
];

const searchResults = [
  {
    number: "+14155550201",
    type: "Local" as const,
    areaCode: "415",
    city: "San Francisco",
    state: "CA",
    sms: true,
    mms: true,
    monthlyCost: 1.15,
  },
  {
    number: "+14155550202",
    type: "Local" as const,
    areaCode: "415",
    city: "San Francisco",
    state: "CA",
    sms: true,
    mms: true,
    monthlyCost: 1.15,
  },
  {
    number: "+14155550203",
    type: "Local" as const,
    areaCode: "415",
    city: "Oakland",
    state: "CA",
    sms: true,
    mms: false,
    monthlyCost: 1.15,
  },
  {
    number: "+18005550204",
    type: "Toll-free" as const,
    areaCode: "800",
    city: "—",
    state: "—",
    sms: true,
    mms: true,
    monthlyCost: 2.15,
  },
];

export default function BuyNumberPage() {
  return (
    <div>
      <PageHeader
        title="Buy a number"
        description="Search available local and toll-free numbers by area code, region, and messaging capabilities."
        actions={
          <Link href="/numbers">
            <Button variant="outline">Back to numbers</Button>
          </Link>
        }
      />

      <Tabs items={numberTabs} />

      <Card className="mb-6">
        <CardTitle>Search filters</CardTitle>
        <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="areaCode">Area code</Label>
            <Input id="areaCode" name="areaCode" placeholder="415" defaultValue="415" />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" placeholder="San Francisco" defaultValue="San Francisco" />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Select id="state" name="state" defaultValue="CA">
              <option value="">Any state</option>
              <option value="CA">California</option>
              <option value="NY">New York</option>
              <option value="TX">Texas</option>
              <option value="FL">Florida</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="numberType">Number type</Label>
            <Select id="numberType" name="numberType" defaultValue="local">
              <option value="local">Local (10DLC)</option>
              <option value="tollfree">Toll-free</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="capabilities">Capabilities</Label>
            <Select id="capabilities" name="capabilities" defaultValue="sms-mms">
              <option value="sms">SMS only</option>
              <option value="sms-mms">SMS + MMS</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full">
              Search numbers
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Available numbers</CardTitle>
          <span className="text-xs text-muted-foreground">{searchResults.length} results</span>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Number</TH>
              <TH>Type</TH>
              <TH>Location</TH>
              <TH>SMS</TH>
              <TH>MMS</TH>
              <TH>Monthly</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {searchResults.map((result) => (
              <TR key={result.number}>
                <TD className="font-medium">{formatPhone(result.number)}</TD>
                <TD>{result.type}</TD>
                <TD className="text-muted-foreground">
                  {result.city !== "—" ? `${result.city}, ${result.state}` : "Nationwide"}
                </TD>
                <TD>{result.sms ? "Yes" : "—"}</TD>
                <TD>{result.mms ? "Yes" : "—"}</TD>
                <TD>{formatCurrency(result.monthlyCost)}</TD>
                <TD className="text-right">
                  <Button size="sm" variant="outline">
                    Purchase
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-4 text-xs text-muted-foreground">
          Local numbers require A2P brand and campaign registration before high-volume sending. Toll-free
          verification may apply separately.
        </p>
      </Card>
    </div>
  );
}
