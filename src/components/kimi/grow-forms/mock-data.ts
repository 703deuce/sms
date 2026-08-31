export type WebForm = {
  id: string;
  name: string;
  description: string;
  type: "Landing Page" | "Website Embed";
  connectedLists: number;
  status: "Active" | "Inactive";
  lastSaved: string;
  thumb: string;
};

export const webForms: WebForm[] = [
  {
    id: "f1",
    name: "20 % Off",
    description: "Sharing on Instagram",
    type: "Landing Page",
    connectedLists: 1,
    status: "Active",
    lastSaved: "Jun 18th, 2025 @ 10:44 am",
    thumb: "forest",
  },
  {
    id: "f2",
    name: "Embed - Shopify Contact Page",
    description: "",
    type: "Website Embed",
    connectedLists: 0,
    status: "Active",
    lastSaved: "Jun 18th, 2025 @ 10:44 am",
    thumb: "dark",
  },
  {
    id: "f3",
    name: "20% Off - Social Share",
    description: "",
    type: "Website Embed",
    connectedLists: 0,
    status: "Active",
    lastSaved: "Jun 18th, 2025 @ 10:44 am",
    thumb: "light",
  },
];

export const contactLists = [
  { id: "l1", name: "ELT" },
  { id: "l2", name: "Nashville Store" },
  { id: "l3", name: "NYC Store" },
  { id: "l4", name: "San Francisco Store" },
  { id: "l5", name: "VIP Club Members" },
];

export const contactFields = [
  "First Name",
  "Last Name",
  "Mobile Number",
  "Email",
  "Birthdate",
  "Address",
  "City",
  "State / Province",
  "Postal Code",
  "Country",
  "Timezone",
  "Language",
  "Activity Group",
  "Office",
  "Preferred Date (HubSpot)",
  "Transovo Team",
];

export type Template = {
  id: string;
  title: string;
  desc: string;
  kind: "landing" | "embed";
  bg: string;
  dark?: boolean;
  image?: string;
};

export const templates: Template[] = [
  { id: "t0", title: "Start From Scratch", desc: "Begin with a minimal design to create a fully custom form.", kind: "landing", bg: "blank" },
  { id: "t1", title: "Collect Name, Phone & Email", desc: "Responsive, split screen design collecting name, mobile number and email. Optimized as a landing page.", kind: "landing", bg: "forest", image: "forest", dark: true },
  { id: "t2", title: "Collect Name, Phone & Email", desc: "Responsive, split screen design collecting name, mobile number and email. Optimized as a landing page.", kind: "landing", bg: "orange", dark: true },
  { id: "t3", title: "Collect Name, Phone & Email", desc: "Responsive, split screen design collecting name, mobile number and email. Optimized as a landing page.", kind: "landing", bg: "gym" },
  { id: "t4", title: "Collect Name, Phone & Email", desc: "Responsive, split screen design collecting name, mobile number and email. Optimized as a landing page.", kind: "landing", bg: "purple", dark: true },
  { id: "t5", title: "Collect Name, Phone & Email", desc: "Responsive, full page design collecting name, mobile number and email. Optimized as a landing page.", kind: "landing", bg: "maroon", dark: true },
  { id: "t6", title: "Collect Name, Phone & Email", desc: "Responsive, split screen design collecting name, mobile number and email. Optimized as a landing page.", kind: "landing", bg: "paper" },
  { id: "e1", title: "Collect Name, Phone & Email", desc: "Responsive design collecting name, mobile number and email. Optimized for being embedded on a website.", kind: "embed", bg: "embed-dark", dark: true },
  { id: "e2", title: "Collect Name, Phone & Email", desc: "Responsive design collecting name, mobile number and email. Optimized for being embedded on a website.", kind: "embed", bg: "embed-cream" },
  { id: "e3", title: "Collect Name, Phone & Email", desc: "Responsive design collecting name, mobile number and email. Optimized for being embedded on a website.", kind: "embed", bg: "embed-orange" },
  { id: "e4", title: "Collect Name, Phone & Email", desc: "Responsive design collecting name, mobile number and email. Optimized for being embedded on a website.", kind: "embed", bg: "embed-split" },
];

export const stockImages = [
  { id: "i1", by: "Nathan Dumlao", hue: "#3f5b46", label: "Latte art" },
  { id: "i2", by: "Nathan Dumlao", hue: "#5c4a38", label: "Coffee cup" },
  { id: "i3", by: "Petr Sevcovic", hue: "#6b5646", label: "Café interior" },
  { id: "i4", by: "Keghan Crossland", hue: "#7d6a55", label: "Espresso bar" },
  { id: "i5", by: "Clifford", hue: "#8a7561", label: "Pour over" },
  { id: "i6", by: "Nathan Dumlao", hue: "#4c6152", label: "Flat white" },
  { id: "i7", by: "Mihai Moisa", hue: "#5f5145", label: "Roastery" },
  { id: "i8", by: "daan evers", hue: "#71624f", label: "Café window" },
  { id: "i9", by: "Kris Atomic", hue: "#826e58", label: "Beans" },
  { id: "i10", by: "Roman Bozhko", hue: "#4a4038", label: "Drip bar" },
  { id: "i11", by: "Nafinia Putra", hue: "#655447", label: "Morning brew" },
  { id: "i12", by: "Tony Lee", hue: "#776452", label: "Cappuccino" },
];

export const designElements = [
  { id: "header", label: "Header" },
  { id: "text", label: "Text" },
  { id: "image", label: "Image" },
  { id: "field", label: "Field" },
  { id: "dropdown", label: "Dropdown" },
  { id: "button", label: "Button" },
  { id: "link", label: "Link" },
  { id: "icon", label: "Icon" },
  { id: "compliance", label: "Compliance Statement" },
  { id: "container", label: "Container" },
  { id: "two-col", label: "Two Columns" },
  { id: "three-col", label: "Three Columns" },
  { id: "error", label: "Error Text" },
];

export const formDefaults = {
  name: "20 % Off",
  description: "Sharing on Instagram",
  pageTitle: "Patchwork Coffee | 20% Off",
  urlPath: "20percentoff",
  heading: "Want 20% off?",
  subtext: "Join our VIP text list and receive a code for 20% off your next purchase in store or online.",
  buttonLabel: "Join Now",
  doubleOptIn: "To complete your subscription to Patchwork Coffee Co. text alerts, reply YES.",
  optIn: "Thanks for subscribing to Patchwork Coffee Co text alerts. Show this text for 20% off your next purchase.",
};
