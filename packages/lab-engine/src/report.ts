import { causeCategory, readableCause } from "./friction.js";
import { describePersona } from "./personas.js";
import { dominantCause, quoteFor } from "./quotes.js";
import type {
  BusinessOutlook,
  FeatureAdoption,
  FrictionPoint,
  FunnelStep,
  Persona,
  ProjectModel,
  Recommendation,
  Report,
  ScoreBreakdown,
  Screen,
  Session,
  SessionOutcome,
  SignalSeverity,
  StaticSignal,
  UxIssue,
} from "./types.js";
import { ENGINE_VERSION } from "./types.js";

/**
 * Turn thousands of sessions into something a founder can act on before lunch.
 *
 * The ordering principle throughout: rank by how many people it cost, not by
 * how severe the rule sounds. A "notice" that 40% of the cohort tripped over
 * outranks a "blocker" that nobody reached.
 */
export function buildReport(
  model: ProjectModel,
  personas: Persona[],
  sessions: Session[],
  options: { runId: string; seed: number; createdAt?: string },
): Report {
  const byId = new Map(model.screens.map((s) => [s.id, s]));
  const personaById = new Map(personas.map((p) => [p.id, p]));

  const outcomes = countOutcomes(sessions);
  const issues = synthesiseIssues(sessions, personaById, byId);
  const funnel = buildFunnel(sessions, model);
  const adoption = predictAdoption(sessions, personas, model);
  const scores = scoreProduct(model, sessions, issues);
  const business = projectBusiness(sessions, personas, issues, scores);
  const recommendations = recommend(issues, model, scores, business, adoption);

  return {
    runId: options.runId,
    projectName: model.name,
    createdAt: options.createdAt ?? new Date().toISOString(),
    personaCount: personas.length,
    scores,
    outcomes,
    issues,
    funnel,
    adoption,
    business,
    recommendations,
    signals: model.signals,
    warnings: model.warnings,
    feedback: sampleFeedback(sessions, personaById),
    provenance: { engineVersion: ENGINE_VERSION, seed: options.seed, llmEnriched: false },
  };
}

function countOutcomes(sessions: Session[]): Record<SessionOutcome, number> {
  const counts: Record<SessionOutcome, number> = {
    success: 0,
    abandoned: 0,
    timeout: 0,
    "dead-end": 0,
    blocked: 0,
  };
  for (const session of sessions) counts[session.outcome]++;
  return counts;
}

/* ──────────────────────────────── issues ───────────────────────────────── */

interface IssueBucket {
  cause: string;
  screenId: string;
  affordanceId?: string;
  sessions: Set<string>;
  lostSessions: Set<string>;
  weight: number;
  quotes: string[];
  /** Sessions that hit this issue but complained about something else louder. */
  candidates: { personaId: string; outcome: SessionOutcome; points: FrictionPoint[] }[];
}

/**
 * Group friction points into issues.
 *
 * The grouping key is (cause, screen) rather than (cause) alone: "icon-only
 * navigation" as a global statistic is a lecture, while "icon-only navigation
 * in the sidebar on /dashboard" is a ticket.
 */
