/**
 * Queue names and payload contracts shared between the web app (producer)
 * and the worker (consumer). Jobs ride on pg-boss, which stores its queue in
 * the same Postgres as the app — one less piece of infrastructure to run.
 */

export const QUEUES = {
  ingestCheck: "check-ingest",
  rehearsal: "rehearsal-run",
  retention: "retention-sweep",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Payload for `check-ingest`: expand a queued CheckRun's findings and finalize it. */
export interface IngestCheckPayload {
  checkRunId: string;
  /** Full engine Report (shape: @ballast/core Report). Stored transiently in the job. */
  report: {
    version: string;
    findings: Array<{
      ruleId: string;
      severity: string;
      category: string;
      message: string;
      why: string;
      fix: { summary: string; sql?: string; steps?: string[] } | null;
      file: string;
      line: number;
      statement: string;
    }>;
    summary: {
      files: number;
      statements: number;
      blockers: number;
      warnings: number;
      notices: number;
      score: number;
      grade: string;
      passed: boolean;
    };
  };
}

/** Payload for `rehearsal-run`: apply migration SQL to a scratch schema and time it. */
export interface RehearsalPayload {
  rehearsalId: string;
}

/** Payload for `retention-sweep`: no arguments; the job computes its own scope. */
export type RetentionPayload = Record<string, never>;
