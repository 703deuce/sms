/** Shared v1 Ad Studio contract types. No generation endpoints are activated in B1. */
export type AdAspect = "9:16" | "16:9" | "1:1";
export type AdDuration = 15 | 30;
export type AdMode = "storyline" | "image_to_ad";
export type AdRunStatus = "draft" | "planning" | "plan_ready" | "confirming" | "generating" | "stitching" | "done" | "failed" | "cancelled";
export type AdSceneStatus = "planned" | "ready" | "failed" | "skipped";
export type AdStudioErrorCode = "INVALID_PARAMS" | "PLAN_NOT_READY" | "ALREADY_CONFIRMED" | "CONCURRENCY_LIMIT" | "RUN_NOT_FOUND" | "INSUFFICIENT_CREDITS" | "KIE_ERROR" | "STOCK_ERROR" | "RENDER_ERROR" | "STORAGE_ERROR";
export interface AdProductInput { name: string; url?: string; sellingPoints: string[]; audience?: string; brandNotes?: string; aspect: AdAspect; durationSec: AdDuration; imageAssetIds: string[]; logoAssetId?: string }
export interface AdScript { hook: string; problem: string; solution: string; cta: string; voiceover: string; onScreenText: string[] }
export interface AdImagery { imageJobIds: string[]; preservedSourceAssetIds: string[] }
export interface AdScene { index: number; role: "hook" | "problem" | "solution" | "cta" | "other"; durationSec: number; source: "stock" | "generated"; reason: string; providerId?: string; stockAssetId?: string; sourceInMs?: number; sourceOutMs?: number; stockQuery?: string; studioJobId?: string; modelId?: string; prompt?: string; referenceAssetId?: string; startMs: number; endMs: number; onScreenText?: string }
export interface AdPlan { script: AdScript; imagery: AdImagery; scenes: AdScene[]; creditEstimate: number | null; modelStrategy: string }
export interface AdStudioRun { id: string; status: AdRunStatus; mode: AdMode; input: AdProductInput; plan: AdPlan | null; creditEstimate: number | null; creditCharged: number | null; projectId: string | null; clipId: string | null; compactEditorUrl: string | null; fullEditorUrl: string | null; error: null | { code: AdStudioErrorCode | string; message: string }; createdAt: string; updatedAt: string; completedAt: string | null }