export function synthesiseIssues(
  sessions: Session[],
  personaById: Map<string, Persona>,
  screenById: Map<string, Screen>,
): UxIssue[] {
  const buckets = new Map<string, IssueBucket>();

  for (const session of sessions) {
    const lost = session.outcome !== "success";
    // A session's quote describes whatever frustrated it most. Attaching it to
    // every issue the session touched would file a complaint about form labels
    // as evidence for an auth wall, so a quote is only evidence for the issue
    // it is actually about.
    const spokenAbout = dominantCause(session.friction);

    for (const point of session.friction) {
      const key = `${point.cause}::${point.screenId}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          cause: point.cause,
          screenId: point.screenId,
          ...(point.affordanceId ? { affordanceId: point.affordanceId } : {}),
          sessions: new Set(),
          lostSessions: new Set(),
          weight: 0,
          quotes: [],
          candidates: [],
        };
        buckets.set(key, bucket);
      }
      bucket.sessions.add(session.personaId);
      if (lost) bucket.lostSessions.add(session.personaId);
      bucket.weight += point.weight;
      if (
        spokenAbout === point.cause &&
        bucket.quotes.length < 3 &&
        session.quote &&
        !bucket.quotes.includes(session.quote)
      ) {
        bucket.quotes.push(session.quote);
      } else if (bucket.candidates.length < 6) {
        bucket.candidates.push({
          personaId: session.personaId,
          outcome: session.outcome,
          points: [point],
        });
      }
    }
  }

  const total = Math.max(1, sessions.length);
  const issues: UxIssue[] = [];

  for (const bucket of buckets.values()) {
    const screen = screenById.get(bucket.screenId);
    fillEvidence(bucket, personaById, screen);
    const location = locationFor(bucket, screen);
    const affectedShare = bucket.sessions.size / total;
    const sessionsLost = bucket.lostSessions.size;
    issues.push({
      id: `${bucket.cause}-${slug(bucket.screenId)}`,
      cause: bucket.cause,
      title: issueTitle(bucket.cause, screen),
      severity: severityFor(affectedShare, sessionsLost / total),
      affectedShare: round3(affectedShare),
      sessionsLost,
      screenId: bucket.screenId,
      file: location.file,
      line: location.line,
      detail: issueDetail(bucket, screen, total),
      recommendation: fixFor(bucket.cause, screen),
      evidence: bucket.quotes,
    });
  }

  issues.sort((a, b) => b.sessionsLost - a.sessionsLost || b.affectedShare - a.affectedShare);
  return issues;
}

/**
 * Top up an issue's evidence.
 *
 * A session only donates its own quote to the issue it complained loudest
 * about, which leaves quieter issues with nothing. For those, ask a persona who
 * actually hit this issue what *this* felt like — same template system, same
 * voice, but scoped to this issue's friction alone. Nothing is attributed to a
 * persona who never encountered it.
 */
function fillEvidence(
  bucket: IssueBucket,
  personaById: Map<string, Persona>,
  screen: Screen | undefined,
): void {
  for (const candidate of bucket.candidates) {
    if (bucket.quotes.length >= 3) return;
    const persona = personaById.get(candidate.personaId);
    if (!persona) continue;
    const quote = quoteFor(persona, candidate.outcome, candidate.points, screen);
    if (quote && !bucket.quotes.includes(quote)) bucket.quotes.push(quote);
  }
}

/**
 * Resolve an issue back to the exact place a developer should open.
 *
 * A screen is made of several files — the page, its layouts, the components
 * they render — so the page path is usually the wrong answer. An issue caused
 * by a sidebar link belongs to the layout that defines it.
 */
function locationFor(bucket: IssueBucket, screen: Screen | undefined): { file: string; line: number } {
  const fallback = { file: screen?.file ?? "unknown", line: 1 };
  if (!screen || !bucket.affordanceId) return fallback;
  const id = bucket.affordanceId;

  const affordance = screen.affordances.find((a) => a.id === id);
  if (affordance) return { file: affordance.file, line: affordance.line };

  const fieldMatch = /^(.*):field:(.*)$/.exec(id);
  if (fieldMatch) {
    const form = screen.forms.find((f) => f.id === fieldMatch[1]);
    const field = form?.fields.find((f) => f.name === fieldMatch[2]);
    if (form) return { file: form.file, line: field?.line ?? form.line };
  }

  const form = screen.forms.find((f) => id === f.id || id === `${f.id}:submit`);
  if (form) return { file: form.file, line: form.line };

  return fallback;
}

function severityFor(affectedShare: number, lostShare: number): SignalSeverity {
  if (lostShare >= 0.15 || affectedShare >= 0.5) return "blocker";
  if (lostShare >= 0.04 || affectedShare >= 0.2) return "warning";
  return "notice";
}

function issueTitle(cause: string, screen: Screen | undefined): string {
  const where = screen ? ` on ${screen.title}` : "";
  switch (cause) {
    case "slow-load":
      return `Slow first render${where}`;
    case "icon-only-navigation":
      return `Icon-only navigation${where}`;
    case "unnamed-control":
      return `Controls with no accessible name${where}`;
    case "keyboard-unreachable":
      return `Keyboard users cannot operate${where}`;
    case "invisible-to-screen-reader":
      return `Content invisible to screen readers${where}`;
    case "no-heading":
      return `No heading${where}`;
    case "dense-copy":
      return `Too much copy before the action${where}`;
    case "dead-end":
      return `Dead end${where}`;
    case "ambiguous-label":
      return `Labels do not match what users came for${where}`;
    case "auth-wall":
      return `Sign-in required before any value${where}`;
    case "long-form":
      return `Form asks for too much${where}`;
    case "unlabelled-field":
      return `Form fields without labels${where}`;
    case "navigation-loop":
      return `Navigation loops back on itself${where}`;
    case "small-target":
      return `Tap targets too small${where}`;
    default:
      return `${readableCause(cause)}${where}`;
  }
}

function issueDetail(bucket: IssueBucket, screen: Screen | undefined, total: number): string {
  const hit = bucket.sessions.size;
  const lost = bucket.lostSessions.size;
  const pct = Math.round((hit / total) * 100);
  const path = screen?.path ?? bucket.screenId;
  const lostClause =
    lost > 0
      ? ` ${lost} of them left without finishing what they came to do.`
      : " None of them left over it, but it slowed everyone down.";
  return `${hit} of ${total} simulated users (${pct}%) hit ${readableCause(bucket.cause)} at ${path}.${lostClause}`;
}

function fixFor(cause: string, screen: Screen | undefined): string {
  const path = screen?.path ?? "this screen";
  switch (cause) {
    case "slow-load":
      return `Cut the client bundle on ${path}: move heavy imports behind next/dynamic, and render static content on the server.`;
    case "icon-only-navigation":
      return "Put a text label next to each icon, or at minimum a tooltip and an aria-label.";
    case "unnamed-control":
      return "Give every control visible text or an aria-label describing the action it performs.";
    case "keyboard-unreachable":
      return "Replace click-handling <div>s with <button>, so focus, Enter, and Space work for free.";
    case "invisible-to-screen-reader":
      return "Add alt text to meaningful images and aria-labels to icon buttons.";
    case "no-heading":
      return `Add a single <h1> to ${path} naming what the screen is for.`;
    case "dense-copy":
      return "Move the primary action above the copy, and cut the intro to two sentences.";
    case "dead-end":
      return `Add a clear next step to ${path} — most people arrive here mid-task, not at the end of one.`;
    case "ambiguous-label":
      return "Rename controls to the words users arrive with, not the internal feature names.";
    case "auth-wall":
      return "Let people see and try the core flow before asking for an account; move sign-up to the point of saving.";
    case "long-form":
      return "Ask for the minimum needed to deliver value, and collect the rest later.";
    case "unlabelled-field":
      return "Add a <label> to every input; placeholders vanish the moment someone types.";
    case "navigation-loop":
      return "Add breadcrumbs or a persistent back affordance so the hierarchy is visible.";
    case "small-target":
      return "Give interactive elements at least a 44×44px hit area with spacing between them.";
    default:
      return "Review this interaction with a real user.";
  }
}

/* ──────────────────────────────── funnel ───────────────────────────────── */

export function buildFunnel(sessions: Session[], model: ProjectModel): FunnelStep[] {
  const entered = new Map<string, number>();
  const dropped = new Map<string, number>();

  for (const session of sessions) {
    const seen = new Set<string>();
    for (const screenId of session.path) {
      if (seen.has(screenId)) continue;
      seen.add(screenId);
      entered.set(screenId, (entered.get(screenId) ?? 0) + 1);
    }
    if (session.outcome !== "success") {
      dropped.set(session.lastScreenId, (dropped.get(session.lastScreenId) ?? 0) + 1);
    }
  }

  const steps: FunnelStep[] = [];
  for (const screen of model.screens) {
    const enteredCount = entered.get(screen.id) ?? 0;
    if (enteredCount === 0) continue;
    const droppedCount = dropped.get(screen.id) ?? 0;
    steps.push({
      screenId: screen.id,
      path: screen.path,
      title: screen.title,
      entered: enteredCount,
      continued: enteredCount - droppedCount,
      droppedOff: droppedCount,
      dropOffRate: round3(droppedCount / Math.max(1, enteredCount)),
    });
  }
  steps.sort((a, b) => b.entered - a.entered);
  return steps;
}

/* ─────────────────────────────── adoption ──────────────────────────────── */

/**
 * Predicted feature adoption.
 *
 * Demand is measured by how many personas arrived wanting a screen; adoption is
 * demand discounted by how many of them actually got there. A feature with high
 * demand and low reach is not unpopular — it is buried, and that is a different
 * fix from cutting it.
 */
export function predictAdoption(
  sessions: Session[],
  personas: Persona[],
  model: ProjectModel,
): FeatureAdoption[] {
  const personaById = new Map(personas.map((p) => [p.id, p]));
  const wanted = new Map<string, number>();
  const reached = new Map<string, number>();

  for (const persona of personas) {
    wanted.set(persona.goalScreenId, (wanted.get(persona.goalScreenId) ?? 0) + 1);
  }
  for (const session of sessions) {
    const persona = personaById.get(session.personaId);
    if (!persona) continue;
    if (session.path.includes(persona.goalScreenId)) {
      reached.set(persona.goalScreenId, (reached.get(persona.goalScreenId) ?? 0) + 1);
    }
  }

  const total = Math.max(1, personas.length);
  const rows: FeatureAdoption[] = [];

  for (const screen of model.screens) {
    const demand = wanted.get(screen.id) ?? 0;
    const got = reached.get(screen.id) ?? 0;
    // Everyone who wants it and can reach it, plus the incidental traffic that
    // passes through on the way elsewhere.
    const passers = sessions.filter((s) => s.path.includes(screen.id)).length;
    const adoption = clamp((got + passers * 0.25) / total, 0, 1);
    rows.push({
      screenId: screen.id,
      feature: screen.title,
      adoption: round3(adoption),
      attempts: demand,
      verdict: verdictFor(adoption, demand / total, got / Math.max(1, demand)),
    });
  }

  rows.sort((a, b) => b.adoption - a.adoption);
  return rows;
}

function verdictFor(adoption: number, demandShare: number, reachRate: number): FeatureAdoption["verdict"] {
  // Wanted but unreachable is the interesting case: it is a navigation problem
  // wearing the costume of an unpopular feature. A screen nobody could reach at
  // all qualifies on a much lower bar than one that is merely awkward to find.
  if (reachRate === 0 && demandShare > 0) return "invest";
  if (demandShare >= 0.05 && reachRate < 0.5) return "invest";
  if (demandShare >= 0.05) return "keep";
  if (adoption < 0.05 && demandShare < 0.03) return "defer";
  if (adoption < 0.2) return "simplify";
  return "keep";
}

/* ──────────────────────────────── scoring ──────────────────────────────── */

export function scoreProduct(
  model: ProjectModel,
  sessions: Session[],
  issues: UxIssue[],
): ScoreBreakdown {
  const total = Math.max(1, sessions.length);
  const successes = sessions.filter((s) => s.outcome === "success").length;
  const successRate = successes / total;

  // UX is anchored on task success, then docked for how much friction the
  // successful sessions still carried — finishing while annoyed still counts
  // against the design. Every penalty below is capped, because a score that
  // pins to zero cannot show whether the next commit improved anything.
  // A blend rather than a subtraction: friction must not be able to cancel a
  // real success rate out to nothing, or two very different products score 0.
  const frictionPerSession =
    sessions.reduce((sum, s) => sum + s.friction.reduce((f, p) => f + p.weight, 0), 0) / total;
  const frictionQuality = 1 / (1 + frictionPerSession / 4);
  const userExperience = clampScore(successRate * 70 + frictionQuality * 30);

  const performance = clampScore(
    100 -
      shareOfSessionsWith(sessions, "performance") * 45 -
      signalPenalty(model.signals, "performance"),
  );
  const accessibility = clampScore(
    100 -
      shareOfSessionsWith(sessions, "accessibility") * 45 -
      signalPenalty(model.signals, "accessibility"),
  );
  const security = clampScore(100 - signalPenalty(model.signals, "security") * 1.4);
  const scalability = clampScore(100 - signalPenalty(model.signals, "scalability"));

  const blockers = issues.filter((i) => i.severity === "blocker").length;
  const businessReadiness = clampScore(successRate * 80 + 20 - Math.min(30, blockers * 5));

  const overall = clampScore(
    userExperience * 0.3 +
      accessibility * 0.15 +
      performance * 0.15 +
      businessReadiness * 0.2 +
      security * 0.12 +
      scalability * 0.08,
  );

  // Confidence is deliberately harsher than the mean: one blocker that costs a
  // fifth of the cohort should not be averaged away by a clean security score.
  // Scaled rather than subtracted, so it keeps tracking change all the way down.
  const worstIssueCost = issues.reduce((worst, i) => Math.max(worst, i.sessionsLost / total), 0);
  const launchConfidence = clampScore(overall * (1 - worstIssueCost * 0.6));

  return {
    userExperience,
    performance,
    accessibility,
    businessReadiness,
    security,
    scalability,
    overall,
    launchConfidence,
  };
}

function shareOfSessionsWith(sessions: Session[], category: ReturnType<typeof causeCategory>): number {
  if (sessions.length === 0) return 0;
  let hits = 0;
  for (const session of sessions) {
    if (session.friction.some((p) => causeCategory(p.cause) === category)) hits++;
  }
  return hits / sessions.length;
}

function signalPenalty(signals: StaticSignal[], category: StaticSignal["category"]): number {
  const weights: Record<SignalSeverity, number> = { blocker: 12, warning: 5, notice: 1.5 };
  let raw = 0;
  for (const signal of signals) {
    if (signal.category !== category) continue;
    raw += weights[signal.severity];
  }
  // Diminishing returns: fifty instances of one mistake is one mistake, and a
  // codebase should not be able to drive a dimension to zero on volume alone.
  return Math.min(35, Math.sqrt(raw) * 6);
}

/* ─────────────────────────────── business ──────────────────────────────── */

export function projectBusiness(
  sessions: Session[],
  personas: Persona[],
  issues: UxIssue[],
  scores: ScoreBreakdown,
): BusinessOutlook {
  const total = Math.max(1, sessions.length);
  const successRate = sessions.filter((s) => s.outcome === "success").length / total;
  const personaById = new Map(personas.map((p) => [p.id, p]));

  // People who finish their first task come back; people who do not, mostly do
  // not. The multiplier is the retention half-life of a first session that
  // worked, not a market forecast.
  const day30Retention = clamp(successRate * 0.62 + (scores.userExperience / 100) * 0.12, 0.01, 0.85);
  const churnRisk = clamp(1 - day30Retention, 0.1, 0.99);

  const converted = sessions.filter((s) => {
    if (s.outcome !== "success") return false;
    const persona = personaById.get(s.personaId);
    return persona ? persona.purchaseIntent > 0.45 : false;
  }).length;
  const conversionRate = converted / total;

  const expectedRating = clamp(1 + (scores.overall / 100) * 4, 1, 5);

  // Every abandoned session is a candidate support ticket; only a fraction of
  // people bother to write in, and the rest simply leave.
  const failed = total - sessions.filter((s) => s.outcome === "success").length;
  const supportTicketsPer1000 = Math.round((failed / total) * 1000 * 0.14);

  const primaryLeak = issues[0]
    ? `${issues[0].title} — ${issues[0].sessionsLost} of ${total} sessions ended there`
    : "No dominant leak: sessions ended for scattered reasons";

  return {
    day30Retention: round3(day30Retention),
    churnRisk: round3(churnRisk),
    expectedRating: Math.round(expectedRating * 10) / 10,
    supportTicketsPer1000,
    conversionRate: round3(conversionRate),
    primaryLeak,
  };
}

/* ─────────────────────────── recommendations ───────────────────────────── */

/**
 * The roadmap.
 *
 * Ordered by sessions recovered per unit of effort, so the list reads as "do
 * this, then this" rather than as a severity dump. Product-shaped suggestions
 * (build the thing people kept trying to reach) sit alongside fixes, because a
 * founder's next decision is usually which of the two to spend the week on.
 */
export function recommend(
  issues: UxIssue[],
  model: ProjectModel,
  scores: ScoreBreakdown,
  business: BusinessOutlook,
  adoption: FeatureAdoption[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const issue of issues.slice(0, 8)) {
    if (issue.sessionsLost === 0 && issue.affectedShare < 0.15) continue;
    recommendations.push({
      id: `fix-${issue.id}`,
      title: issue.recommendation,
      rationale: issue.detail,
      priority: 0,
      effort: effortFor(issue.cause),
      impact: Math.round(issue.affectedShare * 18 + (issue.sessionsLost > 0 ? 6 : 0)),
    });
  }

  for (const feature of adoption.filter((a) => a.verdict === "invest").slice(0, 3)) {
    recommendations.push({
      id: `surface-${slug(feature.screenId)}`,
      title: `Surface "${feature.feature}" from the main navigation`,
      rationale: `${feature.attempts} personas arrived specifically wanting ${feature.feature}, and most never reached it. The demand is there; the path is not.`,
      priority: 0,
      effort: "low",
      impact: 8,
    });
  }

  for (const feature of adoption.filter((a) => a.verdict === "defer").slice(0, 2)) {
    recommendations.push({
      id: `defer-${slug(feature.screenId)}`,
      title: `Defer work on "${feature.feature}"`,
      rationale: `Predicted adoption is ${Math.round(feature.adoption * 100)}% and only ${feature.attempts} personas came looking for it. Engineering time spent here buys very little.`,
      priority: 0,
      effort: "low",
      impact: 3,
    });
  }

  if (business.day30Retention < 0.35) {
    recommendations.push({
      id: "retention-onboarding",
      title: "Get people to their first success inside one session",
      rationale: `Projected day-30 retention is ${Math.round(business.day30Retention * 100)}%. ${business.primaryLeak}.`,
      priority: 0,
      effort: "medium",
      impact: 12,
    });
  }

  const securitySignals = model.signals.filter(
    (s) => s.category === "security" && s.severity === "blocker",
  );
  if (securitySignals.length > 0) {
    recommendations.push({
      id: "security-blockers",
      title: `Fix ${securitySignals.length} security blocker${securitySignals.length > 1 ? "s" : ""} before launch`,
      rationale: securitySignals.map((s) => `${s.title} (${s.file}:${s.line})`).join("; "),
      priority: 0,
      effort: "low",
      impact: 10,
    });
  }

  if (scores.accessibility < 70) {
    recommendations.push({
      id: "accessibility-pass",
      title: "Run an accessibility pass before launch, not after",
      rationale: `Accessibility scores ${scores.accessibility}/100. Personas using a screen reader or keyboard completed far fewer tasks than the cohort average.`,
      priority: 0,
      effort: "medium",
      impact: 9,
    });
  }

  const effortCost: Record<Recommendation["effort"], number> = { low: 1, medium: 2, high: 3.5 };
  recommendations.sort((a, b) => b.impact / effortCost[b.effort] - a.impact / effortCost[a.effort]);
  return recommendations.map((r, index) => ({ ...r, priority: index + 1 }));
}

function effortFor(cause: string): Recommendation["effort"] {
  switch (cause) {
    case "auth-wall":
    case "long-form":
    case "dead-end":
      return "medium";
    case "slow-load":
      return "high";
    default:
      return "low";
  }
}

/* ─────────────────────────────── feedback ──────────────────────────────── */

function sampleFeedback(
  sessions: Session[],
  personaById: Map<string, Persona>,
): Report["feedback"] {
  // Failures first — they are what the reader needs — then a slice of successes
  // so the feed is not a wall of complaints the product does not deserve.
  const failed = sessions.filter((s) => s.outcome !== "success");
  const succeeded = sessions.filter((s) => s.outcome === "success");
  const chosen = [...failed.slice(0, 40), ...succeeded.slice(0, 20)];

  return chosen.map((session) => {
    const persona = personaById.get(session.personaId);
    return {
      personaId: session.personaId,
      persona: persona ? describePersona(persona) : session.personaId,
      outcome: session.outcome,
      quote: session.quote,
    };
  });
}

/* ──────────────────────────────── helpers ──────────────────────────────── */

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "root";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
