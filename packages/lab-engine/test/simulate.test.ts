import { describe, expect, it } from "vitest";
import { buildProjectModel } from "../src/ingest.js";
import { deriveGoals, generatePersonas } from "../src/personas.js";
import { Rng, hashString } from "../src/random.js";
import { labelRelevance, loadTimeMs, simulate } from "../src/simulate.js";
import type { SourceFile } from "../src/source.js";
import type { Persona, Screen, SimulationConfig } from "../src/types.js";

const config: SimulationConfig = { personaCount: 60, seed: 42, maxStepsPerSession: 24 };

const app: SourceFile[] = [
  { path: "package.json", text: JSON.stringify({ name: "demo", dependencies: { next: "^15.0.0" } }) },
  {
    path: "app/page.tsx",
    text: `<main><h1>Notes</h1>
      <Link href="/notes">Your notes</Link>
      <Link href="/pricing">Pricing</Link>
    </main>`,
  },
  {
    path: "app/notes/page.tsx",
    text: `<main><h1>Your notes</h1><Link href="/notes/new">New note</Link><Link href="/">Home</Link></main>`,
  },
  {
    path: "app/notes/new/page.tsx",
    text: `<main><h1>New note</h1>
      <form><label htmlFor="title">Title</label><input id="title" name="title" required /><button type="submit">Save</button></form>
      <Link href="/notes">Cancel</Link>
    </main>`,
  },
  { path: "app/pricing/page.tsx", text: `<main><h1>Pricing</h1><Link href="/">Home</Link></main>` },
];

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const drawsA = Array.from({ length: 12 }, () => a.next());
    const drawsB = Array.from({ length: 12 }, () => b.next());
    expect(drawsA).toEqual(drawsB);
  });

  it("produces different streams for different seeds", () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it("stays within bounds", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 500; i++) {
      const value = rng.int(2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(5);
    }
  });

  it("respects weights", () => {
    const rng = new Rng(11);
    const items = [
      { id: "common", w: 99 },
      { id: "rare", w: 1 },
    ];
    let common = 0;
    for (let i = 0; i < 1000; i++) {
      if (rng.weighted(items, (item) => item.w).id === "common") common++;
    }
    expect(common).toBeGreaterThan(930);
  });

  it("hashes strings stably", () => {
    expect(hashString("p0001")).toBe(hashString("p0001"));
    expect(hashString("p0001")).not.toBe(hashString("p0002"));
  });
});

