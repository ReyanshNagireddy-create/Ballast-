import type { Report, UxIssue } from "./types.js";

/**
 * Optional LLM enrichment.
 *
 * The simulation is complete without a model: scores, issues, funnel, and
 * recommendations are all computed deterministically. A model only rewrites the
 * *prose* — persona quotes and recommendation copy — and the report records
 * whether that happened, so nobody mistakes generated wording for measured
 * behaviour.
 *
 * The client speaks the OpenAI chat-completions wire format, which is what
 * essentially every gateway exposes. Point `baseUrl` at whichever one you have:
 *
 *   • Anthropic-compatible or OpenAI endpoints directly, or
 *   • a self-hosted gateway such as OmniRoute (https://github.com/diegosouzapw/OmniRoute),
 *     which fans a single endpoint out across many providers and free tiers —
 *     useful precisely when a per-provider quota runs out mid-run.
 *
 * Nothing here is required to produce a report, and every failure degrades to
 * the deterministic text rather than failing the run.
 */

export interface LlmConfig {
  /** Base URL of an OpenAI-compatible API, e.g. "http://localhost:4000/v1". */
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** Per-request timeout. Enrichment is a nicety; it must never hang a run. */
  timeoutMs?: number;
}

/** Read LLM settings from the environment, or return null when unconfigured. */
export function llmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const baseUrl = env.PRODUCTLAB_LLM_BASE_URL ?? env.OMNIROUTE_BASE_URL;
  const model = env.PRODUCTLAB_LLM_MODEL;
  if (!baseUrl || !model) return null;
  const apiKey = env.PRODUCTLAB_LLM_API_KEY ?? env.OMNIROUTE_API_KEY;
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    ...(apiKey ? { apiKey } : {}),
    timeoutMs: Number(env.PRODUCTLAB_LLM_TIMEOUT_MS ?? 30_000),
  };
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

async function chat(config: LlmConfig, messages: ChatMessage[]): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 30_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.4,
        max_tokens: 1200,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return body.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM = `You are a product researcher writing up the results of a usability study.
You will be given issues that were measured, with exact counts. Rewrite each recommendation
as one specific, actionable sentence a developer could act on today.
Rules:
- Never invent a number, a screen, or a behaviour that is not in the input.
- Do not soften a finding, and do not exaggerate it.
- One sentence per issue. No preamble, no numbering.
Reply with a JSON array of strings, in the same order as the input issues.`;

/**
 * Rewrite recommendation copy with a model, keeping every measured number.
 *
 * Returns the report unchanged when no model is configured or the call fails.
 */
export async function enrichReport(report: Report, config: LlmConfig | null): Promise<Report> {
  if (!config) return report;
  const issues = report.issues.slice(0, 10);
  if (issues.length === 0) return report;

  const payload = issues.map((issue) => ({
    title: issue.title,
    measured: issue.detail,
    currentRecommendation: issue.recommendation,
    file: issue.file,
  }));

  const content = await chat(config, [
    { role: "system", content: SYSTEM },
    { role: "user", content: JSON.stringify(payload, null, 2) },
  ]);
  if (!content) return report;

  const rewritten = parseStringArray(content);
  if (!rewritten || rewritten.length !== issues.length) return report;

  const byId = new Map<string, string>();
  issues.forEach((issue, index) => {
    const text = rewritten[index];
    if (text && text.trim().length > 0) byId.set(issue.id, text.trim());
  });

  return {
    ...report,
    issues: report.issues.map((issue): UxIssue => {
      const replacement = byId.get(issue.id);
      return replacement ? { ...issue, recommendation: replacement } : issue;
    }),
    provenance: { ...report.provenance, llmEnriched: true, llmModel: config.model },
  };
}

/** Tolerate models that wrap JSON in prose or a fenced block. */
export function parseStringArray(content: string): string[] | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(content);
  const candidate = fenced?.[1] ?? content;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((item) => typeof item === "string")) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}
