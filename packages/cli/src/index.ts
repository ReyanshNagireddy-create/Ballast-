#!/usr/bin/env node
import { Command, Option } from "commander";
import { runCheck, type OutputFormat } from "./commands/check.js";
import { runInit } from "./commands/init.js";
import { runRules } from "./commands/rules.js";

const VERSION = "0.4.0";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const program = new Command();

program
  .name("ballast")
  .description(
    "Catch dangerous Postgres migrations — locking hazards, table rewrites, downtime risks — before they reach production.",
  )
  .version(VERSION);

program
  .command("check", { isDefault: true })
  .description("Analyze migration files (auto-detects prisma/, db/migrate/, drizzle/, …)")
  .argument("[paths...]", "SQL files or directories to check")
  .option("-c, --config <path>", "path to ballast.config.json")
  .addOption(
    new Option("-f, --format <format>", "output format")
      .choices(["pretty", "json", "github"])
      .default("pretty"),
  )
  .addOption(
    new Option("--fail-on <severity>", "minimum severity that fails the check")
      .choices(["notice", "warning", "blocker"]),
  )
  .addOption(
    new Option("--preset <preset>", "migration tool preset").choices([
      "raw",
      "prisma",
      "django",
      "rails",
      "drizzle",
      "flyway",
      "goose",
      "golang-migrate",
    ]),
  )
  .option("--stdin", "read SQL from stdin instead of files")
  .option("--stdin-filename <name>", "filename to report for stdin input")
  .option("--upload", "upload the report to Ballast Cloud (needs BALLAST_API_KEY)")
  .option("--no-color", "disable colored output")
  .action(async (paths: string[], opts) => {
    const result = await runCheck(paths, {
      cwd: process.cwd(),
      configPath: opts.config,
      format: opts.format as OutputFormat,
      failOn: opts.failOn,
      preset: opts.preset,
      color: opts.color && process.stdout.isTTY !== false && !process.env.NO_COLOR,
      stdin: opts.stdin ? await readStdin() : undefined,
      stdinFilename: opts.stdinFilename,
      upload: opts.upload,
    });
    for (const note of result.notes) console.error(`ballast: ${note}`);
    console.log(result.output);
    process.exitCode = result.exitCode;
  });

program
  .command("init")
  .description("Create a ballast.config.json with a detected preset")
  .action(() => {
    const result = runInit(process.cwd());
    console.log(result.output);
    process.exitCode = result.exitCode;
  });

program
  .command("rules")
  .description("List all rules with their default severities")
  .option("--no-color", "disable colored output")
  .action((opts) => {
    console.log(
      runRules(opts.color && process.stdout.isTTY !== false && !process.env.NO_COLOR),
    );
  });

await program.parseAsync(process.argv);
