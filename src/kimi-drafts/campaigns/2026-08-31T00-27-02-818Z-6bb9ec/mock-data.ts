export interface Campaign {
  id: string;
  name: string;
  detail: string;
  recipients: string;
  audience: string;
  hasMms: boolean;
  clicks: number | null;
  unsubs: number | null;
  revenue: string | null;
  status: "Draft" | "Sent";
}

export const campaigns: Campaign[] = [
  { id: "c1", name: "Black Friday Dress Sale", detail: "Last saved on Oct 14th, 2024 @ 8:49 am", recipients: "2,249", audience: "3 Lists", hasMms: false, clicks: null, unsubs: null, revenue: null, status: "Draft" },
  { id: "c2", name: "Fall Collection Announcement", detail: "Last saved on Oct 10th, 2024 @ 12:58 pm", recipients: "2,136", audience: "2 Lists", hasMms: false, clicks: null, unsubs: null, revenue: null, status: "Draft" },
  { id: "c3", name: "Labor Day 2024 - Free Shipping - Final Reminder", detail: "Sent on Sep 2nd, 2024 @ 2:10 pm", recipients: "4,653", audience: "No Audience", hasMms: false, clicks: 384, unsubs: 0, revenue: "$13,795", status: "Sent" },
  { id: "c4", name: "Labor Day 2024 - Free Shipping", detail: "Sent on Aug 30th, 2024 @ 2:10 pm", recipients: "4,599", audience: "No Audience", hasMms: false, clicks: 391, unsubs: 0, revenue: "$11,824", status: "Sent" },
  { id: "c5", name: "Store Hours Reminder", detail: "Sent on Aug 27th, 2024 @ 3:21 pm", recipients: "1,232", audience: "No Audience", hasMms: true, clicks: 0, unsubs: 0, revenue: "$0", status: "Sent" },
  { id: "c6", name: "SoCal Only - Store Hours Change", detail: "Sent on Aug 27th, 2024 @ 8:48 am", recipients: "804", audience: "No Audience", hasMms: true, clicks: 0, unsubs: 0, revenue: "$0", status: "Sent" },
  { id: "c7", name: "Nashville Anniversary Party", detail: "Sent on Aug 26th, 2024 @ 1:52 pm", recipients: "4,409", audience: "No Audience", hasMms: false, clicks: 0, unsubs: 0, revenue: "$0", status: "Sent" },
  { id: "c8", name: "Tote Bag Drop", detail: "Sent on Aug 26th, 2024 @ 1:41 pm", recipients: "1,985", audience: "No Audience", hasMms: false, clicks: 649, unsubs: 0, revenue: "$6,991", status: "Sent" },
];

export const audiences = {
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
  { label: "Address", tag: "{{address}}" },
  { label: "Birthdate", tag: "{{birthdate}}" },
  { label: "City", tag: "{{city}}" },
  { label: "Contact ID", tag: "{{contact_id}}" },
  { label: "Country", tag: "{{country}}" },
];

export const aiMessages = [
  "🖤 Black Friday Alert! 🎉 Enjoy 40% OFF on all dresses for the next 12 hours only! Don't miss out!",
  "👗 Elevate your wardrobe this Black Friday! Get 40% OFF on our stunning dresses for just 12 hours! Hurry, time is ticking!",
  "🛍️ Black Friday Sale is LIVE! Grab your favorite dress at 40% OFF for the next 12 hours! Act fast and shine bright!",
  "🛍️ Attention shopaholics! Our Black Friday Sale is LIVE - 40% OFF on dresses for the next 12 hours! Remember, calories don't count when you're shopping... just spend wisely!",
];

export const tones = ["Formal", "Informal", "Fun", "Clever", "Conversational", "Inspirational", "Urgent"];

export const credits = {
  available: "100,046",
  required: "21,436",
  remaining: "78,610",
};
