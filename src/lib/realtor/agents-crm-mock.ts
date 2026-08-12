/** Fixture data for AI Agents CRM pages matching product mockups. */

export type AgentTab = string;

export const FRONT_DESK_KPI = {
  totalLeads: 1248,
  conversations: 842,
  managedRate: "65%",
  appointments: 56,
  conversionRate: "12.5%",
};

export const FRONT_DESK_LEAD_NEEDS = [
  { label: "Financial Assistance", color: "bg-blue-500" },
  { label: "First-Time Home Buyer", color: "bg-emerald-500" },
  { label: "Ready to Move", color: "bg-purple-500" },
  { label: "Relocation", color: "bg-orange-500" },
  { label: "Investment Property", color: "bg-cyan-500" },
];

export const FRONT_DESK_DISPOSITIONS = [
  { label: "Ready to move", count: 35 },
  { label: "Bad record", count: 22 },
  { label: "Appointment booked", count: 18 },
  { label: "Follow up needed", count: 14 },
  { label: "Not interested", count: 9 },
];

export const FRONT_DESK_RECENT = [
  { type: "call", lead: "Chandler Bing", phone: "(571) 555-2841", time: "2 min ago", status: "Appointment Booked", statusClass: "bg-emerald-50 text-emerald-700", duration: "4:12" },
  { type: "sms", lead: "Monica Geller", phone: "(571) 555-3920", time: "18 min ago", status: "Unread", statusClass: "bg-blue-50 text-blue-700", duration: "—" },
  { type: "call", lead: "Ross Geller", phone: "(571) 555-1188", time: "1 hr ago", status: "Qualified", statusClass: "bg-purple-50 text-purple-700", duration: "3:45" },
  { type: "call", lead: "Rachel Green", phone: "(571) 555-4412", time: "2 hr ago", status: "Message Taken", statusClass: "bg-orange-50 text-orange-700", duration: "2:08" },
];

export const SPEED_TO_LEAD_KPI = {
  engagements: "82%",
  leadsProcessed: 1308,
  callsMade: 510,
  appointments: "20.5%",
  conversionRate: "75%",
  impressions: "1.23M",
};

export const SPEED_OPERATIONS = [
  { label: "Successful", pct: 62, color: "bg-emerald-500" },
  { label: "Partially Successful", pct: 18, color: "bg-blue-500" },
  { label: "Failed", pct: 12, color: "bg-orange-500" },
  { label: "Scheduled", pct: 8, color: "bg-amber-400" },
];

export const SPEED_FAILURES = [
  { label: "No Answer", pct: 75, color: "bg-emerald-500" },
  { label: "Bad Number", pct: 45, color: "bg-blue-500" },
  { label: "Invalid Info", pct: 25, color: "bg-amber-400" },
  { label: "Wrong Person", pct: 15, color: "bg-orange-500" },
];

export const SPEED_RECENT_OPS = [
  { lead: "Jennifer Smith", phone: "(703) 555-0123", status: "Success", statusClass: "bg-emerald-50 text-emerald-700", time: "10:42 AM", duration: "4s", result: "Appointment set" },
  { lead: "Marcus Green", phone: "(703) 555-0456", status: "Failed", statusClass: "bg-red-50 text-red-700", time: "10:38 AM", duration: "12s", result: "No answer" },
  { lead: "Amanda Reed", phone: "(703) 555-0789", status: "Success", statusClass: "bg-emerald-50 text-emerald-700", time: "10:15 AM", duration: "8s", result: "Qualified" },
  { lead: "David Brown", phone: "(703) 555-0321", status: "Partial", statusClass: "bg-amber-50 text-amber-700", time: "9:55 AM", duration: "6s", result: "Callback scheduled" },
];

export const SPEED_SOURCES = [
  { name: "Google Ads", pct: 92 },
  { name: "Zillow", pct: 78 },
  { name: "Facebook Ads", pct: 65 },
  { name: "Referral", pct: 42 },
  { name: "Website", pct: 35 },
  { name: "Organic", pct: 22 },
];

export const KNOWLEDGE_KPI = {
  totalItems: 24,
  totalRecords: 568,
  authors: 2,
  readTime: "107m",
  completed: "Oct 10, 2024",
};

export const KNOWLEDGE_SOURCES = [
  { name: "Company Website", type: "Link", size: "—", date: "Oct 8, 2024" },
  { name: "New Agent Onboarding", type: "PDF", size: "2.4 MB", date: "Oct 5, 2024" },
  { name: "Product Manual", type: "PDF", size: "5.1 MB", date: "Oct 1, 2024" },
  { name: "Listing Guidelines", type: "Doc", size: "890 KB", date: "Sep 28, 2024" },
];

