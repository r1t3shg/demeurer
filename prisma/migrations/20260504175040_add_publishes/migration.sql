-- CreateTable
CREATE TABLE "Publish" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "themeName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileCount" INTEGER NOT NULL,
    "artifactSourceVersion" INTEGER NOT NULL,
    "failedPaths" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Publish_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Publish_pageId_createdAt_idx" ON "Publish"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "Publish_shop_idx" ON "Publish"("shop");
