CREATE TABLE IF NOT EXISTS "MotionStudioVoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'elevenlabs',
  "voiceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sampleUploadId" TEXT,
  "previewUrl" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MotionStudioVoice_workspaceId_userId_provider_voiceId_key"
 ON "MotionStudioVoice"("workspaceId","userId","provider","voiceId");
CREATE INDEX IF NOT EXISTS "MotionStudioVoice_workspaceId_userId_isDefault_idx"
 ON "MotionStudioVoice"("workspaceId","userId","isDefault");
CREATE UNIQUE INDEX IF NOT EXISTS "MotionStudioVoice_one_default_idx"
 ON "MotionStudioVoice"("workspaceId","userId") WHERE "isDefault" = TRUE;

CREATE TABLE IF NOT EXISTS "MotionStudioStockVoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voiceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "gender" TEXT,
  "accent" TEXT,
  "previewUrl" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MotionStudioStockVoice_voiceId_key" ON "MotionStudioStockVoice"("voiceId");
INSERT INTO "MotionStudioStockVoice"
  ("id","voiceId","name","description","gender","accent","previewUrl","sortOrder")
 VALUES
 ('mssv_01','gOupLcAkjEnguROwi4oS','Darian','Warm grounded storyteller','male','American','',0),
  ('mssv_02','OZ0L6eISlOejga3XjDFt','Talia','Warm soft guide','female','American','',1),
  ('mssv_03','WQP7cQUF5aAS6Axh5yaa','Elara','Crisp pro narrator','female','American','',2),
  ('mssv_04','jSuBIjxMKhqIfb0wCK1F','Baxter','Dry calm Aussie','male','Australian','',3),
  ('mssv_05','6WwXjDDEMyNmFG95zycZ','Eldrin','Crisp British baritone','male','British','',4),
  ('mssv_06','dvbL7qkNGZY1IqPGZAjM','Elowen','Upbeat modern narrator','female','British','',5),
  ('mssv_07','ktkP7Nsj67dw2zcplQYt','Lawrence','Bright and informative','male','American','',6),
  ('mssv_08','BFd5oBc2DDna33pSi4Gf','Alicia','Polished global anchor','female','International','',7),
  ('mssv_09','QtY3JBOUKEB5xzrRfOKc','Maisie','Friendly casual neighbor','female','American','',8),
  ('mssv_10','7QN34D2r3hCNwbOYIeK0','Warren','Effortless and cool','male','American','',9),
  ('mssv_11','g7LVvkPWALzPxOQbF6OE','Jade','Upbeat and natural','female','American','',10),
  ('mssv_12','AaOhDHYJ1XLZk74lXhdE','Caleb','Trusted guide','male','American','',11),
  ('mssv_13','8dEUmyPMdDdK91vboYih','Sawyer','Midnight storyteller','male','American','',12),
  ('mssv_14','22N9cF8z0o7y23njdyaY','Florence','Atmospheric storyteller','female','British','',13)
 ON CONFLICT ("voiceId") DO NOTHING;
