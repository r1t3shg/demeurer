-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "publishedAt" DATETIME,
    "themeId" TEXT,
    "themeMismatch" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Page" ("createdAt", "handle", "id", "publishedAt", "shop", "source", "themeId", "title", "type", "updatedAt") SELECT "createdAt", "handle", "id", "publishedAt", "shop", "source", "themeId", "title", "type", "updatedAt" FROM "Page";
DROP TABLE "Page";
ALTER TABLE "new_Page" RENAME TO "Page";
CREATE INDEX "Page_shop_idx" ON "Page"("shop");
CREATE UNIQUE INDEX "Page_shop_handle_key" ON "Page"("shop", "handle");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