describe("generatePersonas", () => {
  const model = buildProjectModel(app, "Notes");

  it("produces the requested number, with stable ids", () => {
    const personas = generatePersonas(model, 25, 1);
    expect(personas).toHaveLength(25);
    expect(personas[0]?.id).toBe("p0001");
    expect(new Set(personas.map((p) => p.id)).size).toBe(25);
  });

  it("is reproducible for a seed and differs across seeds", () => {
    const a = generatePersonas(model, 20, 5);
    const b = generatePersonas(model, 20, 5);
    const c = generatePersonas(model, 20, 6);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("gives every persona a goal that exists in the product", () => {
    const paths = new Set(model.screens.map((s) => s.id));
    for (const persona of generatePersonas(model, 40, 3)) {
      expect(paths.has(persona.goalScreenId)).toBe(true);
      expect(persona.goal.length).toBeGreaterThan(0);
    }
  });

  it("includes users with accessibility needs and slow connections", () => {
    const personas = generatePersonas(model, 200, 9);
    expect(personas.some((p) => p.accessibilityNeeds.includes("screen-reader"))).toBe(true);
    expect(personas.some((p) => p.bandwidthKbps < 1_500)).toBe(true);
    expect(personas.some((p) => p.device === "android-budget")).toBe(true);
  });

  it("does not treat landing on the home page as a goal", () => {
    const goals = deriveGoals(model);
    expect(goals.some((g) => g.screenId === "/")).toBe(false);
  });
});

describe("loadTimeMs", () => {
  const screen = { weightBytes: 300_000 } as Screen;
  const base = { device: "desktop", bandwidthKbps: 50_000 } as Persona;

  it("gets slower as bandwidth drops", () => {
    const fast = loadTimeMs(screen, base);
    const slow = loadTimeMs(screen, { ...base, bandwidthKbps: 400 } as Persona);
    expect(slow).toBeGreaterThan(fast * 5);
  });

  it("penalises budget devices for parse time", () => {
    const desktop = loadTimeMs(screen, base);
    const budget = loadTimeMs(screen, { ...base, device: "android-budget" } as Persona);
    expect(budget).toBeGreaterThan(desktop);
  });
});

describe("labelRelevance", () => {
  it("scores an exact keyword match highest", () => {
    expect(labelRelevance("Pricing", ["pricing"])).toBe(1);
  });

  it("scores an unrelated label at zero", () => {
    expect(labelRelevance("Careers", ["pricing"])).toBe(0);
  });

  it("handles empty labels and keyword sets", () => {
    expect(labelRelevance("", ["pricing"])).toBe(0);
    expect(labelRelevance("Pricing", [])).toBe(0);
  });
});

describe("simulate", () => {
  const model = buildProjectModel(app, "Notes");
  const personas = generatePersonas(model, config.personaCount, config.seed);

  it("returns one session per persona", () => {
    const sessions = simulate(model, personas, config);
    expect(sessions).toHaveLength(personas.length);
    expect(sessions.map((s) => s.personaId)).toEqual(personas.map((p) => p.id));
  });

  it("is deterministic for the same model, cohort, and seed", () => {
    expect(simulate(model, personas, config)).toEqual(simulate(model, personas, config));
  });

  it("starts every session at an entry screen", () => {
    const entries = new Set(model.screens.filter((s) => s.isEntry).map((s) => s.id));
    for (const session of simulate(model, personas, config)) {
      expect(entries.has(session.path[0]!)).toBe(true);
    }
  });

  it("never exceeds the step cap", () => {
    for (const session of simulate(model, personas, config)) {
      expect(session.path.length).toBeLessThanOrEqual(config.maxStepsPerSession);
    }
  });

  it("produces a quote and a monotonic event timeline for every session", () => {
    for (const session of simulate(model, personas, config)) {
      expect(session.quote.length).toBeGreaterThan(0);
      expect(session.events.length).toBeGreaterThan(0);
      const times = session.events.map((e) => e.at);
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
  });

  it("gets a healthy share of the cohort through a well-signposted app", () => {
    const sessions = simulate(model, personas, config);
    const successes = sessions.filter((s) => s.outcome === "success").length;
    expect(successes / sessions.length).toBeGreaterThan(0.4);
  });

  it("does not treat a form-only screen as a dead end", () => {
    const withForm: SourceFile[] = [
      app[0]!,
      {
        path: "app/page.tsx",
        text: `<main><h1>Start</h1><Link href="/join">Join</Link></main>`,
      },
      {
        path: "app/join/page.tsx",
        text: `import { redirect } from "next/navigation";
          <main><h1>Join</h1><form><label htmlFor="email">Email</label><input id="email" name="email" required /><button type="submit">Join</button></form></main>
          function go() { redirect("/welcome"); }`,
      },
      { path: "app/welcome/page.tsx", text: `<main><h1>Welcome</h1><Link href="/">Home</Link></main>` },
    ];
    const formModel = buildProjectModel(withForm, "Join");
    const cohort = generatePersonas(formModel, 40, 2);
    const sessions = simulate(formModel, cohort, { ...config, personaCount: 40 });
    expect(sessions.every((s) => s.outcome !== "dead-end")).toBe(true);
  });

  it("records a dead end for anyone whose destination is an orphaned route", () => {
    // /reports exists but nothing links to it, and /archive has no way out.
    // Anyone who came for reports gets stranded — which is the whole point of
    // simulating navigation rather than just listing the routes that exist.
    const trap: SourceFile[] = [
      app[0]!,
      { path: "app/page.tsx", text: `<main><h1>Start</h1><Link href="/archive">Continue</Link></main>` },
      { path: "app/archive/page.tsx", text: `<main><h1>Archive</h1><p>Empty for now.</p></main>` },
      { path: "app/reports/page.tsx", text: `<main><h1>Reports</h1><Link href="/">Home</Link></main>` },
    ];
    const trapModel = buildProjectModel(trap, "Trap");
    const cohort = generatePersonas(trapModel, 60, 4);
    const sessions = simulate(trapModel, cohort, { ...config, personaCount: 60 });

    const wantedReports = new Set(
      cohort.filter((p) => p.goalScreenId === "/reports").map((p) => p.id),
    );
    expect(wantedReports.size).toBeGreaterThan(0);

    const stranded = sessions.filter((s) => wantedReports.has(s.personaId));
    expect(stranded.every((s) => s.outcome === "dead-end")).toBe(true);
    expect(stranded.every((s) => s.lastScreenId === "/archive")).toBe(true);
    expect(stranded.every((s) => s.friction.some((f) => f.cause === "dead-end"))).toBe(true);
  });

  it("blocks a keyboard-only persona from a mouse-only control", () => {
    const mouseOnly: SourceFile[] = [
      app[0]!,
      {
        path: "app/page.tsx",
        text: `<main><h1>Start</h1><div onClick={() => go("/next")}>Continue</div><a href="/next">Continue</a></main>`,
      },
      { path: "app/next/page.tsx", text: `<main><h1>Next</h1><Link href="/">Home</Link></main>` },
    ];
    const model2 = buildProjectModel(mouseOnly, "Mouse");
    const control = model2.screens
      .find((s) => s.path === "/")
      ?.affordances.find((a) => a.label === "Continue" && !a.keyboardReachable);
    expect(control).toBeDefined();
  });
});