export const KNOWLEDGE_CATEGORIES = [
  { label: "Real Estate", count: 130, color: "bg-purple-500" },
  { label: "Training", count: 50, color: "bg-blue-500" },
  { label: "Onboarding", count: 30, color: "bg-emerald-500" },
  { label: "Marketing", count: 20, color: "bg-orange-500" },
  { label: "Finance", count: 10, color: "bg-pink-500" },
];

export const KNOWLEDGE_ACTIVITY = [
  { source: "Company Website", activity: "Updated", date: "Oct 12, 2024", by: "Sarah Johnson", status: "Published", statusClass: "bg-emerald-50 text-emerald-700" },
  { source: "Product Manual", activity: "Added", date: "Oct 10, 2024", by: "Michael Brown", status: "Draft", statusClass: "bg-amber-50 text-amber-700" },
  { source: "Listing Guidelines", activity: "Reviewed", date: "Oct 8, 2024", by: "Sarah Johnson", status: "Published", statusClass: "bg-emerald-50 text-emerald-700" },
];

export const KNOWLEDGE_STATUS = [
  { label: "Planning", pct: 85 },
  { label: "Content", pct: 65 },
  { label: "Design", pct: 45 },
  { label: "Development", pct: 75 },
  { label: "Finalizing", pct: 95 },
];

export const ACTIVITY_KPI = {
  conversations: 2420,
  contacts: 2370,
  messages: 180,
  calls: 24,
  leadGen: 420,
  avgResponse: "3.5m",
};

export const ACTIVITY_ROWS = [
  { time: "Oct 27, 10:45 AM", agent: "Speed-to-Lead", type: "Call", priority: "High", priorityClass: "bg-red-50 text-red-700", contact: "Jennifer Smith", phone: "(703) 555-0123", outcome: "Scheduled", status: "Completed", statusClass: "bg-emerald-50 text-emerald-700" },
  { time: "Oct 27, 10:32 AM", agent: "Front Desk", type: "SMS", priority: "Medium", priorityClass: "bg-amber-50 text-amber-700", contact: "Marcus Green", phone: "(703) 555-0456", outcome: "Follow up", status: "In Progress", statusClass: "bg-blue-50 text-blue-700" },
  { time: "Oct 27, 10:18 AM", agent: "Front Desk", type: "Call", priority: "High", priorityClass: "bg-red-50 text-red-700", contact: "Amanda Reed", phone: "(703) 555-0789", outcome: "Qualified", status: "Completed", statusClass: "bg-emerald-50 text-emerald-700" },
  { time: "Oct 27, 9:55 AM", agent: "Knowledge", type: "Chat", priority: "Low", priorityClass: "bg-gray-100 text-gray-700", contact: "David Brown", phone: "(703) 555-0321", outcome: "Info provided", status: "Completed", statusClass: "bg-emerald-50 text-emerald-700" },
];

export const TEST_TECHNIQUES = [
  { id: "listening", label: "Active Listening", description: "The agent will show that it is listening by using phrases like 'I see' and 'That makes sense.'", selected: true },
  { id: "empathetic", label: "Empathetic", description: "The agent will use empathetic phrases to build rapport with the caller." },
  { id: "professional", label: "Professional", description: "The agent will use professional language throughout the conversation." },
  { id: "direct", label: "Direct and Concise", description: "The agent will use direct and concise language to move the conversation forward." },
];

export const TEST_THINKING_STEPS = [
  { id: 1, label: "Greet the lead.", detail: "Hey, how are you?", done: true },
  { id: 2, label: "Understand their needs.", detail: "What's your budget?", active: true },
  { id: 3, label: "Set Goal.", detail: "Set up an appointment.", pending: true },
  { id: 4, label: "Knowledge base.", detail: "Provide info on listings.", pending: true },
  { id: 5, label: "Determine Sentiment.", detail: "", pending: true },
];

export const TEST_MESSAGES = [
  { role: "agent" as const, text: "Hello, this is Amy from Blue Ridge Realty. How can I help you today?" },
  { role: "user" as const, text: "Yes, I'm interested in buying a house in the suburbs." },
  { role: "agent" as const, text: "Great! What kind of home are you looking for? How many bedrooms do you need?" },
  { role: "user" as const, text: "About 3-4 bedrooms." },
];

export const RECENTLY_TESTED = [
  { name: "Front Desk Agent", status: "Active", statusClass: "text-emerald-600" },
  { name: "General Lead Intake Agent", status: "Scheduled", statusClass: "text-blue-600" },
  { name: "Property Inquiry Agent", status: "Inbound", statusClass: "text-purple-600" },
  { name: "Follow-up Agent", status: "Outbound", statusClass: "text-orange-600" },
];
