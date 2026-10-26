-- GPT Live / OpenAI file_search vector stores for Voice V3 knowledge (not Telnyx RAG).
ALTER TABLE "voice_knowledge_bases"
ADD COLUMN IF NOT EXISTS "openaiVectorStoreId" TEXT,
ADD COLUMN IF NOT EXISTS "openaiVectorStoreStatus" TEXT;

ALTER TABLE "voice_knowledge_sources"
ADD COLUMN IF NOT EXISTS "openaiFileId" TEXT;
