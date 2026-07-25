import { describe, expect, it } from "vitest";
import { buildProjectModel } from "../src/ingest.js";
import { parseStringArray, enrichReport, llmConfigFromEnv } from "../src/llm.js";
import { generatePersonas } from "../src/personas.js";
import {
  buildFunnel,
  buildReport,
  predictAdoption,
  scoreProduct,
  synthesiseIssues,
} from "../src/report.js";
import { simulate } from "../src/simulate.js";
import type { SourceFile } from "../src/source.js";
import type { Persona, Screen, Session, SimulationConfig } from "../src/types.js";

const config: SimulationConfig = { personaCount: 80, seed: 13, maxStepsPerSession: 24 };

/** A product with a heading, labelled forms, and clear navigation. */
const goodApp: SourceFile[] = [
  { path: "package.json", text: JSON.stringify({ name: "good", dependencies: { next: "^15.0.0" } }) },
  {
    path: "app/page.tsx",
    text: `<main><h1>Notes</h1><Link href="/notes">Your notes</Link><Link href="/pricing">Pricing</Link></main>`,
  },
  {
    path: "app/notes/page.tsx",
    text: `<main><h1>Your notes</h1><Link href="/notes/new">New note</Link><Link href="/">Home</Link></main>`,
  },
  {
    path: "app/notes/new/page.tsx",
    text: `<main><h1>New note</h1><form><label htmlFor="t">Title</label><input id="t" name="t" required /><button type="submit">Save</button></form><Link href="/notes">Cancel</Link></main>`,
  },
  { path: "app/pricing/page.tsx", text: `<main><h1>Pricing</h1><Link href="/">Home</Link></main>` },
];

/** The same product, degraded: icon-only nav, no headings, an unlabelled form. */
const badApp: SourceFile[] = [
  { path: "package.json", text: JSON.stringify({ name: "bad", dependencies: { next: "^15.0.0" } }) },
  {
    path: "app/page.tsx",
    text: `<main><Link href="/notes"><Icon /></Link><Link href="/pricing"><Icon /></Link></main>`,
  },
  {
    path: "app/notes/page.tsx",
    text: `<main><div onClick={go}><Icon /></div><Link href="/notes/new"><Icon /></Link></main>`,
  },
  {
    path: "app/notes/new/page.tsx",
    text: `<main><form>
      <input name="a" placeholder="A" required /><input name="b" placeholder="B" required />
      <input name="c" placeholder="C" required /><input name="d" placeholder="D" required />
      <input name="e" placeholder="E" required /><input name="f" placeholder="F" required />
      <input name="g" placeholder="G" required /><button type="submit">Go</button>
    </form></main>`,
  },
  { path: "app/pricing/page.tsx", text: `<main><img src="/p.png" /><Link href="/"><Icon /></Link></main>` },
];

function run(files: SourceFile[], name: string) {
  const model = buildProjectModel(files, name);
  const personas = generatePersonas(model, config.personaCount, config.seed);
  const sessions = simulate(model, personas, config);
  const report = buildReport(model, personas, sessions, { runId: "run_test", seed: config.seed });
  return { model, personas, sessions, report };
}

