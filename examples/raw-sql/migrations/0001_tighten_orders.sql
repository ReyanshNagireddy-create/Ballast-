-- A realistic hardening migration with deliberate suppressions.
SET lock_timeout = '5s';

-- Instant on new rows; validated separately below without blocking writes.
ALTER TABLE orders ADD CONSTRAINT orders_total_positive
  CHECK (total_cents >= 0) NOT VALID;

ALTER TABLE orders VALIDATE CONSTRAINT orders_total_positive;

-- This table was decommissioned in RFC-88; both app releases stopped
-- reading it two deploys ago. Deliberate, reviewed, suppressed:
-- ballast-ignore: no-drop-table
DROP TABLE orders_shadow_2019;
