-- AI Producer fix1: multi-output project ids
ALTER TABLE "ai_producer_agent_runs" ADD COLUMN IF NOT EXISTS "outputProjectIds" JSONB NOT NULL DEFAULT '[]';