describe("buildReport", () => {
  const { report } = run(goodApp, "Notes");

  it("accounts for every session exactly once", () => {
    const counted = Object.values(report.outcomes).reduce((a, b) => a + b, 0);
    expect(counted).toBe(config.personaCount);
    expect(report.personaCount).toBe(config.personaCount);
  });

  it("keeps every score inside 0-100", () => {
    for (const [key, value] of Object.entries(report.scores)) {
      expect(value, key).toBeGreaterThanOrEqual(0);
      expect(value, key).toBeLessThanOrEqual(100);
    }
  });

  it("records provenance, and does not claim LLM enrichment it did not do", () => {
    expect(report.provenance.seed).toBe(config.seed);
    expect(report.provenance.llmEnriched).toBe(false);
    expect(report.provenance.llmModel).toBeUndefined();
  });

  it("points every issue at a real file", () => {
    const files = new Set(goodApp.map((f) => f.path));
    for (const issue of report.issues) {
      expect(files.has(issue.file), issue.file).toBe(true);
      expect(issue.line).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives every issue a recommendation and a share of the cohort", () => {
    for (const issue of report.issues) {
      expect(issue.recommendation.length).toBeGreaterThan(10);
      expect(issue.affectedShare).toBeGreaterThan(0);
      expect(issue.affectedShare).toBeLessThanOrEqual(1);
    }
  });

  it("orders issues by how many sessions they cost", () => {
    const lost = report.issues.map((i) => i.sessionsLost);
    expect([...lost].sort((a, b) => b - a)).toEqual(lost);
  });

  it("numbers recommendations from one, most valuable first", () => {
    expect(report.recommendations.map((r) => r.priority)).toEqual(
      report.recommendations.map((_, index) => index + 1),
    );
  });

  it("is reproducible", () => {
    const again = run(goodApp, "Notes").report;
    expect({ ...again, createdAt: "" }).toEqual({ ...report, createdAt: "" });
  });
});

describe("scoring discriminates between products", () => {
  const good = run(goodApp, "Good").report;
  const bad = run(badApp, "Bad").report;

  it("scores the better-built product higher overall", () => {
    expect(good.scores.overall).toBeGreaterThan(bad.scores.overall);
  });

  it("scores accessibility much lower for the degraded product", () => {
    expect(good.scores.accessibility).toBeGreaterThan(bad.scores.accessibility + 15);
  });

  it("reports lower launch confidence for the degraded product", () => {
    expect(good.scores.launchConfidence).toBeGreaterThan(bad.scores.launchConfidence);
  });

  it("projects worse retention for the degraded product", () => {
    expect(good.business.day30Retention).toBeGreaterThan(bad.business.day30Retention);
  });

  it("finds the unlabelled form fields and the icon-only navigation", () => {
    const causes = new Set(bad.issues.map((i) => i.cause));
    expect(causes.has("unlabelled-field")).toBe(true);
    expect([...causes].some((c) => c === "icon-only-navigation" || c === "unnamed-control")).toBe(true);
  });

  it("does not pin any dimension to zero, so runs stay comparable", () => {
    for (const [key, value] of Object.entries(bad.scores)) {
      expect(value, `${key} bottomed out`).toBeGreaterThan(0);
    }
  });
});

describe("buildFunnel", () => {
  const { model, sessions, report } = run(goodApp, "Notes");

  it("counts each session at most once per screen", () => {
    for (const step of report.funnel) {
      expect(step.entered).toBeLessThanOrEqual(sessions.length);
      expect(step.continued + step.droppedOff).toBe(step.entered);
    }
  });

  it("omits screens nobody reached", () => {
    const visited = new Set(sessions.flatMap((s) => s.path));
    for (const step of buildFunnel(sessions, model)) {
      expect(visited.has(step.screenId)).toBe(true);
    }
  });

  it("attributes every lost session to the screen it ended on", () => {
    const lost = sessions.filter((s) => s.outcome !== "success").length;
    const dropped = report.funnel.reduce((sum, step) => sum + step.droppedOff, 0);
    expect(dropped).toBe(lost);
  });
});

describe("predictAdoption", () => {
  it("flags a wanted-but-unreachable screen as worth investing in", () => {
    const hidden: SourceFile[] = [
      goodApp[0]!,
      { path: "app/page.tsx", text: `<main><h1>Home</h1><Link href="/notes">Notes</Link></main>` },
      { path: "app/notes/page.tsx", text: `<main><h1>Notes</h1><Link href="/">Home</Link></main>` },
      { path: "app/share/page.tsx", text: `<main><h1>Share</h1><Link href="/">Home</Link></main>` },
    ];
    const model = buildProjectModel(hidden, "Hidden");
    const personas = generatePersonas(model, 80, 3);
    const sessions = simulate(model, personas, { ...config, personaCount: 80 });
    const adoption = predictAdoption(sessions, personas, model);

    const share = adoption.find((a) => a.screenId === "/share");
    expect(share?.attempts).toBeGreaterThan(0);
    expect(share?.adoption).toBe(0);
    expect(share?.verdict).toBe("invest");
  });

  it("keeps adoption within 0-1 for every screen", () => {
    const { model, personas, sessions } = run(goodApp, "Notes");
    for (const row of predictAdoption(sessions, personas, model)) {
      expect(row.adoption).toBeGreaterThanOrEqual(0);
      expect(row.adoption).toBeLessThanOrEqual(1);
    }
  });
});

describe("synthesiseIssues", () => {
  it("returns nothing when no session hit any friction", () => {
    const sessions: Session[] = [
      {
        personaId: "p1",
        outcome: "success",
        durationMs: 1000,
        events: [],
        friction: [],
        lastScreenId: "/",
        path: ["/"],
        quote: "Fine.",
      },
    ];
    expect(synthesiseIssues(sessions, new Map<string, Persona>(), new Map<string, Screen>())).toEqual([]);
  });

  it("groups the same cause on the same screen into one issue", () => {
    const friction = [{ screenId: "/", cause: "no-heading", weight: 1 }];
    const sessions: Session[] = ["p1", "p2", "p3"].map((personaId) => ({
      personaId,
      outcome: "abandoned" as const,
      durationMs: 1000,
      events: [],
      friction,
      lastScreenId: "/",
      path: ["/"],
      quote: `${personaId} gave up`,
    }));
    const issues = synthesiseIssues(sessions, new Map(), new Map());
    expect(issues).toHaveLength(1);
    expect(issues[0]?.affectedShare).toBe(1);
    expect(issues[0]?.sessionsLost).toBe(3);
    expect(issues[0]?.evidence).toHaveLength(3);
  });
});

describe("scoreProduct", () => {
  it("handles an empty cohort without dividing by zero", () => {
    const model = buildProjectModel(goodApp, "Notes");
    const scores = scoreProduct(model, [], []);
    for (const value of Object.values(scores)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("llm", () => {
  it("returns the report unchanged when no model is configured", async () => {
    const { report } = run(goodApp, "Notes");
    const same = await enrichReport(report, null);
    expect(same).toBe(report);
    expect(same.provenance.llmEnriched).toBe(false);
  });

  it("reads config from the environment only when both URL and model are set", () => {
    expect(llmConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      llmConfigFromEnv({ PRODUCTLAB_LLM_BASE_URL: "http://x/v1" } as NodeJS.ProcessEnv),
    ).toBeNull();

    const config = llmConfigFromEnv({
      PRODUCTLAB_LLM_BASE_URL: "http://gateway.local/v1/",
      PRODUCTLAB_LLM_MODEL: "some-model",
      PRODUCTLAB_LLM_API_KEY: "k",
    } as NodeJS.ProcessEnv);
    expect(config).toEqual({
      baseUrl: "http://gateway.local/v1",
      model: "some-model",
      apiKey: "k",
      timeoutMs: 30_000,
    });
  });

  it("accepts an OmniRoute-style gateway via its own env vars", () => {
    const config = llmConfigFromEnv({
      OMNIROUTE_BASE_URL: "http://localhost:4000/v1",
      OMNIROUTE_API_KEY: "gateway-key",
      PRODUCTLAB_LLM_MODEL: "free-model",
    } as NodeJS.ProcessEnv);
    expect(config?.baseUrl).toBe("http://localhost:4000/v1");
    expect(config?.apiKey).toBe("gateway-key");
  });

  it("parses a JSON array out of fenced or chatty model output", () => {
    expect(parseStringArray('["a","b"]')).toEqual(["a", "b"]);
    expect(parseStringArray('```json\n["a"]\n```')).toEqual(["a"]);
    expect(parseStringArray('Sure! Here you go:\n["a","b"]\nHope that helps.')).toEqual(["a", "b"]);
  });

  it("rejects output that is not an array of strings", () => {
    expect(parseStringArray("not json")).toBeNull();
    expect(parseStringArray('[1, 2]')).toBeNull();
    expect(parseStringArray('{"a":1}')).toBeNull();
  });
});

describe("issue evidence", () => {
  /**
   * Regression: every session used to donate its quote to every issue it
   * touched, so a complaint about unlabelled form fields would appear as
   * evidence for an unrelated auth wall on another screen.
   */
  const sessions: Session[] = [
    {
      personaId: "p1",
      outcome: "abandoned",
      durationMs: 1000,
      events: [],
      friction: [
        { screenId: "/signup", cause: "unlabelled-field", weight: 3 },
        { screenId: "/dashboard", cause: "auth-wall", weight: 0.4 },
      ],
      lastScreenId: "/signup",
      path: ["/signup"],
      quote: "The boxes have no labels.",
    },
  ];

  const persona = generatePersonas(buildProjectModel(goodApp, "Notes"), 1, 1)[0]!;
  const personaById = new Map([["p1", { ...persona, id: "p1" }]]);

  it("uses the session's own words for the issue it complained loudest about", () => {
    const issues = synthesiseIssues(sessions, personaById, new Map());
    const fields = issues.find((i) => i.cause === "unlabelled-field");
    expect(fields?.evidence).toContain("The boxes have no labels.");
  });

  it("does not file that complaint as evidence for an unrelated issue", () => {
    const issues = synthesiseIssues(sessions, personaById, new Map());
    const authWall = issues.find((i) => i.cause === "auth-wall");
    expect(authWall?.evidence).not.toContain("The boxes have no labels.");
  });

  it("gives the quieter issue evidence scoped to that issue instead", () => {
    const issues = synthesiseIssues(sessions, personaById, new Map());
    const authWall = issues.find((i) => i.cause === "auth-wall");
    expect(authWall?.evidence.length).toBeGreaterThan(0);
    // The generated line is about signing in, not about form fields.
    expect(authWall?.evidence.join(" ").toLowerCase()).toMatch(/sign|account/);
  });

  it("attributes nothing when no persona actually hit the issue", () => {
    const issues = synthesiseIssues(sessions, new Map(), new Map());
    const authWall = issues.find((i) => i.cause === "auth-wall");
    expect(authWall?.evidence).toEqual([]);
  });

  it("still counts the session against both issues", () => {
    const issues = synthesiseIssues(sessions, personaById, new Map());
    expect(issues.every((i) => i.affectedShare === 1)).toBe(true);
    expect(issues.every((i) => i.sessionsLost === 1)).toBe(true);
  });
});
