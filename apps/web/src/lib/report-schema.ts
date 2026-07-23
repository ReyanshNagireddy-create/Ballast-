import { z } from "zod";

/** Zod mirror of @ballast/core's Report — validates CLI/API uploads. */
export const findingSchema = z.object({
  ruleId: z.string().max(100),
  severity: z.enum(["notice", "warning", "blocker"]),
  category: z.string().max(40),
  message: z.string().max(2000),
  why: z.string().max(4000),
  fix: z
    .object({
      summary: z.string().max(500),
      sql: z.string().max(4000).optional(),
      steps: z.array(z.string().max(1000)).max(10).optional(),
    })
    .nullable(),
  file: z.string().max(500),
  line: z.number().int().min(1),
  statement: z.string().max(500),
});

export const reportSchema = z.object({
  version: z.string().max(20),
  findings: z.array(findingSchema).max(2000),
  summary: z.object({
    files: z.number().int().min(0),
    statements: z.number().int().min(0),
    blockers: z.number().int().min(0),
    warnings: z.number().int().min(0),
    notices: z.number().int().min(0),
    score: z.number().int().min(0).max(100),
    grade: z.enum(["A", "B", "C", "D", "F"]),
    passed: z.boolean(),
  }),
});

export const checkUploadSchema = z.object({
  report: reportSchema,
  meta: z
    .object({
      branch: z.string().max(300).nullable().optional(),
      commit: z.string().max(64).nullable().optional(),
      repository: z.string().max(300).nullable().optional(),
      runUrl: z.string().url().max(500).nullable().optional(),
    })
    .optional(),
});

export type CheckUpload = z.infer<typeof checkUploadSchema>;
