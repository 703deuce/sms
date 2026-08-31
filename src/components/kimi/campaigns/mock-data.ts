export type Campaign = {
  id: string;
  name: string;
  meta: string;
  recipients: number;
  audienceLabel: string;
  clicks: number | null;
  unsubs: number | null;
  revenue: string | null;
  status: "Draft" | "Sent";
};

export const campaigns: Campaign[] = [
  { id: "c1", name: "Fall Collection Announcement", meta: "Last saved on Oct 10th, 2024 @ 12:58 pm", recipients: 2136, audienceLabel: "2 Lists", clicks: null, unsubs: null, revenue: null, status: "Draft" },
  { id: "c2", name: "Labor Day 2024 - Free Shipping - Final Reminder", meta: "Sent on Sep 2nd, 2024 @ 2:10 pm", recipients: 4653, audienceLabel: "No Audience", clicks: 384, unsubs: 0, revenue: "$13,795", status: "Sent" },
  { id: "c3", name: "Labor Day 2024 - Free Shipping", meta: "Sent on Aug 30th, 2024 @ 2:19 pm", recipients: 4599, audienceLabel: "No Audience", clicks: 391, unsubs: 0, revenue: "$11,824", status: "Sent" },
  { id: "c4", name: "Store Hours Reminder", meta: "Sent on Aug 27th, 2024 @ 3:21 pm", recipients: 1232, audienceLabel: "No Audience", clicks: 0, unsubs: 0, revenue: "$0", status: "Sent" },
  { id: "c5", name: "SoCal Only - Store Hours Change", meta: "Sent on Aug 27th, 2024 @ 8:48 am", recipients: 804, audienceLabel: "No Audience", clicks: 0, unsubs: 0, revenue: "$0", status: "Sent" },
  { id: "c6", name: "Nashville Anniversary Party", meta: "Sent on Aug 26th, 2024 @ 1:52 pm", recipients: 4409, audienceLabel: "No Audience", clicks: 0, unsubs: 0, revenue: "$0", status: "Sent" },
  { id: "c7", name: "Tote Bag Drop", meta: "Sent on Aug 26th, 2024 @ 1:41 pm", recipients: 1985, audienceLabel: "No Audience", clicks: 649, unsubs: 0, revenue: "$6,991", status: "Sent" },
];

export const audienceOptions = {
  everyone: [{ id: "all", label: "All Contacts" }],
  lists: [
    { id: "nash", label: "Nashville Store" },
    { id: "nyc", label: "NYC Store" },
    { id: "sf", label: "San Francisco Store" },
    { id: "vip", label: "VIP Club Members" },
  ],
  segments: [{ id: "joined30", label: "Joined in Last 30 Days" }],
};

export const mergeTags = [
  { label: "Address", value: "{{address}}" },
  { label: "Birthdate", value: "{{birthdate}}" },
  { label: "City", value: "{{city}}" },
  { label: "Contact ID", value: "{{contact_id}}" },
  { label: "Country", value: "{{country}}" },
];

export const aiSuggestions = [
  "🖤 Black Friday Alert! 🎉 Enjoy 40% OFF on all dresses for the next 12 hours only! Don't miss out!",
  "👗 Elevate your wardrobe this Black Friday! Get 40% OFF on our stunning dresses for just 12 hours! Hurry, time is ticking!",
  "🛍️ Black Friday Sale is LIVE! Grab your favorite dress at 40% OFF for the next 12 hours! Act fast and shine bright!",
];

export const aiFunnySuggestions = [
  "Why did the dress break up with the pants? Because it found a better deal! Get 40% OFF our fabulous dresses this Black Friday, but only for 12 hours! Don't let this deal ghost you!",
  "Attention shopaholics! Our Black Friday Sale is LIVE - 40% OFF on dresses for the next 12 hours! Remember, calories don't count when you're shopping... just spend wisely!",
  "Black Friday Alert! Grab your dresses faster than you can say 'I need a new wardrobe!' Enjoy 40% OFF for 12 hours only! Let's shop 'til we drop... or at least until the clock runs out!",
];

export const tones = ["Formal", "Informal", "Fun", "Clever", "Conversational", "Inspirational", "Urgent"];

export const reviewSummary = {
  audience: ["List: Nashville Store", "Segment: Joined in Last 30 Days"],
  count: "5,359",
  timing: "Send Immediately",
  creditsAvailable: "100,046",
  creditsRequired: "21,436",
  creditsRemaining: "78,610",
};

export const defaultMessage =
  "👗 Why did the dress break up with the pants? Because it found a better deal! Get 40% OFF our fabulous dresses this Black Friday, but only for 12 hours! Don't let this deal ghost you! Visit stxt.io/lea/872c4aa521";
