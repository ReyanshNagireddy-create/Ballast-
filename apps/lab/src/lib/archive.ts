import { gunzipSync, inflateRawSync } from "node:zlib";
import type { SourceFile } from "@productlab/engine";

/**
 * Archive readers for uploaded projects.
 *
 * Written against the container formats directly rather than pulling in a
 * dependency, because everything that arrives here is untrusted user code: the
 * fewer parsers in the path, the smaller the surface. Both readers are bounded
 * on entry count, entry size, and total size, and both refuse paths that try to
 * escape the extraction root.
 */

const READ_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".css", ".md"];
const MAX_ENTRIES = 6_000;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

const SKIP_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".turbo",
  "vendor",
]);

export class ArchiveError extends Error {}

/** Whether this path is worth keeping, and safe to keep. */
function wanted(path: string): boolean {
  if (path.endsWith("/")) return false;
  if (path.includes("..")) return false; // zip-slip
  if (path.startsWith("/")) return false;
  const segments = path.split("/");
  if (segments.some((s) => SKIP_SEGMENTS.has(s))) return false;
  if (segments.some((s) => s.startsWith("._") || s === "__MACOSX")) return false;
  return READ_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/** Drop the single wrapper directory that archives are usually built around. */
export function stripCommonPrefix(files: SourceFile[]): SourceFile[] {
  if (files.length === 0) return files;
  const first = files[0]!.path.split("/")[0];
  if (!first) return files;
  if (!files.every((f) => f.path.startsWith(`${first}/`))) return files;
  return files.map((f) => ({ ...f, path: f.path.slice(first.length + 1) }));
}

/* ─────────────────────────────────── zip ───────────────────────────────── */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/**
 * Read a ZIP via its central directory.
 *
 * The central directory is the only trustworthy index — local headers may
 * declare zero sizes and defer them to a trailing data descriptor.
 */
export function readZip(buffer: Buffer): SourceFile[] {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd === -1) throw new ArchiveError("Not a ZIP file, or the archive is truncated.");

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (entryCount > MAX_ENTRIES) {
    throw new ArchiveError(`Archive has ${entryCount} entries; the limit is ${MAX_ENTRIES}.`);
  }

  const files: SourceFile[] = [];
  let totalBytes = 0;

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buffer.length) break;
    if (buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (!wanted(name)) continue;
    if (uncompressedSize > MAX_FILE_BYTES) continue;
    totalBytes += uncompressedSize;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new ArchiveError("Archive expands to more than 40 MB of source; upload a smaller project.");
    }

    const content = readLocalEntry(buffer, localOffset, method, compressedSize);
    if (content === null) continue;
    files.push({ path: name, text: content });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return stripCommonPrefix(files);
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  // The EOCD sits at the end, after a comment of up to 64 KB.
  const start = Math.max(0, buffer.length - 66_000);
  for (let i = buffer.length - 22; i >= start; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

function readLocalEntry(
  buffer: Buffer,
  localOffset: number,
  method: number,
  compressedSize: number,
): string | null {
  if (localOffset + 30 > buffer.length) return null;
  const nameLength = buffer.readUInt16LE(localOffset + 26);
  const extraLength = buffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + compressedSize);

  try {
    if (method === 0) return data.toString("utf8");
    if (method === 8) return inflateRawSync(data).toString("utf8");
  } catch {
    return null;
  }
  return null; // an compression method we do not support
}

/* ────────────────────────────────── tar.gz ─────────────────────────────── */

/**
 * Read a gzipped tar — the format GitHub serves repository archives in.
 *
 * Tar is 512-byte header blocks followed by padded content blocks. Only regular
 * files are read; symlinks and devices are skipped rather than followed.
 */
export function readTarGz(buffer: Buffer): SourceFile[] {
  let tar: Buffer;
  try {
    tar = gunzipSync(buffer);
  } catch {
    throw new ArchiveError("Could not decompress the archive.");
  }

  const files: SourceFile[] = [];
  let offset = 0;
  let totalBytes = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    // Two consecutive zero blocks mark the end of the archive.
    if (header.every((byte) => byte === 0)) break;

    const name = header.toString("utf8", 0, 100).replace(/\0.*$/, "");
    const sizeField = header.toString("utf8", 124, 136).replace(/\0.*$/, "").trim();
    const size = parseInt(sizeField, 8) || 0;
    const typeFlag = String.fromCharCode(header[156] ?? 0);
    const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "");
    const fullName = prefix ? `${prefix}/${name}` : name;

    const dataStart = offset + 512;
    offset = dataStart + Math.ceil(size / 512) * 512;

    // "0" and "\0" are regular files; everything else (dirs, links) is skipped.
    if (typeFlag !== "0" && typeFlag !== "\0") continue;
    if (!wanted(fullName)) continue;
    if (size > MAX_FILE_BYTES) continue;

    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new ArchiveError("Repository expands to more than 40 MB of source.");
    }
    if (files.length >= MAX_ENTRIES) break;

    files.push({ path: fullName, text: tar.toString("utf8", dataStart, dataStart + size) });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return stripCommonPrefix(files);
}

/* ────────────────────────────────── github ─────────────────────────────── */

const REPO_RE = /^([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)$/;

/** Accept a repo URL or an owner/name pair, and return the normalised pair. */
export function parseRepo(input: string): { owner: string; name: string } | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const fromUrl = /github\.com\/([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+)/.exec(trimmed);
  const slug = fromUrl ? `${fromUrl[1]}/${fromUrl[2]}` : trimmed;
  const match = REPO_RE.exec(slug);
  if (!match) return null;
  return { owner: match[1]!, name: match[2]! };
}

/** Download a public repository's source at `ref` and read it into memory. */
export async function fetchGithubRepo(
  repo: string,
  ref = "HEAD",
): Promise<{ files: SourceFile[]; repo: string; ref: string }> {
  const parsed = parseRepo(repo);
  if (!parsed) {
    throw new ArchiveError(`"${repo}" is not a GitHub repository. Use owner/name or a repo URL.`);
  }
  const slug = `${parsed.owner}/${parsed.name}`;
  const url = `https://codeload.github.com/${slug}/tar.gz/${encodeURIComponent(ref)}`;

  const response = await fetch(url, {
    headers: { "user-agent": "ai-product-lab" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new ArchiveError(
      response.status === 404
        ? `Could not find ${slug} at ${ref}. Private repositories are not supported yet.`
        : `GitHub returned ${response.status} for ${slug}.`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const files = readTarGz(buffer);
  if (files.length === 0) {
    throw new ArchiveError(`${slug} contains no JavaScript or TypeScript source to analyse.`);
  }
  return { files, repo: slug, ref };
}
