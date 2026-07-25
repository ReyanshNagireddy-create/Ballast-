import { readProjectFromDisk, type SourceFile } from "@productlab/engine";
import { join } from "node:path";

/**
 * The bundled sample project.
 *
 * `examples/expense-tracker` is a real (small) Next.js app with real problems:
 * an icon-only sidebar, a seven-field signup form, a feature nothing links to.
 * It exists so the demo shows the product working on something, rather than on
 * a hand-written report that would always look good.
 */
export const DEMO_PROJECT_NAME = "Expense Tracker (sample)";

let cached: SourceFile[] | null = null;

export async function loadDemoProject(): Promise<SourceFile[]> {
  if (cached) return cached;
  // apps/lab → repo root → examples/expense-tracker
  const root = join(process.cwd(), "..", "..", "examples", "expense-tracker");
  const files = await readProjectFromDisk(root);
  cached = files;
  return files;
}
