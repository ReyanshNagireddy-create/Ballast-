-- The same change, rewritten the way Ballast suggests. Score: 100.

-- Fail fast instead of queueing traffic behind a blocked lock.
SET lock_timeout = '5s';

-- Metadata-only on Postgres 11+: NOT NULL is fine when a DEFAULT exists.
ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';

-- Builds without blocking writes. Prisma runs migrations without a wrapping
-- transaction, so CONCURRENTLY is allowed here.
CREATE INDEX CONCURRENTLY "User_plan_idx" ON "User"("plan");

-- Instant: applies to new rows only; validation happens separately below
-- under a much weaker lock that doesn't block writes.
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") NOT VALID;

ALTER TABLE "Subscription" VALIDATE CONSTRAINT "Subscription_userId_fkey";
