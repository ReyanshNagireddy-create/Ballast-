-- The migration Prisma generates when you add `plan String` to User and
-- an index on it. Perfectly correct SQL — and three production incidents.

-- Fails on any table with rows: NOT NULL with no DEFAULT.
ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL;

-- Blocks every write to "User" for the entire index build.
CREATE INDEX "User_plan_idx" ON "User"("plan");

-- Validates all rows while locking BOTH tables against writes.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id");
