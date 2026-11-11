/** Shared v1 Ad Studio contract types. No generation endpoints are activated in B1. */
export type AdAspect = "9:16" | "16:9" | "1:1" | "3:4";
export type AdDuration = 15 | 30;
export type AdMode = "storyline" | "image_to_ad" | "image_ad_to_commercial";
export type AdRunStatus = "draft" | "planning" | "plan_ready" | "confirming" | "generating" | "stitching" | "done" | "failed" | "cancelled";
export type AdSceneStatus = "planned" | "ready" | "failed" | "skipped";
export type AdStudioErrorCode = "INVALID_PARAMS" | "PLAN_NOT_READY" | "ALREADY_CONFIRMED" | "CONCURRENCY_LIMIT" | "RUN_NOT_FOUND" | "INSUFFICIENT_CREDITS" | "KIE_ERROR" | "STOCK_ERROR" | "RENDER_ERROR" | "VOICE_TOO_LONG" | "TTS_ERROR" | "STORAGE_ERROR";
export type AdCommercialModelId = "wan-3.0" | "seedance-2.5" | "seedance-2.0-mini" | "veo-3.1-lite";
export interface AdProductInput { name: string; url?: string; sellingPoints: string[]; audience?: string; brandNotes?: string; headline?: string; subHeadline?: string; cta?: string; brandColors?: { primary: string; secondary?: string }; aspect: AdAspect; durationSec: AdDuration; imageAssetIds: string[]; logoAssetId?: string; voiceId?: string; voiceoverEnabled?: boolean; imageVariantId?: string; commercialModelId?: AdCommercialModelId }
export interface AdScript { hook: string; problem: string; solution: string; cta: string; voiceover: string; onScreenText: string[] }
export interface AdImagery { imageJobIds: string[]; preservedSourceAssetIds: string[] }
export interface AdScene { index: number; role: "hook" | "problem" | "solution" | "cta" | "other"; durationSec: number; source: "stock" | "generated"; reason: string; providerId?: string; stockAssetId?: string; sourceInMs?: number; sourceOutMs?: number; stockQuery?: string; studioJobId?: string; modelId?: string; prompt?: string; generationDurationSec?: number; trimInMs?: number; trimOutMs?: number; referenceAssetId?: string; startMs: number; endMs: number; onScreenText?: string }
export interface AdPhotoConcept { prompt: string; style: string; layoutNotes: string }
export interface AdPhotoQc {
  decision: "pass" | "edit" | "regenerate"
  reason: string
  issues: string[]
  weightedScore: number
  editPrompt?: string
  regeneratedPrompt?: string
  reviewerModel: string
}
export interface AdPhotoAdsPlan { conceptModel: string; styleReferenceCount: number; concepts: AdPhotoConcept[]; qcByIndex?: Record<string, AdPhotoQc> }
export interface AdPlan { script: AdScript; imagery: AdImagery; scenes: AdScene[]; creditEstimate: number | null; modelStrategy: string; voiceId?: string; voiceoverEnabled?: boolean; photoAds?: AdPhotoAdsPlan; directCommercial?: { modelId: AdCommercialModelId; prompt: string; nativeAudio: true } }
export interface AdImageVariant { id: string; index: number; headline: string; cta: string; modelId: string; studioJobId: string | null; status: "planned" | "ready" | "failed"; downloadUrl: string | null; qc?: AdPhotoQc | null }
export interface AdStudioRun { id: string; status: AdRunStatus; mode: AdMode; input: AdProductInput; plan: AdPlan | null; creditEstimate: number | null; creditCharged: number | null; projectId: string | null; clipId: string | null; compactEditorUrl: string | null; fullEditorUrl: string | null; imageAds?: AdImageVariant[]; canRetryRender?: boolean; canRetryVoiceover?: boolean; error: null | { code: AdStudioErrorCode | string; message: string }; createdAt: string; updatedAt: string; completedAt: string | null }
