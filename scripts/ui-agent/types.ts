export type AnalysisMode = "native_multimodal" | "sampled_frames";

export type UiAgentMode = "analyze" | "improve" | "validate" | "capture";

export type MediaKind = "image" | "video";

export type SupabaseReferenceSource = {
  referenceName: string;
  bucket: string;
  path: string;
  size?: number;
  sha256?: string;
};

export type LabeledMedia = {
  label: string;
  purpose: string;
  path: string;
  kind: MediaKind;
  mimeType: string;
  supabase?: SupabaseReferenceSource;
};

export type ReferenceDepth = "page" | "flow";

export type ViewportPreset = "desktop" | "mobile" | "tablet";

export type ViewportConfig = {
  name: ViewportPreset;
  width: number;
  height: number;
};

export type UiAnalysisInput = {
  systemPrompt: string;
  userPrompt: string;
  labeledMedia: LabeledMedia[];
  expectJson?: boolean;
  /** Emit KIMI_FILE_BEGIN/END protocol and write files during stream */
  useIncrementalFiles?: boolean;
  /** Revision pass — do not re-attach reference video */
  skipReferenceVideo?: boolean;
  /** K3 only — low for visual UI codegen; omit on non-K3 models */
  reasoningEffort?: "low" | "high" | "max";
  maxOutputTokens?: number;
  /** Use minimal stack prompt instead of full design/manifest context */
  leanPrompt?: boolean;
  sessionId?: string;
  phaseLabel?: string;
  /** Route for incremental copy to src/kimi-drafts/ (durable storage). */
  draftTargetRoute?: string;
  referenceNames?: string[];
};

export type KimiMediaDelivery = {
  kind: "video" | "image";
  label: string;
  localPath: string;
  mimeType: string;
  bytes: number;
  delivery: "native_ms" | "image_data_url";
  reference: string;
  kimiFileId?: string;
  fromCache?: boolean;
};

export type UiAnalysisResult = {
  rawText: string;
  parsedJson: unknown | null;
  model: string;
  analysisMode: AnalysisMode;
  mediaDeliveries?: KimiMediaDelivery[];
  usage?: { promptTokens?: number; completionTokens?: number };
};

export interface UiVisionProvider {
  readonly model: string;
  readonly supportsImage: boolean;
  readonly supportsVideo: boolean;
  analyze(input: UiAnalysisInput): Promise<UiAnalysisResult>;
}

export type ReferenceAnalysis = {
  pagesSeen: string[];
  layout: Record<string, unknown>;
  navigation: string[];
  components: string[];
  typography: Record<string, unknown>;
  spacing: Record<string, unknown>;
  hierarchy: Record<string, unknown>;
  tables: string[];
  cards: string[];
  forms: string[];
  modals: string[];
  dropdowns: string[];
  tabs: string[];
  filters: string[];
  emptyStates: string[];
  loadingStates: string[];
  interactions: string[];
  transitions: string[];
  responsiveBehavior: string[];
  visualPatterns: string[];
  assets: string[];
  uncertainObservations: string[];
  videoSequence?: string[];
};

export type DifferencePlanItem = {
  area: string;
  current: string;
  reference: string;
  change: string;
  priority: "high" | "medium" | "low";
};

export type BackendGap = {
  feature: string;
  reason: string;
};

export type DifferencePlan = {
  target: string;
  preserve: string[];
  modify: DifferencePlanItem[];
  add: string[];
  remove: string[];
  reuseComponents: string[];
  newPresentationComponents: string[];
  interactionChanges: string[];
  responsiveChanges: string[];
  backendChangesRequired: BackendGap[];
  outOfScope: string[];
  uncertainties: string[];
  inScope: string[];
};

export type ProposedFileChange = {
  file: string;
  action: "modify" | "create";
  reason: string;
  content: string;
};

export type ImplementationPlan = {
  changes: ProposedFileChange[];
  summary: string;
  notes: string[];
};

export type ApprovedReference = {
  approved: true;
  sessionId: string;
  target: string;
  generatedFiles: string[];
  referenceSources: string[];
  approvedAt: string;
  notes: string;
};

export type FunctionalMappingItem = {
  kimiComponent: string;
  productionEquivalent: string;
  visualChanges: string[];
  realBehaviorToPreserve: string[];
};

export type FunctionalMappingReport = {
  target: string;
  mappings: FunctionalMappingItem[];
  backendChangesRequired: BackendGap[];
  mockDataMustNotCopy: string[];
  notes: string[];
};

export type VisualVerificationScores = {
  visualMatch: number;
  layoutMatch: number;
  interactionMatch: number;
  brandPreservation: number;
  functionalityRisk: "low" | "medium" | "high";
  remainingDifferences: string[];
};

export type ProjectManifest = {
  targetRoute: string;
  targetFiles: string[];
  sharedUiFiles: string[];
  protectedDependencies: string[];
  apiContracts: string[];
  currentComponents: string[];
  designSystemFiles: string[];
  inScope: string[];
  outOfScope: string[];
};

export type UiAgentSession = {
  id: string;
  createdAt: string;
  target: string;
  instruction: string;
  referenceMedia: Array<{ label: string; purpose: string; path: string; source: string }>;
  currentMedia: Array<{ label: string; path: string; viewport?: string }>;
  manifest: ProjectManifest;
  generatedDir?: string;
  refinementPasses?: number;
  approved?: boolean;
  status?: "draft" | "generating" | "ready" | "approved" | "integrated";
  referenceAnalysis?: ReferenceAnalysis;
  differencePlan?: DifferencePlan;
  implementationPlan?: ImplementationPlan;
  verification?: VisualVerificationScores;
};

export type KimiCommandMode = "generate" | "polish";

export type CliOptions = {
  mode?: KimiCommandMode;
  target?: string;
  sessionId?: string;
  instruction?: string;
  referenceImages: string[];
  referenceVideos: string[];
  referenceUrls: string[];
  referenceNames: string[];
  referenceVideoNames: string[];
  referenceImageNames: string[];
  currentImages: string[];
  currentVideos: string[];
  captureCurrent: boolean;
  captureScreenshots: boolean;
  captureVideo: boolean;
  referenceDepth: ReferenceDepth;
  planOnly: boolean;
  apply: boolean;
  dryRun: boolean;
  analyzeOnly: boolean;
  approve: boolean;
  integrate: boolean;
  revise: boolean;
  /** Run completeness pass — re-watch video, fill missing screens/builders */
  complete: boolean;
  walkthrough: boolean;
  /** Polish mode: capture AFTER screenshots (required for remote/production base URLs post-deploy) */
  captureAfter?: boolean;
  /** Polish mode: do not auto-resolve route reference video from references.json */
  skipAutoReference?: boolean;
  /** Polish mode: browser URL path when it differs from --target (e.g. /contacts/abc for target /contacts/[id]) */
  capturePath?: string;
  baseUrl: string;
  viewports: ViewportPreset[];
  maxPasses: number;
  kimiModel?: string;
  reasoningEffort?: "low" | "high" | "max";
  /** Called as soon as the Kimi session id is allocated (for live batch monitoring). */
  onSessionStarted?: (sessionId: string) => void;
};
