-- AlterTable: Add missing columns to articles table
ALTER TABLE "articles" ADD COLUMN "content" TEXT;
ALTER TABLE "articles" ADD COLUMN "author" TEXT;
ALTER TABLE "articles" ADD COLUMN "url" TEXT;
ALTER TABLE "articles" ADD COLUMN "status" INTEGER DEFAULT 0;
ALTER TABLE "articles" ADD COLUMN "quality_score" REAL DEFAULT 0;
