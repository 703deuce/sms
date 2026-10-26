-- Add launch remodel transformation types (deterministic prompt templates)

ALTER TYPE "VisualizerTransformationType" ADD VALUE IF NOT EXISTS 'TUB_TO_TUB';
ALTER TYPE "VisualizerTransformationType" ADD VALUE IF NOT EXISTS 'SHOWER_TO_TUB';
ALTER TYPE "VisualizerTransformationType" ADD VALUE IF NOT EXISTS 'SHOWER_AND_TUB_DECK_WRAP';
