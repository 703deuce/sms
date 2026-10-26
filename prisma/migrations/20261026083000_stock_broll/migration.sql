-- CreateTable
CREATE TABLE "stock_assets" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorId" TEXT,
    "tags" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "durationS" DOUBLE PRECISION NOT NULL,
    "storageKey" TEXT,
    "thumbUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broll_search_cache" (
    "q" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broll_search_cache_pkey" PRIMARY KEY ("q")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_assets_provider_providerId_key" ON "stock_assets"("provider", "providerId");
