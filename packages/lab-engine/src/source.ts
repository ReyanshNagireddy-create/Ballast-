import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export interface SourceFile {
  /** Repo-relative path, always with forward slashes. */
  path: string;
  text: string;
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".netlify",
  "dist",
  "build",
  "out",
  "coverage",
  ".cache",
  "vendor",
  "__pycache__",
]);

const READ_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".md"];

/** Files above this size are almost always generated; reading them buys nothing. */
const MAX_FILE_BYTES = 512 * 1024;

export interface ReadOptions {
  /** Stop after this many files. Keeps a runaway monorepo from stalling a run. */
  maxFiles?: number;
}

/**
 * Walk a project directory and return every source file worth analysing.
 *
 * Deliberately dependency-free: uploads arrive as arbitrary user code, and the
 * fewer moving parts between an untrusted ZIP and the analyser, the better.
 */
export async function readProjectFromDisk(
  root: string,
  options: ReadOptions = {},
): Promise<SourceFile[]> {
  const maxFiles = options.maxFiles ?? 4000;
  const files: SourceFile[] = [];

  async function walk(dir: string): Promise<void> {
    if (files.length >= maxFiles) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (entry.isDirectory()) continue;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!READ_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) continue;
      let size: number;
      try {
        size = (await stat(full)).size;
      } catch {
        continue;
      }
      if (size > MAX_FILE_BYTES) continue;
      let text: string;
      try {
        text = await readFile(full, "utf8");
      } catch {
        continue;
      }
      files.push({ path: toPosix(relative(root, full)), text });
    }
  }

  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

export function toPosix(path: string): string {
  return sep === "/" ? path : path.split(sep).join("/");
}

/** 1-based line number of a character offset. */
export function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}
