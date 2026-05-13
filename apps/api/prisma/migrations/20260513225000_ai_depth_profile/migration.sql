ALTER TABLE "Subscription"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN "nextExpectedAt" TIMESTAMP(3),
ADD COLUMN "note" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'statement';

CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

CREATE TABLE "DecisionEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "simulationId" TEXT NOT NULL,
  "scenarioId" TEXT NOT NULL,
  "userAction" TEXT NOT NULL,
  "originalAmount" DECIMAL(65,30) NOT NULL,
  "finalAmount" DECIMAL(65,30),
  "categoryId" TEXT,
  "categoryName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DecisionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DecisionEvent_userId_createdAt_idx" ON "DecisionEvent"("userId", "createdAt");
CREATE INDEX "DecisionEvent_simulationId_idx" ON "DecisionEvent"("simulationId");

ALTER TABLE "DecisionEvent"
ADD CONSTRAINT "DecisionEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DecisionEvent"
ADD CONSTRAINT "DecisionEvent_simulationId_fkey"
FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
