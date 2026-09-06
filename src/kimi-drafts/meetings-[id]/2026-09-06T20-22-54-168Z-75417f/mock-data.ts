export type ShareLink = {
  id: string;
  publicUrl: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: "active" | "expired" | "revoked";
};

export type ActionItem = {
  id: string;
  description: string;
  assigneeText: string | null;
  completed: boolean;
};

export type TranscriptSegment = {
  id: string;
  speakerName: string | null;
  text: string;
  startMs: number | null;
};

export type MeetingDetail = {
  id: string;
  title: string | null;
  status: string;
  meetingPlatform: string;
  meetingUrl: string;
  meetingSource?: string;
  scheduledStartAt: string | null;
  durationSeconds: number | null;
  summaryText: string | null;
  summaryOriginal: string | null;
  followUpEmailDraft: string | null;
  appointmentId: string | null;
  appointmentLabel?: string | null;
  transcriptStatus?: string;
  recordingStatus?: string;
  summaryStatus?: string;
  actionItemsStatus?: string;
  followUpStatus?: string;
  recapShares: ShareLink[];
  actionItems: ActionItem[];
  transcriptSegments: TranscriptSegment[];
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  disabled: "Off",
  pending: "Pending",
  scheduled: "Scheduled",
  joining: "Joining",
  awaiting_admission: "Awaiting admission",
  active: "In meeting",
  recording: "Recording",
  ended: "Ended",
  processing: "Processing recap",
  completed: "Recap ready",
  canceled: "Canceled",
  failed: "Failed",
  no_recap: "No recap available",
};

export const mockMeeting: MeetingDetail = {
  id: "mtg_9f27c1",
  title: "Initial consultation — Anthony Johnson",
  status: "completed",
  meetingPlatform: "zoom",
  meetingUrl: "https://zoom.us/j/88214439021",
  meetingSource: "zoom",
  scheduledStartAt: "2026-09-08T18:00:00Z",
  durationSeconds: 1920,
  summaryText:
    "Anthony Johnson met with Dr. Rivera to discuss a water heater replacement estimate for his home in Woodbridge. The unit is 14 years old and showing signs of corrosion near the base. Dr. Rivera recommended a 50-gallon high-efficiency model and outlined two pricing tiers. Anthony asked about installation timing and warranty coverage. The team will send a written estimate by Thursday and hold a provisional install slot for next Tuesday morning. Anthony confirmed he is available between 8 AM and 11 AM.",
  summaryOriginal:
    "Anthony Johnson met with Dr. Rivera to discuss a water heater replacement estimate for his home in Woodbridge. The unit is 14 years old and showing signs of corrosion near the base. Dr. Rivera recommended a 50-gallon high-efficiency model and outlined two pricing tiers. Anthony asked about installation timing and warranty coverage. The team will send a written estimate by Thursday and hold a provisional install slot for next Tuesday morning. Anthony confirmed he is available between 8 AM and 11 AM.",
  followUpEmailDraft:
    "Hi Anthony,\n\nThank you for meeting with us today. As discussed, we'll send your written water heater replacement estimate by Thursday, and we've reserved a provisional installation slot for Tuesday morning between 8:00 and 11:00 AM.\n\nThe estimate will include both pricing tiers we reviewed, along with warranty details for the 50-gallon high-efficiency model.\n\nIf anything changes on your end, just reply to this email or text us at (571) 555-0142.\n\nBest,\nDr. Rivera's Office",
  appointmentId: "appt_4418",
  appointmentLabel: "Water Heater Estimate — Sep 10 · 2:00 PM",
  transcriptStatus: "ready",
  recordingStatus: "ready",
  summaryStatus: "ready",
  actionItemsStatus: "ready",
  followUpStatus: "ready",
  recapShares: [
    {
      id: "shr_1",
      publicUrl: "https://app.transovo.com/recap/9f27c1-xk82",
      expiresAt: "2026-10-08T18:00:00Z",
      revokedAt: null,
      createdAt: "2026-09-08T19:12:00Z",
      status: "active",
    },
    {
      id: "shr_2",
      publicUrl: "https://app.transovo.com/recap/9f27c1-m41z",
      expiresAt: "2026-09-05T18:00:00Z",
      revokedAt: null,
      createdAt: "2026-09-01T14:03:00Z",
      status: "expired",
    },
  ],
  actionItems: [
    {
      id: "ai_1",
      description: "Send written estimate with both pricing tiers",
      assigneeText: "Dr. Rivera's office",
      completed: false,
    },
    {
      id: "ai_2",
      description: "Hold provisional install slot — Tuesday 8:00–11:00 AM",
      assigneeText: "Scheduling",
      completed: true,
    },
    {
      id: "ai_3",
      description: "Confirm availability window with Anthony before Thursday",
      assigneeText: "Anthony Johnson",
      completed: false,
    },
    {
      id: "ai_4",
      description: "Include 10-year warranty details in the estimate",
      assigneeText: "Dr. Rivera's office",
      completed: false,
    },
  ],
  transcriptSegments: [
    { id: "ts_1", speakerName: "Dr. Rivera", text: "Thanks for joining, Anthony. I took a look at the photos you sent — the corrosion near the base of the unit is what concerns me most.", startMs: 4000 },
    { id: "ts_2", speakerName: "Anthony Johnson", text: "Yeah, it's been there a while. The unit is about fourteen years old at this point.", startMs: 21000 },
    { id: "ts_3", speakerName: "Dr. Rivera", text: "At that age, replacement makes more sense than repair. I'd recommend a 50-gallon high-efficiency model. There are two tiers — standard install and premium with the extended warranty.", startMs: 38000 },
    { id: "ts_4", speakerName: "Anthony Johnson", text: "What's the warranty coverage on the premium option?", startMs: 74000 },
    { id: "ts_5", speakerName: "Dr. Rivera", text: "Ten years parts and labor. We'll include the full breakdown in the written estimate, which you'll have by Thursday.", startMs: 89000 },
    { id: "ts_6", speakerName: "Anthony Johnson", text: "Sounds good. If we move forward, mornings work best for me — anytime between 8 and 11.", startMs: 118000 },
    { id: "ts_7", speakerName: "Dr. Rivera", text: "We'll hold a provisional slot for next Tuesday morning and confirm once you've reviewed the estimate.", startMs: 132000 },
  ],
};

export const mockProcessingMeeting: MeetingDetail = {
  ...mockMeeting,
  id: "mtg_processing",
  title: "Quarterly check-in — Sarah Chen",
  status: "processing",
  summaryText: null,
  followUpEmailDraft: null,
  transcriptStatus: "processing",
  recordingStatus: "ready",
  summaryStatus: "processing",
  actionItemsStatus: "pending",
  followUpStatus: "pending",
  recapShares: [],
  actionItems: [],
  transcriptSegments: [],
};

export const mockFailedMeeting: MeetingDetail = {
  ...mockMeeting,
  id: "mtg_failed",
  title: "Site walkthrough — Marcus Lee",
  status: "no_recap",
  summaryText: null,
  summaryOriginal: null,
  followUpEmailDraft: null,
  transcriptStatus: "failed",
  recordingStatus: "ready",
  summaryStatus: "failed",
  actionItemsStatus: "failed",
  followUpStatus: "pending",
  recapShares: [],
  actionItems: [],
  transcriptSegments: [],
};
