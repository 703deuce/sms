"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { numberTabs } from "@/lib/number-tabs";
import { formatCurrency, formatPhone } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "DC", name: "Washington, D.C." },
];

type SearchRow = {
  number: string;
  type: "Local" | "Toll-free";
  areaCode: string;
  city: string;
  state: string;
  sms: boolean;
  mms: boolean;
  monthlyCost: number;
  upstreamProvider: "telnyx" | "twilio";
};

function mapResult(result: {
  phoneNumber: string;
  locality?: string;
  region?: string;
  capabilities?: { sms?: boolean; mms?: boolean };
  upstreamProvider?: "telnyx" | "twilio";
}): SearchRow {
  const digits = result.phoneNumber.replace(/\D/g, "");
  const areaCode = digits.length >= 4 ? digits.slice(1, 4) : "";
  const isTollFree = ["800", "888", "877", "866", "855", "844", "833"].includes(areaCode);
  return {
    number: result.phoneNumber,
    type: isTollFree ? "Toll-free" : "Local",
    areaCode,
    city: result.locality || "—",
    state: result.region || "—",
    sms: Boolean(result.capabilities?.sms),
    mms: Boolean(result.capabilities?.mms),
    monthlyCost: isTollFree ? 2.15 : 1.15,
    upstreamProvider: result.upstreamProvider ?? "telnyx",
  };
}

type Props = {
  workspaceId: string;
};

export function BuyNumberPageClient({ workspaceId }: Props) {
  const router = useRouter();
  const [areaCode, setAreaCode] = useState("415");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [capabilities, setCapabilities] = useState("sms-mms");
  const [numberType, setNumberType] = useState("local");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState("");

  async function searchNumbers(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError("");
    setPurchaseError("");
    try {
      const params = new URLSearchParams({
        workspaceId,
        areaCode: areaCode.trim(),
      });
      if (city.trim()) params.set("city", city.trim());
      if (state) params.set("state", state);
      if (capabilities === "sms-mms") params.set("mms", "1");
      const res = await fetch(`/api/messaging/numbers?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      let rows = (json.data || []).map(mapResult);
      if (numberType === "tollfree") {
        rows = rows.filter((r: SearchRow) => r.type === "Toll-free");
      } else if (numberType === "local") {
        rows = rows.filter((r: SearchRow) => r.type === "Local");
      }
      setResults(rows);
      setSearched(true);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  async function purchaseNumber(e164: string) {
    setPurchasing(e164);
    setPurchaseError("");
    const row = results.find((r) => r.number === e164);
    try {
      const res = await fetch("/api/messaging/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase_number",
          workspaceId,
          phoneNumber: e164,
          upstreamProvider: row?.upstreamProvider,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Purchase failed");
      router.push("/numbers");
      router.refresh();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(null);
    }
  }

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
        <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={searchNumbers}>
          <div>
            <Label htmlFor="areaCode">Area code</Label>
            <Input
              id="areaCode"
              name="areaCode"
              placeholder="415"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              name="city"
              placeholder="San Francisco"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Select
              id="state"
              name="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="">Any state</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="numberType">Number type</Label>
            <Select
              id="numberType"
              name="numberType"
              value={numberType}
              onChange={(e) => setNumberType(e.target.value)}
            >
              <option value="local">Local (10DLC)</option>
              <option value="tollfree">Toll-free</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="capabilities">Capabilities</Label>
            <Select
              id="capabilities"
              name="capabilities"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
            >
              <option value="sms">SMS only</option>
              <option value="sms-mms">SMS + MMS</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={searching}>
              {searching ? "Searching…" : "Search numbers"}
            </Button>
          </div>
        </form>
        {searchError ? <p className="mt-3 text-sm text-rose-600">{searchError}</p> : null}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Available numbers</CardTitle>
          <span className="text-xs text-muted-foreground">
            {searched ? `${results.length} results` : "Search to see results"}
          </span>
        </div>

        {purchaseError ? <p className="mb-4 text-sm text-rose-600">{purchaseError}</p> : null}

        {searched && results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No numbers found for this search. Try a different area code.
          </p>
        ) : null}

        {results.length > 0 ? (
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
              {results.map((result) => (
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
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={purchasing !== null}
                      onClick={() => purchaseNumber(result.number)}
                    >
                      {purchasing === result.number ? "Purchasing…" : "Purchase"}
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        ) : !searched ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Enter an area code and search to browse available numbers.
          </p>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground">
          Local numbers require A2P brand and campaign registration before high-volume sending. Toll-free
          verification may apply separately.
        </p>
      </Card>
    </div>
  );
}
