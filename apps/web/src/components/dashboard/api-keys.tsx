"use client";

import { useState, useTransition } from "react";
import {
  createProjectApiKey,
  revokeApiKey,
  type CreatedKey,
} from "@/app/dashboard/actions";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
}

export function ApiKeysPanel({
  projectSlug,
  keys,
}: {
  projectSlug: string;
  keys: KeyRow[];
}) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () => {
    startTransition(async () => {
      setError(null);
      try {
        setCreated(await createProjectApiKey(projectSlug, name || "CI key"));
        setName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create key.");
      }
    });
  };

  const revoke = (keyId: string) => {
    startTransition(async () => {
      setError(null);
      try {
        await revokeApiKey(projectSlug, keyId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to revoke key.");
      }
    });
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="font-medium text-ink">API keys</h2>
      <p className="mt-1 text-sm text-muted">
        Used by <code className="font-mono text-beacon-bright">ballast check --upload</code>{" "}
        and the REST/GraphQL APIs. Keys are shown once and stored hashed.
      </p>

      {created ? (
        <div className="mt-4 rounded-lg border border-beacon/40 bg-beacon/10 p-4">
          <p className="text-sm font-medium text-beacon">
            Copy this key now — it will not be shown again.
          </p>
          <code className="mt-2 block select-all break-all font-mono text-sm text-ink">
            {created.plaintext}
          </code>
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. github-actions)"
          maxLength={80}
          className="flex-1 rounded-lg border border-line bg-abyss px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-beacon/50 focus:outline-none"
        />
        <button
          onClick={create}
          disabled={pending}
          className="rounded-lg bg-beacon px-4 py-2 text-sm font-medium text-abyss transition-colors hover:bg-beacon-bright disabled:opacity-50"
        >
          {pending ? "Working…" : "Create key"}
        </button>
      </div>

      <ul className="mt-6 divide-y divide-line">
        {keys.length === 0 ? (
          <li className="py-3 text-sm text-faint">No keys yet.</li>
        ) : null}
        {keys.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm text-ink">
                {k.name}{" "}
                {k.revoked ? (
                  <span className="text-xs text-danger">(revoked)</span>
                ) : null}
              </p>
              <p className="font-mono text-xs text-faint">
                {k.prefix}… · created {k.createdAt}
                {k.lastUsedAt ? ` · last used ${k.lastUsedAt}` : " · never used"}
              </p>
            </div>
            {!k.revoked ? (
              <button
                onClick={() => revoke(k.id)}
                disabled={pending}
                className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-danger/50 hover:text-danger disabled:opacity-50"
              >
                Revoke
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
