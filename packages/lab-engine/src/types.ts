/**
 * The shared vocabulary of AI Product Lab.
 *
 * Three models flow through the engine, in order:
 *
 *   1. `ProjectModel`  — what the product *is*, derived statically from source.
 *   2. `Persona`       — who is about to use it, generated from the model.
 *   3. `Report`        — what happened when they did, aggregated from sessions.
 */

/* ────────────────────────────── project model ───────────────────────────── */

export type Framework = "next-app" | "next-pages" | "react-router" | "react" | "unknown";

/** What a user can act on inside a screen. */
export type AffordanceKind = "link" | "button" | "input" | "submit" | "select" | "toggle";

export interface Affordance {
  /** Stable id: `${screenId}:${index}`. */
  id: string;
  kind: AffordanceKind;
  /** Visible text, or the aria-label when there is no text. */
  label: string;
  /** Route this navigates to, when statically resolvable. */
  target?: string;
  /** Rendered with an icon and no accompanying text. */
  iconOnly: boolean;
  /** Has an accessible name (text content, aria-label, or associated <label>). */
  named: boolean;
  /** Reachable and operable with a keyboard (not a click handler on a <div>). */
  keyboardReachable: boolean;
  /** Source line, for evidence links back into the repo. */
  line: number;
  /** 0-based order within the screen, used as a proxy for visual prominence. */
  order: number;
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  labelled: boolean;
  line: number;
}

export interface FormInfo {
  id: string;
  screenId: string;
  fields: FormField[];
  submitLabel: string;
  line: number;
}

/** A route the user can land on, plus everything the engine knows about it. */
export interface Screen {
  id: string;
  /** URL path, e.g. "/dashboard/[id]". */
  path: string;
  /** Repo-relative source file. */
  file: string;
  /** Human title inferred from headings, metadata, or the path. */
  title: string;
  /** Screen sits behind an auth gate. */
  authGated: boolean;
  affordances: Affordance[];
  forms: FormInfo[];
  /** Word count of static copy — high values slow scanners down. */
  wordCount: number;
  /** Has at least one <h1>/<h2>, which orients readers and screen readers alike. */
  hasHeading: boolean;
  /** Client component tree size in bytes of source, a rough proxy for JS weight. */
  weightBytes: number;
  /** Images with no alt attribute. */
  unlabelledImages: number;
  /** Entry point candidates (root, sign-in) get seeded traffic. */
  isEntry: boolean;
  /**
   * Where a successful form submission lands, when it can be resolved: an
   * explicit redirect in the source, or the app's first gated screen for a
   * sign-up/sign-in form. Undefined means submitting appears to go nowhere.
   */
  postSubmitTarget?: string;
}

export interface NavEdge {
  from: string;
  to: string;
  label: string;
  via: AffordanceKind;
}

export type SignalCategory =
  | "accessibility"
  | "performance"
  | "security"
  | "scalability"
  | "usability";

export type SignalSeverity = "notice" | "warning" | "blocker";

/** A finding that comes from reading the code, not from simulating a user. */
export interface StaticSignal {
  id: string;
  category: SignalCategory;
  severity: SignalSeverity;
  title: string;
  detail: string;
  file: string;
  line: number;
  fix: string;
}

export interface ProjectModel {
  name: string;
  framework: Framework;
  screens: Screen[];
  edges: NavEdge[];
  signals: StaticSignal[];
  dependencies: Record<string, string>;
  stats: {
    files: number;
    screens: number;
    affordances: number;
    forms: number;
    sourceBytes: number;
  };
  /** Non-fatal problems hit while reading the project. */
  warnings: string[];
}

/* ──────────────────────────────── personas ──────────────────────────────── */

export type DeviceClass = "iphone" | "android-flagship" | "android-budget" | "tablet" | "desktop";
export type NavigationStyle = "scan" | "read" | "search" | "keyboard" | "explore";
export type AccessibilityNeed =
  | "screen-reader"
  | "large-text"
  | "high-contrast"
  | "reduced-motion"
  | "keyboard-only"
  | "motor-precision";

export interface PersonaArchetype {
  id: string;
  label: string;
  /** Share of the cohort, before normalisation. */
  weight: number;
  ageRange: [number, number];
  occupations: string[];
  /** 0 = never used software like this, 1 = builds software like this. */
  techSkill: [number, number];
  /** Confusing steps tolerated before leaving. */
  patience: [number, number];
  /** Milliseconds of attention for a single sitting. */
  attentionSpanMs: [number, number];
  devices: DeviceClass[];
  navigationStyles: NavigationStyle[];
  accessibilityNeeds: AccessibilityNeed[];
  /** Effective bandwidth in kbps. */
  bandwidthKbps: [number, number];
  /** 0 = never buys, 1 = converts readily. */
  purchaseIntent: [number, number];
}

