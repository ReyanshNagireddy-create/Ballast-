"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "demo" | "github" | "zip";

const TABS: { id: Mode; label: string; hint: string }[] = [
  { id: "demo", label: "Sample project", hint: "A small Next.js app with real problems in it" },
  { id: "github", label: "GitHub repo", hint: "Any public React or Next.js repository" },
  { id: "zip", label: "Upload ZIP", hint: "Up to 25 MB of source" },
];

/**
 * Project creation.
 *
 * One form, three sources, and the first simulation runs as part of creation —
 * an empty project is not worth looking at, and the promise is "upload and see".
 */
export function NewProject() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("demo");
  const [personaCount, setPersonaCount] = useState(100);
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("HEAD");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await postProject({ mode, personaCount, repo, ref, file });
      const body = (await response.json()) as { project?: { id: string }; runId?: string; error?: string };
      if (!response.ok || !body.project || !body.runId) {
        throw new Error(body.error ?? "Something went wrong starting the simulation.");
      }
      router.push(`/dashboard/${body.project.id}/runs/${body.runId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-raised/50 p-6">
      <h2 className="text-lg font-semibold">Run a new simulation</h2>

      <div role="tablist" aria-label="Project source" className="mt-5 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            className={`rounded-lg border px-3.5 py-2 text-sm transition-colors ${
              mode === tab.id
                ? "border-cyan/50 bg-cyan/10 text-ink"
                : "border-line text-muted hover:border-line-bright hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-faint">{TABS.find((t) => t.id === mode)?.hint}</p>

      <div className="mt-6 space-y-5">
        {mode === "github" ? (
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Repository" hint="owner/name, or a github.com URL">
              <input
                required
                value={repo}
                onChange={(event) => setRepo(event.target.value)}
                placeholder="vercel/next-learn"
                className="w-full rounded-lg border border-line bg-void px-3 py-2.5 text-sm text-ink placeholder:text-faint"
              />
            </Field>
            <Field label="Branch or tag">
              <input
                value={ref}
                onChange={(event) => setRef(event.target.value)}
                placeholder="HEAD"
                className="w-full rounded-lg border border-line bg-void px-3 py-2.5 text-sm text-ink placeholder:text-faint"
              />
            </Field>
          </div>
        ) : null}

        {mode === "zip" ? (
          <Field label="Project ZIP" hint="Source only — node_modules and build output are ignored">
            <input
              required
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-line bg-void px-3 py-2.5 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
          </Field>
        ) : null}

        <Field label={`Cohort size — ${personaCount} personas`} hint="More personas find rarer problems">
          <input
            type="range"
            min={25}
            max={1000}
            step={25}
            value={personaCount}
            onChange={(event) => setPersonaCount(Number(event.target.value))}
            className="w-full accent-cyan"
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="mt-5 rounded-lg border border-poor/40 bg-poor/10 px-3 py-2.5 text-sm text-poor">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full rounded-xl bg-gradient-to-r from-cyan to-violet px-5 py-3 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? `Simulating ${personaCount} users…` : `Simulate ${personaCount} users`}
      </button>

      {busy ? (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className="h-full w-1/3 animate-sweep rounded-full bg-gradient-to-r from-cyan to-violet" />
        </div>
      ) : null}
    </form>
  );
}

function postProject(input: {
  mode: Mode;
  personaCount: number;
  repo: string;
  ref: string;
  file: File | null;
}): Promise<Response> {
  if (input.mode === "zip") {
    if (!input.file) throw new Error("Choose a ZIP file to upload.");
    const form = new FormData();
    form.set("file", input.file);
    form.set("personaCount", String(input.personaCount));
    return fetch("/api/projects", { method: "POST", body: form });
  }

  const body =
    input.mode === "demo"
      ? { kind: "demo", personaCount: input.personaCount }
      : { kind: "github", repo: input.repo, ref: input.ref || "HEAD", personaCount: input.personaCount };

  return fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  );
}
