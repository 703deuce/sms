"use client";

import { Field, TextInput, TextArea, SelectInput } from "./ui";
import { timezones } from "../types";

export default function BusinessProfileCard(props: {
  workspaceName: string;
  setWorkspaceName: (v: string) => void;
  supportEmail: string;
  setSupportEmail: (v: string) => void;
  businessPhone: string;
  setBusinessPhone: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Business profile</h2>
          <p className="card-sub">
            This information appears on booking pages, appointment confirmations, and reminders.
          </p>
        </div>
      </div>

      <div className="card-body form-grid">
        <Field label="Business name" hint="Shown to customers on booking pages and in message signatures.">
          <TextInput
            name="accountName"
            value={props.workspaceName}
            onChange={(e) => props.setWorkspaceName(e.target.value)}
            autoComplete="organization"
            required
          />
        </Field>

        <div className="form-row-2">
          <Field label="Support email" hint="Used for customer replies and compliance contact.">
            <TextInput
              name="supportEmail"
              type="email"
              value={props.supportEmail}
              onChange={(e) => props.setSupportEmail(e.target.value)}
              autoComplete="email"
              placeholder="name@example.com"
            />
          </Field>
          <Field label="Business phone" optional>
            <TextInput
              name="businessPhone"
              type="tel"
              value={props.businessPhone}
              onChange={(e) => props.setBusinessPhone(e.target.value)}
              autoComplete="tel"
              placeholder="(555) 555-0100"
            />
          </Field>
        </div>

        <Field
          label="Business address"
          hint="Street on the first line; city, state, and ZIP on the second line."
        >
          <TextArea
            name="address"
            rows={2}
            value={props.address}
            onChange={(e) => props.setAddress(e.target.value)}
            autoComplete="street-address"
          />
        </Field>

        <div className="form-row-2">
          <Field label="Website" optional>
            <TextInput
              name="websiteUrl"
              type="url"
              value={props.websiteUrl}
              onChange={(e) => props.setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </Field>
          <Field
            label="Timezone"
            hint="Used for business hours, reminders, and reports."
          >
            <SelectInput
              name="timezone"
              value={props.timezone}
              onChange={(e) => props.setTimezone(e.target.value)}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ")}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
      </div>
    </section>
  );
}
