import { hashString, Rng } from "./random.js";
import { FRICTION, readableCause } from "./friction.js";
import { quoteFor } from "./quotes.js";
import type {
  Affordance,
  FrictionPoint,
  Persona,
  ProjectModel,
  Screen,
  Session,
  SessionEvent,
  SessionOutcome,
  SimulationConfig,
} from "./types.js";

export { FRICTION, readableCause } from "./friction.js";
export type { FrictionCause } from "./friction.js";

export interface SimContext {
  model: ProjectModel;
  byId: Map<string, Screen>;
  /** goalScreenId → (screenId → hops to goal). */
  distances: Map<string, Map<string, number>>;
  entries: Screen[];
}

export function prepareContext(model: ProjectModel): SimContext {
  const byId = new Map(model.screens.map((s) => [s.id, s]));
  const entries = model.screens.filter((s) => s.isEntry);
  const distances = new Map<string, Map<string, number>>();
  for (const screen of model.screens) {
    distances.set(screen.id, hopsToGoal(model, screen.id));
  }
  return {
    model,
    byId,
    distances,
    entries: entries.length > 0 ? entries : model.screens.slice(0, 1),
  };
}

/** Reverse BFS: how many clicks each screen is from `goalId`. */
function hopsToGoal(model: ProjectModel, goalId: string): Map<string, number> {
  const incoming = new Map<string, string[]>();
  for (const edge of model.edges) {
    const list = incoming.get(edge.to);
    if (list) list.push(edge.from);
    else incoming.set(edge.to, [edge.from]);
  }
  const dist = new Map<string, number>([[goalId, 0]]);
  const queue: string[] = [goalId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const depth = dist.get(current)!;
    for (const previous of incoming.get(current) ?? []) {
      if (dist.has(previous)) continue;
      dist.set(previous, depth + 1);
      queue.push(previous);
    }
  }
  return dist;
}

/** Run the whole cohort. Sessions come back in persona order. */
export function simulate(
  model: ProjectModel,
  personas: Persona[],
  config: SimulationConfig,
): Session[] {
  const context = prepareContext(model);
  return personas.map((persona) => simulateSession(context, persona, config));
}

