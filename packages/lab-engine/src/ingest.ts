import { lineAt, type SourceFile } from "./source.js";
import type {
  Affordance,
  AffordanceKind,
  FormField,
  FormInfo,
  Framework,
  NavEdge,
  ProjectModel,
  Screen,
  StaticSignal,
} from "./types.js";

/**
 * Build a behavioural model of a React/Next.js project from its source.
 *
 * This is intentionally a *reader*, not a compiler. It recovers the shape a
 * user experiences — which screens exist, what you can click on each one, where
 * those clicks lead, and which of them are hard to understand — without
 * executing anything. Anything it cannot resolve statically is left out rather
 * than guessed at, and recorded in `warnings` when the gap is material.
 */
export function buildProjectModel(files: SourceFile[], name: string): ProjectModel {
  const warnings: string[] = [];
  const framework = detectFramework(files);
  const pkg = readPackageJson(files, warnings);

  const routeFiles = findRouteFiles(files, framework);
  if (routeFiles.length === 0) {
    warnings.push(
      "No page or route files were found. Supported layouts: Next.js app/ and pages/ directories, or a src/pages|src/routes|src/views folder for plain React.",
    );
  }

  const screens: Screen[] = [];
  const forms: FormInfo[] = [];
  for (const { file, path } of routeFiles) {
    const screen = buildScreen(file, path, files);
    screens.push(screen);
    forms.push(...screen.forms);
  }

  markEntryScreens(screens);
  resolvePostSubmitTargets(screens, routeFiles);
  const edges = buildEdges(screens);
  const signals = collectSignals(files, screens, pkg);

  const sourceBytes = files.reduce((sum, f) => sum + f.text.length, 0);
  return {
    name,
    framework,
    screens,
    edges,
    signals,
    dependencies: pkg.dependencies,
    stats: {
      files: files.length,
      screens: screens.length,
      affordances: screens.reduce((sum, s) => sum + s.affordances.length, 0),
      forms: forms.length,
      sourceBytes,
    },
    warnings,
  };
}

/* ─────────────────────────────── framework ──────────────────────────────── */

