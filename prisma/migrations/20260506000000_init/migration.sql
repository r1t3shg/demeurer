-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "themeId" TEXT,
    "themeMismatch" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT,
    "productHandle" TEXT,
    "previousTemplateSuffix" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publish" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "themeName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "artifactSourceVersion" INTEGER NOT NULL,
    "failedPaths" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeWrite" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "pageId" TEXT,
    "writtenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeWrite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Page_shop_idx" ON "Page"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Page_shop_handle_key" ON "Page"("shop", "handle");

-- CreateIndex
CREATE INDEX "PageVersion_pageId_idx" ON "PageVersion"("pageId");

-- CreateIndex
CREATE INDEX "Publish_pageId_createdAt_idx" ON "Publish"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "Publish_shop_idx" ON "Publish"("shop");

-- CreateIndex
CREATE INDEX "ThemeWrite_shop_themeId_idx" ON "ThemeWrite"("shop", "themeId");

-- CreateIndex
CREATE INDEX "ThemeWrite_pageId_idx" ON "ThemeWrite"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeWrite_shop_themeId_path_key" ON "ThemeWrite"("shop", "themeId", "path");

-- AddForeignKey
ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publish" ADD CONSTRAINT "Publish_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