export function simulateSession(
  context: SimContext,
  persona: Persona,
  config: SimulationConfig,
): Session {
  const rng = new Rng(hashString(persona.id) ^ config.seed);
  const events: SessionEvent[] = [];
  const friction: FrictionPoint[] = [];
  const path: string[] = [];
  const visits = new Map<string, number>();

  let clock = 0;
  let frustration = 0;
  let outcome: SessionOutcome = "abandoned";

  const record = (event: SessionEvent) => {
    events.push(event);
    if (event.friction > 0) frustration += event.friction;
  };
  const blame = (screenId: string, cause: string, weight: number, affordanceId?: string) => {
    friction.push({ screenId, cause, weight, ...(affordanceId ? { affordanceId } : {}) });
  };

  let screen = rng.pick(context.entries);
  const goalScreen = context.byId.get(persona.goalScreenId) ?? screen;
  let steps = 0;

  while (steps < config.maxStepsPerSession) {
    steps++;
    path.push(screen.id);
    visits.set(screen.id, (visits.get(screen.id) ?? 0) + 1);

    /* ── arrival: the network happens before the design does ── */
    const loadMs = loadTimeMs(screen, persona);
    clock += loadMs;
    record({
      at: clock,
      kind: "arrive",
      screenId: screen.id,
      note: `Landed on ${screen.title} (${formatMs(loadMs)} to load on ${persona.bandwidthKbps} kbps)`,
      friction: 0,
    });
    if (loadMs > 3_000) {
      const weight = Math.min(2.5, loadMs / 3_000);
      record({
        at: clock,
        kind: "wait",
        screenId: screen.id,
        note: `Stared at a blank screen for ${formatMs(loadMs)}`,
        friction: weight,
      });
      blame(screen.id, FRICTION.slowLoad, weight);
    }

    /* ── orientation: can this person work out what they are looking at? ── */
    const readMs = readTimeMs(screen, persona);
    clock += readMs;
    const orientation = assessOrientation(screen, persona);
    record({
      at: clock,
      kind: "read",
      screenId: screen.id,
      note: orientation.note,
      friction: orientation.friction,
    });
    for (const cause of orientation.causes) {
      blame(screen.id, cause, orientation.friction / Math.max(1, orientation.causes.length));
    }

    if (screen.id === goalScreen.id) {
      const finish = attemptGoal(screen, persona, rng, clock);
      for (const event of finish.events) record(event);
      for (const point of finish.friction) friction.push(point);
      clock = finish.clock;
      if (finish.completed) {
        outcome = "success";
        break;
      }
      // Failing at the goal screen itself is the most expensive kind of failure.
      frustration += 1;
    }

    if (frustration > persona.patience) {
      outcome = "abandoned";
      record({
        at: clock,
        kind: "give-up",
        screenId: screen.id,
        note: `Gave up: ${describeFrustration(friction)}`,
        friction: 0,
      });
      break;
    }
    if (clock > persona.attentionSpanMs) {
      outcome = "timeout";
      record({
        at: clock,
        kind: "give-up",
        screenId: screen.id,
        note: `Ran out of time after ${formatMs(clock)} without reaching "${persona.goal}"`,
        friction: 0,
      });
      break;
    }

    /* ── the click: pick the affordance that looks most like the goal ── */
    const options = navigableAffordances(screen, context);
    if (options.length === 0) {
      outcome = "dead-end";
      const note =
        screen.forms.length > 0
          ? `Filled in ${screen.title} and had no idea where submitting would take them`
          : `Nothing on ${screen.title} leads anywhere — dead end`;
      record({ at: clock, kind: "give-up", screenId: screen.id, note, friction: 2 });
      blame(screen.id, FRICTION.deadEnd, 2);
      break;
    }

    const choice = chooseAffordance(options, screen, persona, context, rng);
    clock += clickCostMs(persona);
    record({
      at: clock,
      kind: "click",
      screenId: screen.id,
      affordanceId: choice.affordance.id,
      note: `Clicked "${choice.affordance.label}" — ${choice.reason}`,
      friction: choice.friction,
    });
    for (const cause of choice.causes) {
      blame(screen.id, cause, choice.friction / Math.max(1, choice.causes.length), choice.affordance.id);
    }

    // Getting past a form means filling it in, and that is where people quit.
    if (isFormSubmit(choice.affordance)) {
      const attempt = fillForm(screen, persona, rng, clock);
      for (const event of attempt.events) record(event);
      for (const point of attempt.friction) friction.push(point);
      clock = attempt.clock;
      if (!attempt.completed) {
        outcome = "abandoned";
        break;
      }
    }

    const next = context.byId.get(choice.affordance.target!);
    if (!next) {
      outcome = "dead-end";
      record({
        at: clock,
        kind: "give-up",
        screenId: screen.id,
        note: `"${choice.affordance.label}" leads to a screen that does not exist`,
        friction: 2,
      });
      blame(screen.id, FRICTION.deadEnd, 2, choice.affordance.id);
      break;
    }

    // Auth walls are not a bug, but they are a cost, and unauthenticated
    // visitors pay it right at the moment their intent is highest.
    if (next.authGated && !next.isEntry) {
      const weight = 0.6 + (1 - persona.techSkill) * 0.8;
      record({
        at: clock,
        kind: "hesitate",
        screenId: next.id,
        note: `Hit a sign-in wall before seeing any of ${next.title}`,
        friction: weight,
      });
      blame(next.id, FRICTION.authWall, weight);
    }

    if ((visits.get(next.id) ?? 0) >= 2) {
      const weight = 0.9;
      record({
        at: clock,
        kind: "back",
        screenId: next.id,
        note: `Back on ${next.title} for the third time — going in circles`,
        friction: weight,
      });
      blame(next.id, FRICTION.navigationLoop, weight);
    }

    screen = next;
  }

  if (steps >= config.maxStepsPerSession && outcome !== "success") {
    outcome = "timeout";
  }

  const lastScreenId = path[path.length - 1] ?? screen.id;
  return {
    personaId: persona.id,
    outcome,
    durationMs: Math.round(clock),
    events,
    friction,
    lastScreenId,
    path,
    quote: quoteFor(persona, outcome, friction, context.byId.get(lastScreenId)),
  };
}

/* ─────────────────────────────── mechanics ─────────────────────────────── */

/** Transfer time for the screen's client payload, plus device parse cost. */
export function loadTimeMs(screen: Screen, persona: Persona): number {
  const bytes = Math.max(20_000, screen.weightBytes);
  const transferMs = (bytes * 8) / Math.max(50, persona.bandwidthKbps);
  const parseMultiplier =
    persona.device === "android-budget" ? 2.6 : persona.device === "tablet" ? 1.3 : 1;
  const parseMs = (bytes / 1024) * 1.4 * parseMultiplier;
  return Math.round(transferMs + parseMs);
}

