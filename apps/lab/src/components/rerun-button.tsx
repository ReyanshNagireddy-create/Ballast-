"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Re-runs the simulation against the project's stored source. */
export function RerunButton({ projectId, personaCount }: { projectId: string; personaCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rerun() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personaCount }),
      });
      const body = (await response.json()) as { runId?: string; error?: string };
      if (!response.ok || !body.runId) throw new Error(body.error ?? "The re-run failed.");
      router.push(`/dashboard/${projectId}/runs/${body.runId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The re-run failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={rerun}
        disabled={busy}
        className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:border-line-bright hover:text-ink disabled:opacity-60"
      >
        {busy ? "Simulating…" : `Re-run with ${personaCount} personas`}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-poor">
          {error}
        </p>
      ) : null}
    </div>
  );
}
