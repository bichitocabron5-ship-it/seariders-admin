CREATE TYPE "OperationalOverrideTarget" AS ENUM ('RESERVATION', 'MONITOR_RUN');
CREATE TYPE "OperationalOverrideAction" AS ENUM ('FORCE_READY', 'FORCE_DEPART', 'FORCE_CLOSE_RUN');

CREATE TABLE "OperationalOverrideLog" (
    "id" TEXT NOT NULL,
    "targetType" "OperationalOverrideTarget" NOT NULL,
    "action" "OperationalOverrideAction" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "payloadJson" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalOverrideLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalOverrideLog_targetType_targetId_createdAt_idx" ON "OperationalOverrideLog"("targetType", "targetId", "createdAt");
CREATE INDEX "OperationalOverrideLog_action_createdAt_idx" ON "OperationalOverrideLog"("action", "createdAt");
CREATE INDEX "OperationalOverrideLog_createdByUserId_createdAt_idx" ON "OperationalOverrideLog"("createdByUserId", "createdAt");

ALTER TABLE "OperationalOverrideLog"
ADD CONSTRAINT "OperationalOverrideLog_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