function readTimeMs(screen: Screen, persona: Persona): number {
  const wordsPerMinute =
    persona.navigationStyle === "scan" ? 700 : persona.navigationStyle === "read" ? 180 : 320;
  const slowdown = persona.accessibilityNeeds.includes("screen-reader") ? 2.2 : 1;
  const words = persona.navigationStyle === "scan" ? screen.wordCount * 0.35 : screen.wordCount;
  return Math.round((words / wordsPerMinute) * 60_000 * slowdown);
}

function clickCostMs(persona: Persona): number {
  const base = persona.device === "desktop" ? 700 : 950;
  const precision = persona.accessibilityNeeds.includes("motor-precision") ? 2.4 : 1;
  const skill = 1.6 - persona.techSkill * 0.7;
  return Math.round(base * precision * skill);
}

interface Orientation {
  note: string;
  friction: number;
  causes: string[];
}

/** Everything that happens between landing and knowing where to click. */
function assessOrientation(screen: Screen, persona: Persona): Orientation {
  const causes: string[] = [];
  let friction = 0;
  const notes: string[] = [];

  if (!screen.hasHeading) {
    const weight = persona.accessibilityNeeds.includes("screen-reader")
      ? 1.4
      : persona.navigationStyle === "read"
        ? 0.7
        : 0.35;
    friction += weight;
    causes.push(FRICTION.noHeading);
    notes.push("no heading to say what this screen is");
  }

  if (screen.wordCount > 420 && persona.navigationStyle === "scan") {
    friction += 0.6;
    causes.push(FRICTION.denseCopy);
    notes.push(`${screen.wordCount} words of copy to wade through`);
  }

  if (screen.unlabelledImages > 0 && persona.accessibilityNeeds.includes("screen-reader")) {
    const weight = Math.min(1.6, screen.unlabelledImages * 0.5);
    friction += weight;
    causes.push(FRICTION.invisibleToScreenReader);
    notes.push(`${screen.unlabelledImages} unlabelled image(s) announced as "image"`);
  }

  const unnamed = screen.affordances.filter((a) => !a.named).length;
  if (unnamed > 0 && persona.accessibilityNeeds.includes("screen-reader")) {
    const weight = Math.min(2, unnamed * 0.6);
    friction += weight;
    causes.push(FRICTION.unnamedControl);
    notes.push(`${unnamed} control(s) with no accessible name`);
  }

  if (
    persona.accessibilityNeeds.includes("large-text") &&
    screen.affordances.length > 14 &&
    persona.device !== "desktop"
  ) {
    friction += 0.5;
    causes.push(FRICTION.smallTarget);
    notes.push("controls packed too tightly to hit at large text sizes");
  }

  const note =
    notes.length === 0
      ? `Scanned ${screen.title} and knew where to go`
      : `Struggled on ${screen.title}: ${notes.join("; ")}`;
  return { note, friction: round2(friction), causes };
}

/**
 * Everything on this screen that leads somewhere else.
 *
 * Forms are included as a synthetic submit affordance: "fill this in" is a real
 * way forward, and a sign-up page with no links out is not a dead end.
 */
function navigableAffordances(screen: Screen, context: SimContext): Affordance[] {
  const links = screen.affordances.filter((a) => a.target && context.byId.has(a.target));
  const form = screen.forms[0];
  if (!form || !screen.postSubmitTarget || !context.byId.has(screen.postSubmitTarget)) {
    return links;
  }
  const submit: Affordance = {
    id: `${form.id}:submit`,
    kind: "submit",
    label: form.submitLabel,
    target: screen.postSubmitTarget,
    iconOnly: false,
    named: form.submitLabel.length > 0,
    keyboardReachable: true,
    line: form.line,
    order: screen.affordances.length,
  };
  return [...links, submit];
}

/** True when the chosen affordance is the synthetic "submit this form" option. */
function isFormSubmit(affordance: Affordance): boolean {
  return affordance.id.endsWith(":submit") && affordance.id.includes(":form:");
}

interface Choice {
  affordance: Affordance;
  reason: string;
  friction: number;
  causes: string[];
}