export interface Persona {
  id: string;
  archetype: string;
  name: string;
  age: number;
  occupation: string;
  device: DeviceClass;
  bandwidthKbps: number;
  techSkill: number;
  patience: number;
  attentionSpanMs: number;
  navigationStyle: NavigationStyle;
  accessibilityNeeds: AccessibilityNeed[];
  purchaseIntent: number;
  /** What this persona came to do, in their own words. */
  goal: string;
  /** Route the goal resolves to. */
  goalScreenId: string;
  /** Keywords the persona will look for in labels while hunting for the goal. */
  goalKeywords: string[];
}

/* ─────────────────────────────── simulation ─────────────────────────────── */

export type SessionOutcome = "success" | "abandoned" | "timeout" | "dead-end" | "blocked";

export type EventKind =
  | "arrive"
  | "read"
  | "click"
  | "type"
  | "submit"
  | "wait"
  | "back"
  | "hesitate"
  | "give-up"
  | "succeed";

export interface SessionEvent {
  /** Milliseconds since session start. */
  at: number;
  kind: EventKind;
  screenId: string;
  /** Affordance acted on, when the event has one. */
  affordanceId?: string;
  /** One line of what the persona did and why. */
  note: string;
  /** Frustration added by this event, 0 when the step went fine. */
  friction: number;
}

/** A friction point, attributed to the thing in the product that caused it. */
export interface FrictionPoint {
  screenId: string;
  affordanceId?: string;
  /** Stable id of the issue class, e.g. "icon-only-navigation". */
  cause: string;
  weight: number;
}

export interface Session {
  personaId: string;
  outcome: SessionOutcome;
  durationMs: number;
  events: SessionEvent[];
  friction: FrictionPoint[];
  /** Screen the persona was on when the session ended. */
  lastScreenId: string;
  /** Screens visited, in order, with repeats. */
  path: string[];
  /** A verbatim comment, the way a beta tester would phrase it. */
  quote: string;
}

/* ───────────────────────────────── report ───────────────────────────────── */

export interface ScoreBreakdown {
  userExperience: number;
  performance: number;
  accessibility: number;
  businessReadiness: number;
  security: number;
  scalability: number;
  overall: number;
  /** Percentage — how ready this looks for real users. */
  launchConfidence: number;
}

export interface UxIssue {
  id: string;
  /** Issue class, shared with `FrictionPoint.cause`. */
  cause: string;
  title: string;
  severity: SignalSeverity;
  /** Share of sessions that hit this, 0-1. */
  affectedShare: number;
  /** Sessions lost to this issue. */
  sessionsLost: number;
  screenId: string;
  file: string;
  line: number;
  detail: string;
  recommendation: string;
  /** Verbatim persona quotes that evidence the issue. */
  evidence: string[];
}

export interface FunnelStep {
  screenId: string;
  path: string;
  title: string;
  entered: number;
  continued: number;
  droppedOff: number;
  /** 0-1. */
  dropOffRate: number;
}

export interface FeatureAdoption {
  screenId: string;
  feature: string;
  /** Predicted share of users who will use this, 0-1. */
  adoption: number;
  /** Sessions where a persona tried to reach it. */
  attempts: number;
  verdict: "invest" | "keep" | "simplify" | "defer";
}

export interface BusinessOutlook {
  day30Retention: number;
  churnRisk: number;
  expectedRating: number;
  supportTicketsPer1000: number;
  conversionRate: number;
  /** The single biggest reason users leave. */
  primaryLeak: string;
}

export interface Recommendation {
  id: string;
  title: string;
  rationale: string;
  /** 1 = do this first. */
  priority: number;
  effort: "low" | "medium" | "high";
  /** Expected point gain on the overall score. */
  impact: number;
}

export interface Report {
  runId: string;
  projectName: string;
  createdAt: string;
  personaCount: number;
  scores: ScoreBreakdown;
  outcomes: Record<SessionOutcome, number>;
  issues: UxIssue[];
  funnel: FunnelStep[];
  adoption: FeatureAdoption[];
  business: BusinessOutlook;
  recommendations: Recommendation[];
  signals: StaticSignal[];
  /** A sample of verbatim feedback, one line per persona. */
  feedback: { personaId: string; persona: string; outcome: SessionOutcome; quote: string }[];
  /** How the report was produced — deterministic simulation, LLM-enriched, or both. */
  provenance: {
    engineVersion: string;
    seed: number;
    llmEnriched: boolean;
    llmModel?: string;
  };
}

export interface SimulationConfig {
  /** Number of AI personas to simulate. */
  personaCount: number;
  /** Deterministic seed — the same seed and project always produce the same report. */
  seed: number;
  /** Cap on steps per session, a safety valve for cyclic navigation graphs. */
  maxStepsPerSession: number;
}

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  personaCount: 100,
  seed: 1,
  maxStepsPerSession: 24,
};

export const ENGINE_VERSION = "0.1.0";