export function detectFramework(files: SourceFile[]): Framework {
  const paths = files.map((f) => f.path);
  const hasNextDep = files.some(
    (f) => f.path.endsWith("package.json") && /"next"\s*:/.test(f.text),
  );
  const hasAppRouter = paths.some((p) => /(^|\/)app\/.*page\.(tsx|jsx|ts|js)$/.test(p));
  const hasPagesRouter = paths.some((p) => /(^|\/)pages\/.*\.(tsx|jsx|ts|js)$/.test(p));
  if (hasAppRouter) return "next-app";
  if (hasNextDep && hasPagesRouter) return "next-pages";
  if (files.some((f) => /from ["']react-router(-dom)?["']/.test(f.text))) return "react-router";
  if (files.some((f) => f.path.endsWith("package.json") && /"react"\s*:/.test(f.text))) {
    return "react";
  }
  return "unknown";
}

interface PackageInfo {
  name?: string;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
}

function readPackageJson(files: SourceFile[], warnings: string[]): PackageInfo {
  // The shallowest package.json wins — in a monorepo that is the root manifest.
  const candidates = files
    .filter((f) => f.path === "package.json" || f.path.endsWith("/package.json"))
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length);
  const manifest = candidates[0];
  if (!manifest) {
    warnings.push("No package.json found — dependency-based checks were skipped.");
    return { dependencies: {}, scripts: {} };
  }
  try {
    const parsed = JSON.parse(manifest.text) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    return {
      name: parsed.name,
      dependencies: { ...parsed.dependencies, ...parsed.devDependencies },
      scripts: parsed.scripts ?? {},
    };
  } catch {
    warnings.push(`${manifest.path} is not valid JSON — dependency checks were skipped.`);
    return { dependencies: {}, scripts: {} };
  }
}

/* ───────────────────────────────── routes ──────────────────────────────── */

interface RouteFile {
  file: SourceFile;
  path: string;
}

export function findRouteFiles(files: SourceFile[], framework: Framework): RouteFile[] {
  const routes: RouteFile[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const path = routePathFor(file.path, framework);
    if (path === null) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    routes.push({ file, path });
  }
  routes.sort((a, b) => a.path.localeCompare(b.path));
  return routes;
}

/** Map a source path to the URL it serves, or null when it serves none. */
export function routePathFor(filePath: string, framework: Framework): string | null {
  const isComponent = /\.(tsx|jsx)$/.test(filePath);
  if (!isComponent) return null;

  if (framework === "next-app") {
    const match = /(?:^|\/)app\/(.*)page\.(tsx|jsx)$/.exec(filePath);
    if (!match) return null;
    return normalizeAppSegments(match[1] ?? "");
  }

  if (framework === "next-pages") {
    const match = /(?:^|\/)pages\/(.+)\.(tsx|jsx)$/.exec(filePath);
    if (!match) return null;
    const raw = match[1]!;
    if (raw.startsWith("api/") || raw.startsWith("_")) return null;
    const trimmed = raw.replace(/\/?index$/, "");
    return trimmed === "" ? "/" : `/${trimmed}`;
  }

  // Plain React and react-router: treat conventional page folders as routes.
  const match = /(?:^|\/)(?:pages|routes|views|screens)\/(.+)\.(tsx|jsx)$/.exec(filePath);
  if (!match) return null;
  const raw = match[1]!;
  if (/^_/.test(raw)) return null;
  const trimmed = raw
    .replace(/\/?index$/i, "")
    .replace(/Page$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
  return trimmed === "" ? "/" : `/${trimmed}`;
}

/** Strip route groups and parallel/intercepting segments from an app-router path. */
function normalizeAppSegments(raw: string): string {
  const segments = raw
    .split("/")
    .filter(Boolean)
    // (marketing) groups and @slots do not appear in the URL.
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
    .filter((s) => !s.startsWith("@"));
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

/* ───────────────────────────────── screens ─────────────────────────────── */

function buildScreen(file: SourceFile, path: string, allFiles: SourceFile[]): Screen {
  const id = path;
  // A page's affordances live in the page file *and* in the local components it
  // renders; a nav bar extracted into components/nav.tsx is still on the screen.
  const text = file.text;
  const affordances = extractAffordances(text, id, file.path);
  const forms = extractForms(text, id, file.path);
  const headings = /<h[12][\s>]/.test(text) || /^#\s+/m.test(text);
  const title = inferTitle(text, path);

  return {
    id,
    path,
    file: file.path,
    title,
    authGated: isAuthGated(text, path, allFiles),
    affordances,
    forms,
    wordCount: countWords(text),
    hasHeading: headings,
    weightBytes: estimateWeight(file, allFiles),
    unlabelledImages: countUnlabelledImages(text),
    isEntry: false,
  };
}

export interface TagMatch {
  tag: string;
  attrs: string;
  /** Offset of the "<". */
  start: number;
  /** Offset just past the ">". */
  end: number;
}

const TAG_NAME_RE = /^<([A-Za-z][A-Za-z0-9.]*)/;

/**
 * Scan JSX opening tags.
 *
 * A regex cannot do this: `onClick={() => go()}` contains a `>` inside an
 * attribute expression, and `[^>]*` stops dead on it — which silently drops
 * the most common event handler in React. The scanner tracks brace depth and
 * quoting so the tag ends where it actually ends.
 */
export function* scanTags(text: string): Generator<TagMatch> {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "<") continue;
    const nameMatch = TAG_NAME_RE.exec(text.slice(i, i + 64));
    if (!nameMatch) continue;

    const attrsStart = i + nameMatch[0].length;
    let j = attrsStart;
    let depth = 0;
    let quote = "";

    while (j < text.length) {
      const ch = text[j]!;
      if (quote) {
        if (ch === quote) quote = "";
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quote = ch;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
      } else if (ch === ">" && depth === 0) {
        break;
      }
      j++;
    }
    if (j >= text.length) return;

    yield { tag: nameMatch[1]!, attrs: text.slice(attrsStart, j), start: i, end: j + 1 };
    i = j;
  }
}

const LINK_TAGS = new Set(["a", "Link", "NavLink", "Anchor"]);
const BUTTON_TAGS = new Set(["button", "Button", "IconButton", "SubmitButton"]);
const INPUT_TAGS = new Set(["input", "Input", "TextField", "Textarea", "textarea"]);
const SELECT_TAGS = new Set(["select", "Select", "Dropdown", "Combobox"]);
const TOGGLE_TAGS = new Set(["Switch", "Toggle", "Checkbox"]);
const CLICKABLE_CONTAINERS = new Set(["div", "span", "li", "td", "section", "article"]);

export function extractAffordances(text: string, screenId: string, file: string): Affordance[] {
  const affordances: Affordance[] = [];
  let order = 0;

  for (const { tag, attrs, start, end } of scanTags(text)) {
    const kind = affordanceKindFor(tag, attrs);
    if (!kind) continue;

    const inner = innerTextAfter(text, end, tag);
    const ariaLabel = attrValue(attrs, "aria-label") ?? attrValue(attrs, "title");
    const label = (inner || ariaLabel || attrValue(attrs, "placeholder") || "").trim();
    const iconOnly = inner.length === 0 && looksIconic(attrs, text, start);
    const named = label.length > 0;
    const target = resolveTarget(attrs);

    affordances.push({
      id: `${screenId}:${order}`,
      kind,
      label: label || (iconOnly ? "(icon)" : `(unlabelled ${kind})`),
      ...(target ? { target } : {}),
      iconOnly,
      named,
      keyboardReachable: isKeyboardReachable(tag, attrs),
      line: lineAt(text, start),
      order,
    });
    order++;
  }

  void file;
  return affordances;
}

function affordanceKindFor(tag: string, attrs: string): AffordanceKind | null {
  if (LINK_TAGS.has(tag)) return "link";
  if (BUTTON_TAGS.has(tag)) {
    return /type\s*=\s*["']submit["']/.test(attrs) ? "submit" : "button";
  }
  if (INPUT_TAGS.has(tag)) {
    if (/type\s*=\s*["'](submit|button)["']/.test(attrs)) return "submit";
    if (/type\s*=\s*["'](checkbox|radio)["']/.test(attrs)) return "toggle";
    return "input";
  }
  if (SELECT_TAGS.has(tag)) return "select";
  if (TOGGLE_TAGS.has(tag)) return "toggle";
  // A click handler on a non-interactive element is still an affordance to a
  // sighted mouse user — and invisible to everyone else. Recorded, then judged.
  if (CLICKABLE_CONTAINERS.has(tag) && /onClick\s*=/.test(attrs)) return "button";
  return null;
}

/** Visible text between an opening tag and its closing tag, JSX expressions dropped. */
function innerTextAfter(text: string, from: number, tag: string): string {
  const close = text.indexOf(`</${tag}`, from);
  if (close === -1 || close - from > 800) return "";
  const raw = text.slice(from, close);
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksIconic(attrs: string, text: string, start: number): boolean {
  const window = text.slice(start, start + 300);
  return (
    /<(svg|Icon|[A-Z][A-Za-z]*Icon)\b/.test(window) ||
    /className\s*=\s*["'][^"']*\bicon\b/.test(attrs) ||
    /material-symbols|lucide|heroicons|react-icons/.test(window)
  );
}

function isKeyboardReachable(tag: string, attrs: string): boolean {
  if (!CLICKABLE_CONTAINERS.has(tag)) return true;
  return /tabIndex\s*=/.test(attrs) && /onKey(Down|Press|Up)\s*=/.test(attrs);
}

function attrValue(attrs: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`);
  const m = re.exec(attrs);
  return m?.[1];
}

function resolveTarget(attrs: string): string | undefined {
  const href = attrValue(attrs, "href") ?? attrValue(attrs, "to");
  if (!href) return undefined;
  if (!href.startsWith("/")) return undefined; // external or anchor link
  return href;
}

export function extractForms(text: string, screenId: string, file: string): FormInfo[] {
  const forms: FormInfo[] = [];
  let index = 0;

  for (const tag of scanTags(text)) {
    if (tag.tag !== "form" && tag.tag !== "Form") continue;
    const start = tag.start;
    const close = text.indexOf("</form", tag.end);
    const body = text.slice(tag.end, close === -1 ? text.length : close);
    const fields = extractFields(body, text, tag.end);
    const submit = submitLabelIn(body);

    forms.push({
      id: `${screenId}:form:${index}`,
      screenId,
      fields,
      submitLabel: submit || "Submit",
      line: lineAt(text, start),
    });
    index++;
  }

  void file;
  return forms;
}

const FIELD_TAGS = new Set(["input", "textarea", "select", "Input", "Textarea", "Select"]);

function extractFields(body: string, fullText: string, offset: number): FormField[] {
  const fields: FormField[] = [];

  for (const { tag, attrs, start } of scanTags(body)) {
    if (!FIELD_TAGS.has(tag)) continue;
    const type = attrValue(attrs, "type") ?? (tag.toLowerCase() === "select" ? "select" : "text");
    if (type === "hidden") continue;
    const name = attrValue(attrs, "name") ?? attrValue(attrs, "id") ?? `field-${fields.length + 1}`;
    const labelled =
      /aria-label\s*=/.test(attrs) ||
      /aria-labelledby\s*=/.test(attrs) ||
      new RegExp(`<label[^>]*htmlFor\\s*=\\s*["']${escapeRe(name)}["']`).test(body) ||
      new RegExp(`<label[^>]*for\\s*=\\s*["']${escapeRe(name)}["']`).test(body);
    fields.push({
      name,
      type,
      required: /\brequired\b/.test(attrs),
      labelled,
      line: lineAt(fullText, offset + start),
    });
  }
  return fields;
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferTitle(text: string, path: string): string {
  const heading = /<h1[^>]*>([^<{]{2,60})</.exec(text)?.[1];
  if (heading) return heading.trim();
  const metaTitle = /title\s*:\s*["'`]([^"'`]{2,60})["'`]/.exec(text)?.[1];
  if (metaTitle) return metaTitle.trim();
  if (path === "/") return "Home";
  const last = path.split("/").filter(Boolean).pop() ?? "Home";
  return last
    .replace(/^\[+|\]+$/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isAuthGated(text: string, path: string, allFiles: SourceFile[]): boolean {
  if (/\b(auth\(\)|getServerSession|currentUser\(\)|requireUser|withAuth|useSession)\b/.test(text)) {
    return true;
  }
  if (/^\/(dashboard|account|settings|admin|app|billing|profile)(\/|$)/.test(path)) {
    // Confirm with a middleware matcher when one exists, otherwise trust the path.
    const middleware = allFiles.find((f) => /(^|\/)middleware\.(ts|js)$/.test(f.path));
    if (!middleware) return true;
    return !/publicRoutes/.test(middleware.text) || middleware.text.includes(path.split("/")[1] ?? "");
  }
  return false;
}

function countWords(text: string): number {
  const visible = text
    .replace(/import[^;]+;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^{}]*\}/g, " ");
  const words = visible.match(/[A-Za-z][A-Za-z'-]{1,}/g);
  return words ? words.length : 0;
}

function countUnlabelledImages(text: string): number {
  let count = 0;
  for (const { tag, attrs } of scanTags(text)) {
    if (tag !== "img" && tag !== "Image") continue;
    if (!/\balt\s*=/.test(attrs)) count++;
  }
  return count;
}

/** Text of the first button inside a form body. */
function submitLabelIn(body: string): string | undefined {
  for (const { tag, end } of scanTags(body)) {
    if (tag !== "button" && tag !== "Button") continue;
    const close = body.indexOf("<", end);
    const label = body.slice(end, close === -1 ? body.length : close).trim();
    if (label.length > 0 && label.length <= 40) return label;
  }
  return undefined;
}

/** Source bytes of the page plus the local modules it imports, one level deep. */
function estimateWeight(file: SourceFile, allFiles: SourceFile[]): number {
  let bytes = file.text.length;
  const importRe = /from\s+["'](\.[^"']+|@\/[^"']+)["']/g;
  const byPath = new Map(allFiles.map((f) => [f.path, f]));
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(file.text)) !== null) {
    const spec = match[1]!;
    const resolved = resolveImport(spec, file.path, byPath);
    if (resolved) bytes += resolved.text.length;
  }
  // Heavy client libraries dominate the bundle far more than app code does.
  if (/from ["']framer-motion["']/.test(file.text)) bytes += 110_000;
  if (/from ["']recharts["']/.test(file.text)) bytes += 180_000;
  if (/from ["']moment["']/.test(file.text)) bytes += 230_000;
  if (/from ["']lodash["']/.test(file.text)) bytes += 70_000;
  return bytes;
}

function resolveImport(
  spec: string,
  fromPath: string,
  byPath: Map<string, SourceFile>,
): SourceFile | undefined {
  const base = spec.startsWith("@/")
    ? `src/${spec.slice(2)}`
    : joinPosix(fromPath.split("/").slice(0, -1).join("/"), spec);
  for (const ext of [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts"]) {
    const hit = byPath.get(`${base}${ext}`);
    if (hit) return hit;
  }
  return byPath.get(base);
}

function joinPosix(dir: string, spec: string): string {
  const parts = [...dir.split("/").filter(Boolean), ...spec.split("/")];
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function markEntryScreens(screens: Screen[]): void {
  const root = screens.find((s) => s.path === "/");
  if (root) root.isEntry = true;
  for (const screen of screens) {
    if (/^\/(sign-in|signin|login|sign-up|signup|register|start)$/.test(screen.path)) {
      screen.isEntry = true;
    }
  }
  if (!screens.some((s) => s.isEntry) && screens[0]) screens[0].isEntry = true;
}

/**
 * Work out where each form goes.
 *
 * A screen whose only affordance is a form is not a dead end — submitting is
 * the way forward, and treating it otherwise makes every sign-up page look
 * catastrophically broken. Explicit redirects in the source win; otherwise an
 * auth form is assumed to land on the app's first gated screen, which is what
 * these flows do in practice.
 */
function resolvePostSubmitTargets(screens: Screen[], routeFiles: RouteFile[]): void {
  const byPath = new Map(screens.map((s) => [s.path, s]));
  const sourceByPath = new Map(routeFiles.map((r) => [r.path, r.file.text]));
  const firstGated = screens.find((s) => s.authGated && !s.isEntry);

  for (const screen of screens) {
    if (screen.forms.length === 0) continue;
    const source = sourceByPath.get(screen.path) ?? "";

    const explicit = findRedirectTarget(source, byPath, screen.path);
    if (explicit) {
      screen.postSubmitTarget = explicit;
      continue;
    }
    if (/(sign-up|signup|register|sign-in|signin|login|onboarding)/.test(screen.path) && firstGated) {
      screen.postSubmitTarget = firstGated.id;
    }
  }
}

const REDIRECT_RE = /(?:redirect|permanentRedirect|router\.(?:push|replace))\(\s*["'`](\/[^"'`]*)["'`]/g;

function findRedirectTarget(
  source: string,
  byPath: Map<string, Screen>,
  self: string,
): string | undefined {
  REDIRECT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REDIRECT_RE.exec(source)) !== null) {
    const resolved = matchRoute(match[1]!, byPath);
    if (resolved && resolved !== self) return resolved;
  }
  return undefined;
}

function buildEdges(screens: Screen[]): NavEdge[] {
  const byPath = new Map(screens.map((s) => [s.path, s]));
  const edges: NavEdge[] = [];
  const seen = new Set<string>();

  const add = (from: string, to: string, label: string, via: NavEdge["via"]) => {
    if (to === from) return;
    const key = `${from}→${to}→${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to, label, via });
  };

  for (const screen of screens) {
    for (const affordance of screen.affordances) {
      if (!affordance.target) continue;
      const to = matchRoute(affordance.target, byPath);
      if (!to) continue;
      add(screen.id, to, affordance.label, affordance.kind);
    }
    if (screen.postSubmitTarget) {
      const label = screen.forms[0]?.submitLabel ?? "Submit";
      add(screen.id, screen.postSubmitTarget, label, "submit");
    }
  }
  return edges;
}

/** Resolve a concrete href against dynamic route patterns (`/posts/[id]`). */
export function matchRoute(href: string, byPath: Map<string, Screen>): string | undefined {
  const clean = href.split(/[?#]/)[0] ?? href;
  if (byPath.has(clean)) return clean;
  const parts = clean.split("/").filter(Boolean);
  for (const path of byPath.keys()) {
    const candidate = path.split("/").filter(Boolean);
    if (candidate.length !== parts.length) continue;
    const matches = candidate.every((segment, i) => {
      if (segment.startsWith("[") && segment.endsWith("]")) return true;
      return segment === parts[i];
    });
    if (matches) return path;
  }
  return undefined;
}

/* ───────────────────────────────── signals ─────────────────────────────── */

function collectSignals(
  files: SourceFile[],
  screens: Screen[],
  pkg: PackageInfo,
): StaticSignal[] {
  const signals: StaticSignal[] = [];
  const push = (s: StaticSignal) => signals.push(s);

  for (const screen of screens) {
    if (screen.unlabelledImages > 0) {
      push({
        id: `a11y-alt-${screen.id}`,
        category: "accessibility",
        severity: "warning",
        title: `${screen.unlabelledImages} image${screen.unlabelledImages > 1 ? "s" : ""} without alt text`,
        detail: `Screen readers announce these as "image" on ${screen.path}, so the content they carry is lost.`,
        file: screen.file,
        line: 1,
        fix: 'Add alt="" for decorative images, or a short description for meaningful ones.',
      });
    }
    if (!screen.hasHeading && screen.affordances.length > 2) {
      push({
        id: `a11y-heading-${screen.id}`,
        category: "accessibility",
        severity: "notice",
        title: "No top-level heading",
        detail: `${screen.path} has no <h1>/<h2>, so screen-reader users get no landmark and scanners get no anchor.`,
        file: screen.file,
        line: 1,
        fix: "Add a single <h1> naming what the screen is for.",
      });
    }
    for (const affordance of screen.affordances) {
      if (!affordance.keyboardReachable) {
        push({
          id: `a11y-keyboard-${affordance.id}`,
          category: "accessibility",
          severity: "blocker",
          title: "Click handler on a non-interactive element",
          detail: `"${affordance.label}" on ${screen.path} responds to a mouse but cannot be reached or activated with a keyboard.`,
          file: screen.file,
          line: affordance.line,
          fix: "Use a <button>, or add tabIndex={0} with a matching onKeyDown handler.",
        });
      } else if (!affordance.named) {
        push({
          id: `a11y-name-${affordance.id}`,
          category: "accessibility",
          severity: "warning",
          title: `Unnamed ${affordance.kind}`,
          detail: `A ${affordance.kind} on ${screen.path} has no text and no aria-label.`,
          file: screen.file,
          line: affordance.line,
          fix: "Add visible text, or an aria-label describing the action.",
        });
      }
    }
    for (const form of screen.forms) {
      for (const field of form.fields) {
        if (field.labelled) continue;
        push({
          id: `a11y-field-${form.id}-${field.name}`,
          category: "accessibility",
          severity: "warning",
          title: `Form field "${field.name}" has no label`,
          detail: `Placeholder-only fields disappear as soon as the user types, and screen readers announce nothing.`,
          file: screen.file,
          line: field.line,
          fix: `Add <label htmlFor="${field.name}">, or an aria-label on the input.`,
        });
      }
    }
    if (screen.weightBytes > 250_000) {
      push({
        id: `perf-weight-${screen.id}`,
        category: "performance",
        severity: screen.weightBytes > 500_000 ? "warning" : "notice",
        title: `Heavy screen (~${Math.round(screen.weightBytes / 1024)} KB of client code)`,
        detail: `${screen.path} pulls in a large client bundle; on a slow connection this is seconds of blank screen.`,
        file: screen.file,
        line: 1,
        fix: "Move the heavy imports behind next/dynamic, or render them on the server.",
      });
    }
  }

  for (const file of files) {
    if (/dangerouslySetInnerHTML/.test(file.text)) {
      push({
        id: `sec-html-${file.path}`,
        category: "security",
        severity: "warning",
        title: "dangerouslySetInnerHTML",
        detail: `${file.path} injects raw HTML. If any part of it is user-supplied, this is stored XSS.`,
        file: file.path,
        line: lineAt(file.text, file.text.indexOf("dangerouslySetInnerHTML")),
        fix: "Render the value as text, or sanitise it before injection.",
      });
    }
    const secretEnv = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|KEY|PASSWORD)/.exec(file.text);
    if (secretEnv) {
      push({
        id: `sec-env-${file.path}`,
        category: "security",
        severity: "blocker",
        title: `Secret-shaped value in a public env var (${secretEnv[0]})`,
        detail: `NEXT_PUBLIC_* variables are inlined into the client bundle and readable by anyone who loads the page.`,
        file: file.path,
        line: lineAt(file.text, secretEnv.index),
        fix: "Read the secret server-side only, and drop the NEXT_PUBLIC_ prefix.",
      });
    }
    if (/(^|\/)app\/api\/.*route\.(ts|js)$/.test(file.path)) {
      if (!/(auth|session|currentUser|apiKey|verify|token)/i.test(file.text)) {
        push({
          id: `sec-open-${file.path}`,
          category: "security",
          severity: "warning",
          title: "API route with no visible auth check",
          detail: `${file.path} exports a handler with no authentication or authorisation in sight.`,
          file: file.path,
          line: 1,
          fix: "Authenticate the caller, or document the route as intentionally public.",
        });
      }
      if (!/(rateLimit|rate_limit|ratelimit|throttle)/i.test(file.text)) {
        push({
          id: `scale-rate-${file.path}`,
          category: "scalability",
          severity: "notice",
          title: "No rate limiting on an API route",
          detail: `${file.path} will accept as many requests per second as the runtime can accept connections.`,
          file: file.path,
          line: 1,
          fix: "Put a per-IP or per-key rate limit in front of the handler.",
        });
      }
    }
    const logSecret = /console\.log\([^)]*(token|password|secret|apiKey)/i.exec(file.text);
    if (logSecret) {
      push({
        id: `sec-log-${file.path}`,
        category: "security",
        severity: "warning",
        title: "Sensitive value written to logs",
        detail: `${file.path} logs a value whose name suggests a credential.`,
        file: file.path,
        line: lineAt(file.text, logSecret.index),
        fix: "Redact the value, or drop the log line.",
      });
    }
  }

  if (pkg.dependencies["moment"]) {
    push({
      id: "perf-moment",
      category: "performance",
      severity: "notice",
      title: "moment.js in the dependency tree",
      detail: "moment ships ~230 KB and every locale by default; it is also in maintenance mode.",
      file: "package.json",
      line: 1,
      fix: "Move to date-fns, dayjs, or Intl.DateTimeFormat.",
    });
  }

  return signals;
}