/**
 * Pick what to click.
 *
 * The persona cannot see the route graph — only labels. Relevance is measured
 * on the label alone; the true distance to the goal is folded in with a weight
 * proportional to tech skill, which is the engine's model of "experienced users
 * guess correctly more often". Everything else is noise, and noise is what
 * produces the long tail of sessions worth reading.
 */
function chooseAffordance(
  options: Affordance[],
  screen: Screen,
  persona: Persona,
  context: SimContext,
  rng: Rng,
): Choice {
  const distances = context.distances.get(persona.goalScreenId);

  // Sometimes people do not read at all — they click the first plausible thing
  // and find out. Scanners and less confident users do it more. Without this
  // the cohort navigates a well-labelled app perfectly, and wrong turns, loops,
  // and orphaned screens never surface in the funnel.
  const skimming = rng.chance(
    (1 - persona.techSkill) * 0.18 + (persona.navigationStyle === "scan" ? 0.12 : 0),
  );

  const scored = options.map((affordance) => {
    const relevance = skimming ? 0 : labelRelevance(affordance.label, persona.goalKeywords);
    const hops = distances?.get(affordance.target!);
    const proximity = hops === undefined ? 0 : 1 / (1 + hops);
    // Prominence: things near the top of the file are usually near the top of
    // the screen, and scanners rarely look past the first handful of options.
    const prominence = persona.navigationStyle === "scan" ? 1 / (1 + affordance.order * 0.12) : 1;
    const intuition = persona.techSkill;

    let score = relevance * 2.5 + proximity * 2.2 * intuition + prominence * (skimming ? 2.2 : 0.8);
    if (affordance.iconOnly) score -= (1 - persona.techSkill) * 1.6;
    if (!affordance.named) score -= 1.2;
    if (!affordance.keyboardReachable && persona.accessibilityNeeds.includes("keyboard-only")) {
      score = -Infinity; // literally cannot be operated
    }
    // Noise scales inversely with skill: an expert reliably picks the best
    // option, a novice sometimes clicks the wrong thing even when the right
    // one is labelled clearly. Without this the cohort navigates perfectly and
    // no wrong-turn ever shows up in the funnel.
    const noise = 0.6 + (1 - persona.techSkill) * 2.4;
    return { affordance, score: score + rng.float(0, noise) };
  });

  const viable = scored.filter((s) => Number.isFinite(s.score));
  if (viable.length === 0) {
    // Every route out of this screen is mouse-only.
    const blocked = options[0]!;
    return {
      affordance: blocked,
      reason: "could not operate any control here with a keyboard",
      friction: 2.5,
      causes: [FRICTION.keyboardUnreachable],
    };
  }

  viable.sort((a, b) => b.score - a.score);
  const best = viable[0]!.affordance;

  const causes: string[] = [];
  let friction = 0;
  const reasons: string[] = [];

  if (best.iconOnly) {
    const weight = (1 - persona.techSkill) * 1.5;
    if (weight > 0.3) {
      friction += weight;
      causes.push(FRICTION.iconOnlyNavigation);
      reasons.push("guessed from the icon alone");
    }
  }
  if (!best.named) {
    friction += 1;
    causes.push(FRICTION.unnamedControl);
    reasons.push("the control has no label at all");
  }
  if (!best.keyboardReachable && persona.accessibilityNeeds.includes("keyboard-only")) {
    friction += 2;
    causes.push(FRICTION.keyboardUnreachable);
  }

  const relevance = labelRelevance(best.label, persona.goalKeywords);
  const hops = distances?.get(best.target!) ?? Infinity;
  const currentHops = distances?.get(screen.id) ?? Infinity;
  if (relevance < 0.2 && hops >= currentHops) {
    const weight = 0.8;
    friction += weight;
    causes.push(FRICTION.ambiguousLabel);
    reasons.push(`nothing here obviously said "${persona.goalKeywords[0] ?? persona.goal}"`);
  } else if (reasons.length === 0) {
    reasons.push(`it looked like the way to ${persona.goal.toLowerCase()}`);
  }

  return {
    affordance: best,
    reason: reasons.join(", "),
    friction: round2(friction),
    causes,
  };
}

/** Token overlap between a control's label and what the persona is hunting for. */
export function labelRelevance(label: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const tokens = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const keyword of keywords) {
    if (tokens.some((t) => t === keyword || t.startsWith(keyword) || keyword.startsWith(t))) {
      hits++;
    }
  }
  return hits / keywords.length;
}

