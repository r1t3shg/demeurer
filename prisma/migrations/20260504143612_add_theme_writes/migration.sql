-- CreateTable
CREATE TABLE "ThemeWrite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "pageId" TEXT,
    "writtenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ThemeWrite_shop_themeId_idx" ON "ThemeWrite"("shop", "themeId");

-- CreateIndex
CREATE INDEX "ThemeWrite_pageId_idx" ON "ThemeWrite"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeWrite_shop_themeId_path_key" ON "ThemeWrite"("shop", "themeId", "path");
