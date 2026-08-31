export interface Campaign {
  id: string;
  name: string;
  sub: string;
  contacts: number;
  audience: string;
  clicks: number;
  unsubs: number;
  revenue: string;
  status: "Draft" | "Sent";
}

export const campaigns: Campaign[] = [
  {
    id: "1",
    name: "Fall Collection Announcement",
    sub: "Last saved on Oct 10th, 2024 @ 12:58 pm",
    contacts: 2136,
    audience: "2 Lists",
    clicks: 0,
    unsubs: 0,
    revenue: "-",
    status: "Draft",
  },
  {
    id: "2",
    name: "Labor Day 2024 - Free Shipping - Final Reminder",
    sub: "Sent on Sep 2nd, 2024 @ 2:10 pm",
    contacts: 4653,
    audience: "No Audience",
    clicks: 384,
    unsubs: 0,
    revenue: "$13,795",
    status: "Sent",
  },
  {
    id: "3",
    name: "Labor Day 2024 - Free Shipping",
    sub: "Sent on Aug 30th, 2024 @ 2:10 pm",
    contacts: 4599,
    audience: "No Audience",
    clicks: 391,
    unsubs: 0,
    revenue: "$11,824",
    status: "Sent",
  },
  {
    id: "4",
    name: "Store Hours Reminder",
    sub: "Sent on Aug 27th, 2024 @ 3:21 pm",
    contacts: 1232,
    audience: "No Audience",
    clicks: 0,
    unsubs: 0,
    revenue: "$0",
    status: "Sent",
  },
  {
    id: "5",
    name: "SoCal Only - Store Hours Change",
    sub: "Sent on Aug 27th, 2024 @ 8:48 am",
    contacts: 804,
    audience: "No Audience",
    clicks: 0,
    unsubs: 0,
    revenue: "$0",
    status: "Sent",
  },
  {
    id: "6",
    name: "Nashville Anniversary Party",
    sub: "Sent on Aug 26th, 2024 @ 1:52 pm",
    contacts: 4409,
    audience: "No Audience",
    clicks: 0,
    unsubs: 0,
    revenue: "$0",
    status: "Sent",
  },
  {
    id: "7",
    name: "Tote Bag Drop",
    sub: "Sent on Aug 26th, 2024 @ 1:41 pm",
    contacts: 1985,
    audience: "No Audience",
    clicks: 649,
    unsubs: 0,
    revenue: "$6,991",
    status: "Sent",
  },
];

export interface AudienceOption {
  id: string;
  label: string;
  type: "everyone" | "list" | "segment";
}

export const audienceOptions: AudienceOption[] = [
  { id: "all", label: "All Contacts", type: "everyone" },
  { id: "nash", label: "Nashville Store", type: "list" },
  { id: "nyc", label: "NYC Store", type: "list" },
  { id: "sf", label: "San Francisco Store", type: "list" },
  { id: "vip", label: "VIP Club Members", type: "list" },
  { id: "joined30", label: "Joined in Last 30 Days", type: "segment" },
];

export const mergeTags = [
  { label: "Address", tag: "{{address}}" },
  { label: "Birthdate", tag: "{{birthdate}}" },
  { label: "City", tag: "{{city}}" },
  { label: "Contact ID", tag: "{{contact_id}}" },
  { label: "Country", tag: "{{country}}" },
];

export const aiSuggestions = [
  "Black Friday Alert! 🎉 Enjoy 40% OFF on all dresses for the next 12 hours only! Don't miss out!",
  "👗 Elevate your wardrobe this Black Friday! Get 40% OFF on our stunning dresses for just 12 hours! Hurry, time is ticking!",
  "🛍️ Black Friday Sale is LIVE! Grab your favorite dress at 40% OFF for the next 12 hours! Act fast and shine bright!",
];

export const aiSuggestionsFunny = [
  "Why did the dress break up with the pants? Because it found a better deal! Get 40% OFF our fabulous dresses this Black Friday, but only for 12 hours! Don't let this deal ghost you!",
  "Our Black Friday Sale is LIVE - 40% OFF on dresses for the next 12 hours! Remember, calories don't count when you're shopping... just spend wisely!",
  "Black Friday Alert! Grab your dresses faster than you can say 'I need a new wardrobe!' Enjoy 40% OFF for 12 hours only! Let's shop 'til we drop... or at least until the clock runs out!",
];

export const tones = ["Formal", "Informal", "Fun", "Clever", "Conversational", "Inspirational", "Urgent"];

export const reviewSummary = {
  audienceCount: "5,359",
  timing: "Send Immediately",
  creditsAvailable: "100,046",
  creditsRequired: "21,436",
  creditsRemaining: "78,610",
};