interface GoalAttempt {
  completed: boolean;
  clock: number;
  events: SessionEvent[];
  friction: FrictionPoint[];
}

/** Reaching the right screen is not finishing; forms are where people quit. */
function attemptGoal(
  screen: Screen,
  persona: Persona,
  rng: Rng,
  startClock: number,
): GoalAttempt {
  const form = screen.forms[0];
  if (!form) {
    const clock = startClock + 800;
    return {
      completed: true,
      clock,
      events: [
        {
          at: clock,
          kind: "succeed",
          screenId: screen.id,
          note: `Reached "${persona.goal}" in ${formatMs(clock)}`,
          friction: 0,
        },
      ],
      friction: [],
    };
  }

  const attempt = fillForm(screen, persona, rng, startClock);
  if (!attempt.completed) return attempt;

  attempt.events.push({
    at: attempt.clock,
    kind: "succeed",
    screenId: screen.id,
    note: `Completed "${persona.goal}" in ${formatMs(attempt.clock)}`,
    friction: 0,
  });
  return attempt;
}

/**
 * Fill in and submit the screen's form.
 *
 * Abandonment rises with length and unlabelled fields, and falls with how badly
 * this persona wants the outcome — which is why a checkout form survives length
 * that a newsletter signup would not.
 */
function fillForm(screen: Screen, persona: Persona, rng: Rng, startClock: number): GoalAttempt {
  const events: SessionEvent[] = [];
  const friction: FrictionPoint[] = [];
  let clock = startClock;

  const form = screen.forms[0];
  if (!form) return { completed: true, clock, events, friction };

  const required = form.fields.filter((f) => f.required).length || form.fields.length;
  const unlabelled = form.fields.filter((f) => !f.labelled).length;

  for (const field of form.fields) {
    clock += typingCostMs(field.type, persona);
    events.push({
      at: clock,
      kind: "type",
      screenId: screen.id,
      note: `Filled in "${field.name}"${field.labelled ? "" : " (no label — guessed what it wanted)"}`,
      friction: field.labelled ? 0 : 0.5,
    });
    if (!field.labelled) {
      friction.push({
        screenId: screen.id,
        affordanceId: `${form.id}:field:${field.name}`,
        cause: FRICTION.unlabelledField,
        weight: 0.5,
      });
    }
  }

  if (required >= 6) {
    const weight = Math.min(2.2, (required - 5) * 0.6);
    events.push({
      at: clock,
      kind: "hesitate",
      screenId: screen.id,
      note: `${required} required fields before anything happens`,
      friction: weight,
    });
    friction.push({
      screenId: screen.id,
      affordanceId: form.id,
      cause: FRICTION.longForm,
      weight,
    });
  }

  const abandonChance = clamp(
    0.06 + required * 0.045 + unlabelled * 0.06 - persona.purchaseIntent * 0.25 - persona.patience * 0.03,
    0.02,
    0.85,
  );
  if (rng.chance(abandonChance)) {
    events.push({
      at: clock,
      kind: "give-up",
      screenId: screen.id,
      note: `Abandoned the ${form.submitLabel.toLowerCase()} form partway through`,
      friction: 1.5,
    });
    friction.push({
      screenId: screen.id,
      affordanceId: form.id,
      cause: FRICTION.longForm,
      weight: 1.5,
    });
    return { completed: false, clock, events, friction };
  }

  clock += 600;
  events.push({
    at: clock,
    kind: "submit",
    screenId: screen.id,
    note: `Submitted "${form.submitLabel}"`,
    friction: 0,
  });
  return { completed: true, clock, events, friction };
}

function typingCostMs(type: string, persona: Persona): number {
  const base = type === "password" ? 6_000 : type === "email" ? 5_000 : type === "select" ? 2_500 : 4_000;
  const device = persona.device === "desktop" ? 0.75 : 1.25;
  const precision = persona.accessibilityNeeds.includes("motor-precision") ? 2 : 1;
  const skill = 1.5 - persona.techSkill * 0.6;
  return Math.round(base * device * precision * skill);
}

function describeFrustration(friction: FrictionPoint[]): string {
  const totals = new Map<string, number>();
  for (const point of friction) {
    totals.set(point.cause, (totals.get(point.cause) ?? 0) + point.weight);
  }
  const worst = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return worst ? readableCause(worst[0]) : "lost patience";
}

export function formatMs(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1_000)}s`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
