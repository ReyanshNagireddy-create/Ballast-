import { createSign } from "node:crypto";
import type { IngestCheckPayload } from "@ballast/db";
import { env } from "./env.js";

const API = "https://api.github.com";
const UA = "ballast-worker";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** RS256-signed GitHub App JWT — no JWT library needed for one algorithm. */
export function createAppJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = base64url(signer.sign(privateKey));
  return `${header}.${payload}.${signature}`;
}

async function installationToken(
  jwt: string,
  repository: string,
): Promise<string | null> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return null;
  const instRes = await fetch(`${API}/repos/${owner}/${repo}/installation`, {
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: "application/vnd.github+json",
      "user-agent": UA,
    },
  });
  if (!instRes.ok) return null;
  const inst = (await instRes.json()) as { id: number };
  const tokenRes = await fetch(
    `${API}/app/installations/${inst.id}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: "application/vnd.github+json",
        "user-agent": UA,
      },
    },
  );
  if (!tokenRes.ok) return null;
  const token = (await tokenRes.json()) as { token: string };
  return token.token;
}

const LEVEL: Record<string, "failure" | "warning" | "notice"> = {
  blocker: "failure",
  warning: "warning",
  notice: "notice",
};

/**
 * Publishes a GitHub check run with inline annotations for a completed
 * Ballast check. No-ops (returning false) when the GitHub App is not
 * configured or the repo/commit context is missing.
 */
export async function publishGithubCheck(
  payload: IngestCheckPayload,
  context: { repository: string | null; commitSha: string | null },
): Promise<boolean> {
  const app = env.githubApp;
  if (!app || !context.repository || !context.commitSha) return false;

  const jwt = createAppJwt(app.appId, app.privateKey);
  const token = await installationToken(jwt, context.repository);
  if (!token) return false;

  const { report } = payload;
  const s = report.summary;
  // The check-run API accepts at most 50 annotations per request.
  const annotations = report.findings.slice(0, 50).map((f) => ({
    path: f.file,
    start_line: f.line,
    end_line: f.line,
    annotation_level: LEVEL[f.severity] ?? "notice",
    title: `ballast: ${f.ruleId}`,
    message: f.fix ? `${f.message}\n\nFix: ${f.fix.summary}` : f.message,
  }));

  const res = await fetch(`${API}/repos/${context.repository}/check-runs`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": UA,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "Ballast migration safety",
      head_sha: context.commitSha,
      status: "completed",
      conclusion: s.passed ? "success" : "failure",
      output: {
        title: `Score ${s.score}/100 (${s.grade}) — ${s.blockers} blockers, ${s.warnings} warnings`,
        summary:
          s.blockers + s.warnings + s.notices === 0
            ? "No migration hazards found. Safe to ship."
            : `Ballast found ${s.blockers} blocker(s), ${s.warnings} warning(s), ${s.notices} notice(s) across ${s.files} file(s).`,
        annotations,
      },
    }),
  });
  return res.ok;
}
