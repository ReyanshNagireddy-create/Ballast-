import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MigrationTool } from "@ballast/core";

const DETECTION: Array<{ preset: MigrationTool; marker: string }> = [
  { preset: "prisma", marker: "prisma/migrations" },
  { preset: "rails", marker: "db/migrate" },
  { preset: "drizzle", marker: "drizzle" },
  { preset: "django", marker: "manage.py" },
];

export interface InitResult {
  output: string;
  exitCode: 0 | 2;
}

export function runInit(cwd: string): InitResult {
  const target = join(cwd, "ballast.config.json");
  if (existsSync(target)) {
    return { output: "ballast.config.json already exists.", exitCode: 2 };
  }
  let preset: MigrationTool = "raw";
  for (const { preset: p, marker } of DETECTION) {
    if (existsSync(join(cwd, marker))) {
      preset = p;
      break;
    }
  }
  const config = {
    $schema: "https://ballast.dev/schema/config.json",
    preset,
    pgVersion: 15,
    failOn: "blocker",
    rules: {},
    ignore: [],
  };
  writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);
  return {
    output: `Wrote ballast.config.json (preset: ${preset}). Run: ballast check`,
    exitCode: 0,
  };
}
