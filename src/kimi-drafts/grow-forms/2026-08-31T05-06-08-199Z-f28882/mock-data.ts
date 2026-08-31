export type WebForm = {
  id: string;
  name: string;
  description: string;
  type: "Landing Page" | "Website Embed";
  lists: number;
  status: "Active" | "Draft" | "Paused";
  lastSaved: string;
  thumb: string; // color swatch
};

export const webForms: WebForm[] = [
  { id: "1", name: "20 % Off", description: "Sharing on Instagram", type: "Landing Page", lists: 1, status: "Active", lastSaved: "Jun 18th, 2025 @ 10:44 am", thumb: "#2f4a37" },
  { id: "2", name: "Embed - Shopify Contact Page", description: "", type: "Website Embed", lists: 0, status: "Active", lastSaved: "Jun 18th, 2025 @ 10:44 am", thumb: "#141414" },
  { id: "3", name: "20% Off - Social Share", description: "", type: "Website Embed", lists: 0, status: "Active", lastSaved: "Jun 18th, 2025 @ 10:44 am", thumb: "#e5e5e5" },
];

export const contactLists = ["BLT", "Nashville Store", "NYC Store", "San Francisco Store", "VIP Club Members"];

export const contactFieldOptions = [
  "First Name","Last Name","Mobile Number","Email","Birthday","Address","City",
  "State / Province","Postal Code","Country","Language","Activity Group","St. Answer",
  "Office","Frequent Date (HubSpot)","Transovo Team",
];

export const formTemplates = Array.from({ length: 18 }, (_, i) => ({
  id: `tpl-${i}`,
  name: i % 3 === 0 ? "Collect Name, Phone & Email" : i % 3 === 1 ? "Collect Name & Email" : "Collect Name, Phone & Email",
  desc: i % 2 === 0
    ? "Responsive, split screen design collecting name, mobile number and email. Optimized as a landing page."
    : "Responsive, full page design collecting name, mobile number and email. Optimized as a landing page.",
  hue: [210, 20, 160, 45, 260, 0, 100, 190, 330, 75, 220, 15, 140, 280, 35, 200, 120, 300][i],
}));

export const imageResults = Array.from({ length: 18 }, (_, i) => ({
  id: `img-${i}`,
  author: ["Nathan Dumlao","Petr Sevcovic","Keghan Crossland","Clifford","Mihai Moisa","daan evers","Kris Atomic","Roman Bozhko","Nafinia Putra","Tony Lee","kayleigh harrington","Clem Onojeghuo","Tomas Jasovsky"][i % 13],
  hue: [25, 35, 90, 150, 200, 30, 45, 15, 210, 60, 100, 170, 40, 80, 20, 55, 130, 190][i],
}));

export const builderDefaults = {
  landing: {
    name: "20 % Off",
    description: "Sharing on Instagram",
    pageTitle: "Patchwork Coffee | 20% Off",
    urlPath: "20percentoff",
    heading: "Want 20% off?",
    subheading: "Join our VIP text list and receive a code for 20% off your next purchase in store or online.",
    buttonText: "Join Now",
  },
  embed: {
    name: "Embed - 20% Off",
    description: "Embedded on Contact Page",
    heading: "Want 20% Off?",
    subheading: "Join our VIP text list and receive a code for 20% off your next purchase in store or online.",
    buttonText: "Join Now",
  },
  doubleOptIn: "To complete your subscription to Patchwork Coffee Co. text alerts, reply YES.",
  optIn: "Thanks for subscribing to Patchwork Coffee Co text alerts. Show this text for 20% off your next purchase.",
  compliance: "By subscribing, you agree to receive automated promotional messages. This agreement is not a condition of purchase. Text STOP to opt out or HELP for help. Message & data rates apply. Terms and privacy policy can be found here.",
};

export const fonts = ["Cormorant Garamond","Arial","Archivo","Bebas Neue","Cabin","DM Sans","Figtree","Inter","Lato","Merriweather","Montserrat","Open Sans","Oswald","Playfair Display","Poppins","Roboto"];
