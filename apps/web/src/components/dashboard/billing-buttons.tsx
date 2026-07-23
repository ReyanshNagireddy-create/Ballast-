"use client";

import { useState } from "react";

async function redirectTo(endpoint: string, setError: (e: string | null) => void) {
  setError(null);
  try {
    const res = await fetch(endpoint, { method: "POST" });
    const body = (await res.json()) as { url?: string; message?: string };
    if (!res.ok || !body.url) {
      throw new Error(body.message ?? "Billing is not configured yet.");
    }
    window.location.href = body.url;
  } catch (err) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }
}

export function UpgradeButton() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        onClick={() => void redirectTo("/api/billing/checkout", setError)}
        className="rounded-lg bg-beacon px-5 py-2.5 text-sm font-medium text-abyss transition-colors hover:bg-beacon-bright"
      >
        Upgrade to Team — $99/mo
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function ManageBillingButton() {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        onClick={() => void redirectTo("/api/billing/portal", setError)}
        className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-beacon/40"
      >
        Manage billing
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
