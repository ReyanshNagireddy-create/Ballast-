import type { Report } from "@ballast/core";

export interface UploadResult {
  ok: boolean;
  message: string;
}

/**
 * Uploads a check report to Ballast Cloud so the run shows up in the project
 * dashboard. Requires BALLAST_API_KEY (project settings → API keys).
 * Upload failures never change the check's exit code — CI must not go red
 * because the dashboard was unreachable.
 */
export async function uploadReport(
  report: Report,
  fetchImpl: typeof fetch = fetch,
): Promise<UploadResult> {
  const apiKey = process.env.BALLAST_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message:
        "upload skipped: BALLAST_API_KEY is not set (create one in your project settings)",
    };
  }
  const base = process.env.BALLAST_API_URL ?? "https://ballast.dev/api/v1";
  const meta = {
    branch:
      process.env.GITHUB_HEAD_REF ??
      process.env.GITHUB_REF_NAME ??
      process.env.CI_COMMIT_BRANCH ??
      null,
    commit: process.env.GITHUB_SHA ?? process.env.CI_COMMIT_SHA ?? null,
    repository: process.env.GITHUB_REPOSITORY ?? null,
    runUrl:
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
  };
  try {
    const res = await fetchImpl(`${base}/checks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ report, meta }),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `upload failed: ${res.status} ${res.statusText}`,
      };
    }
    const body = (await res.json()) as { id?: string; url?: string };
    return {
      ok: true,
      message: body.url
        ? `uploaded: ${body.url}`
        : `uploaded check ${body.id ?? ""}`.trim(),
    };
  } catch (err) {
    return {
      ok: false,
      message: `upload failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
