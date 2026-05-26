CREATE TABLE "OperationalLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "source" VARCHAR(30),
    "metadata" JSONB NOT NULL,
    "ip" VARCHAR(120),
    "userAgent" VARCHAR(500),

    CONSTRAINT "OperationalLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OperationalLog"
ADD CONSTRAINT "OperationalLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "OperationalLog_createdAt_idx" ON "OperationalLog"("createdAt");
CREATE INDEX "OperationalLog_userId_createdAt_idx" ON "OperationalLog"("userId", "createdAt");
CREATE INDEX "OperationalLog_action_createdAt_idx" ON "OperationalLog"("action", "createdAt");
CREATE INDEX "OperationalLog_entityType_entityId_createdAt_idx" ON "OperationalLog"("entityType", "entityId", "createdAt");
CREATE INDEX "OperationalLog_source_createdAt_idx" ON "OperationalLog"("source", "createdAt");
