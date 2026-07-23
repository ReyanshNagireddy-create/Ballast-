import type { Rule } from "../types.js";
import {
  noAddColumnNotNullNoDefault,
  noColumnTypeChange,
  noSetNotNull,
  noVolatileDefault,
} from "./columns.js";
import {
  noDropColumn,
  noDropTable,
  noRenameColumn,
  noRenameTable,
} from "./compat.js";
import {
  noBlockingUniqueConstraint,
  requireNotValidCheck,
  requireNotValidForeignKey,
} from "./constraints.js";
import { requireLockTimeout } from "./file.js";
import {
  noConcurrentIndexInTransaction,
  requireConcurrentIndexCreation,
  requireConcurrentIndexDrop,
} from "./indexes.js";
import {
  noBlockingMaintenance,
  noDestructiveData,
  noEnumAddValueInTransaction,
} from "./maintenance.js";

/** Every built-in rule, in stable documentation order. */
export const ALL_RULES: Rule[] = [
  requireConcurrentIndexCreation,
  requireConcurrentIndexDrop,
  noConcurrentIndexInTransaction,
  noAddColumnNotNullNoDefault,
  noVolatileDefault,
  noColumnTypeChange,
  noSetNotNull,
  requireNotValidForeignKey,
  requireNotValidCheck,
  noBlockingUniqueConstraint,
  noRenameColumn,
  noRenameTable,
  noDropColumn,
  noDropTable,
  noBlockingMaintenance,
  noDestructiveData,
  noEnumAddValueInTransaction,
  requireLockTimeout,
];

export const RULES_BY_ID: ReadonlyMap<string, Rule> = new Map(
  ALL_RULES.map((r) => [r.meta.id, r]),
);
