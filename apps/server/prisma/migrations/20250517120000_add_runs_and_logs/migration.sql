-- CreateTable
CREATE TABLE "article_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feed_id" TEXT NOT NULL,
    "start_time" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "articles_processed" INTEGER NOT NULL DEFAULT 0,
    "articles_success" INTEGER NOT NULL DEFAULT 0,
    "articles_failed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT
);

-- CreateTable
CREATE TABLE "extraction_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_type" TEXT,
    "error_msg" TEXT,
    "quality_score" REAL,
    "content_length" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
