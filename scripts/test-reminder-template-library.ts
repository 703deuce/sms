import catalog from "../src/lib/appointment-reminders/template-library/transovo-reminder-templates.json";

const industries = new Set(catalog.templates.map((t) => t.industry));
const messageTypes = new Set(catalog.templates.map((t) => t.messageType));

if (catalog.templates.length !== 306) {
  console.error(`Expected 306 templates, got ${catalog.templates.length}`);
  process.exit(1);
}

if (industries.size !== 17) {
  console.error(`Expected 17 industries, got ${industries.size}`);
  process.exit(1);
}

if (messageTypes.size !== 9) {
  console.error(`Expected 9 message types, got ${messageTypes.size}`);
  process.exit(1);
}

for (const industry of catalog.industries) {
  for (const mt of catalog.messageTypes) {
    const sms = catalog.templates.find(
      (t) => t.industry === industry && t.messageType === mt && t.channel === "sms",
    );
    const email = catalog.templates.find(
      (t) => t.industry === industry && t.messageType === mt && t.channel === "email",
    );
    if (!sms || !email) {
      console.error(`Missing pair for ${industry} / ${mt}`);
      process.exit(1);
    }
  }
}

console.log("PASS reminder template library:", catalog.templates.length, "templates");
