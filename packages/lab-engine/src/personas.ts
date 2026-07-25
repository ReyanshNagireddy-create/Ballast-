import { Rng } from "./random.js";
import type { Persona, PersonaArchetype, ProjectModel, Screen } from "./types.js";

/**
 * The cohort.
 *
 * Weights are rough population shares for a consumer web product, not a claim
 * about any specific market. What matters for the simulation is that the tails
 * are represented: a cohort of 100 median users finds nothing, because the
 * median user is exactly who the product was designed for.
 */
export const ARCHETYPES: PersonaArchetype[] = [
  {
    id: "college-student",
    label: "College student",
    weight: 12,
    ageRange: [18, 24],
    occupations: ["Student", "Student and part-time barista", "Grad student"],
    techSkill: [0.55, 0.85],
    patience: [1, 3],
    attentionSpanMs: [45_000, 120_000],
    devices: ["iphone", "android-flagship"],
    navigationStyles: ["scan", "scan", "explore"],
    accessibilityNeeds: [],
    bandwidthKbps: [3_000, 30_000],
    purchaseIntent: [0.05, 0.3],
  },
  {
    id: "older-adult",
    label: "Older adult",
    weight: 10,
    ageRange: [58, 79],
    occupations: ["Retired teacher", "Retired", "Part-time bookkeeper"],
    techSkill: [0.1, 0.4],
    patience: [3, 6],
    attentionSpanMs: [180_000, 420_000],
    devices: ["tablet", "desktop", "android-budget"],
    navigationStyles: ["read", "read", "search"],
    accessibilityNeeds: ["large-text", "high-contrast"],
    bandwidthKbps: [1_500, 12_000],
    purchaseIntent: [0.15, 0.5],
  },
  {
    id: "first-smartphone",
    label: "First-time smartphone owner",
    weight: 6,
    ageRange: [16, 62],
    occupations: ["Warehouse associate", "Farm worker", "Home carer"],
    techSkill: [0.05, 0.25],
    patience: [2, 5],
    attentionSpanMs: [120_000, 300_000],
    devices: ["android-budget"],
    navigationStyles: ["read", "explore"],
    accessibilityNeeds: [],
    bandwidthKbps: [400, 3_000],
    purchaseIntent: [0.05, 0.2],
  },
  {
    id: "software-engineer",
    label: "Software engineer",
    weight: 9,
    ageRange: [23, 48],
    occupations: ["Backend engineer", "Frontend engineer", "SRE", "Data engineer"],
    techSkill: [0.85, 1],
    patience: [2, 5],
    attentionSpanMs: [120_000, 400_000],
    devices: ["desktop", "iphone"],
    navigationStyles: ["keyboard", "search", "explore"],
    accessibilityNeeds: [],
    bandwidthKbps: [20_000, 200_000],
    purchaseIntent: [0.1, 0.45],
  },
  {
    id: "small-business-owner",
    label: "Small business owner",
    weight: 11,
    ageRange: [28, 61],
    occupations: ["Cafe owner", "Plumber", "Salon owner", "Freelance designer"],
    techSkill: [0.3, 0.6],
    patience: [2, 4],
    attentionSpanMs: [90_000, 240_000],
    devices: ["iphone", "desktop", "android-flagship"],
    navigationStyles: ["search", "scan"],
    accessibilityNeeds: [],
    bandwidthKbps: [2_000, 40_000],
    purchaseIntent: [0.3, 0.75],
  },
  {
    id: "busy-parent",
    label: "Busy parent",
    weight: 12,
    ageRange: [29, 47],
    occupations: ["Nurse", "Teacher", "Project manager", "Stay-at-home parent"],
    techSkill: [0.35, 0.7],
    patience: [1, 3],
    attentionSpanMs: [30_000, 90_000],
    devices: ["iphone", "android-flagship"],
    navigationStyles: ["scan", "search"],
    accessibilityNeeds: [],
    bandwidthKbps: [1_000, 25_000],
    purchaseIntent: [0.2, 0.6],
  },
  {
    id: "power-user",
    label: "Power user",
    weight: 8,
    ageRange: [22, 52],
    occupations: ["Ops analyst", "Consultant", "Product manager"],
    techSkill: [0.7, 0.95],
    patience: [4, 8],
    attentionSpanMs: [300_000, 900_000],
    devices: ["desktop", "tablet"],
    navigationStyles: ["explore", "keyboard", "search"],
    accessibilityNeeds: [],
    bandwidthKbps: [20_000, 150_000],
    purchaseIntent: [0.35, 0.8],
  },
  {
    id: "screen-reader-user",
    label: "Screen reader user",
    weight: 5,
    ageRange: [21, 65],
    occupations: ["Accessibility consultant", "Customer support lead", "Student"],
    techSkill: [0.5, 0.9],
    patience: [3, 6],
    attentionSpanMs: [180_000, 480_000],
    devices: ["desktop", "iphone"],
    navigationStyles: ["keyboard"],
    accessibilityNeeds: ["screen-reader", "keyboard-only"],
    bandwidthKbps: [5_000, 60_000],
    purchaseIntent: [0.15, 0.5],
  },
  {
    id: "low-vision-user",
    label: "Low-vision user",
    weight: 5,
    ageRange: [30, 74],
    occupations: ["Librarian", "Retired engineer", "Administrator"],
    techSkill: [0.3, 0.7],
    patience: [3, 6],
    attentionSpanMs: [180_000, 420_000],
    devices: ["desktop", "tablet"],
    navigationStyles: ["read", "keyboard"],
    accessibilityNeeds: ["large-text", "high-contrast", "reduced-motion"],
    bandwidthKbps: [5_000, 50_000],
    purchaseIntent: [0.15, 0.5],
  },
  {
    id: "motor-impairment-user",
    label: "User with limited motor precision",
    weight: 4,
    ageRange: [24, 71],
    occupations: ["Writer", "Analyst", "Retired"],
    techSkill: [0.35, 0.75],
    patience: [3, 7],
    attentionSpanMs: [180_000, 480_000],
    devices: ["desktop", "tablet"],
    navigationStyles: ["keyboard", "read"],
    accessibilityNeeds: ["motor-precision", "keyboard-only", "reduced-motion"],
    bandwidthKbps: [5_000, 50_000],
    purchaseIntent: [0.1, 0.45],
  },
  {
    id: "slow-network-user",
    label: "User on a slow connection",
    weight: 8,
    ageRange: [18, 60],
    occupations: ["Rural teacher", "Field technician", "Commuter"],
    techSkill: [0.3, 0.7],
    patience: [2, 4],
    attentionSpanMs: [60_000, 180_000],
    devices: ["android-budget", "android-flagship"],
    navigationStyles: ["scan", "read"],
    accessibilityNeeds: [],
    bandwidthKbps: [150, 1_200],
    purchaseIntent: [0.1, 0.4],
  },
  {
    id: "impatient-shopper",
    label: "Impatient shopper",
    weight: 10,
    ageRange: [19, 55],
    occupations: ["Sales rep", "Recruiter", "Marketing lead"],
    techSkill: [0.4, 0.75],
    patience: [1, 2],
    attentionSpanMs: [20_000, 60_000],
    devices: ["iphone", "android-flagship"],
    navigationStyles: ["scan"],
    accessibilityNeeds: [],
    bandwidthKbps: [3_000, 50_000],
    purchaseIntent: [0.4, 0.9],
  },
];

const FIRST_NAMES = [
  "Emily", "David", "Alex", "Priya", "Marcus", "Sofia", "Jamal", "Yuki", "Nora", "Tom",
  "Grace", "Ibrahim", "Lena", "Diego", "Ruth", "Kwame", "Mei", "Oscar", "Hannah", "Sam",
  "Ines", "Nikhil", "Clara", "Andre", "Fatima", "Leo", "Maya", "Peter", "Zara", "Ben",
];

const LAST_INITIALS = "ABCDEFGHIJKLMNOPRSTVW".split("");

/** Generate a reproducible cohort sized to `count`, weighted by archetype. */
export function generatePersonas(model: ProjectModel, count: number, seed: number): Persona[] {
  const rng = new Rng(seed);
  const goals = deriveGoals(model);
  const personas: Persona[] = [];

  for (let i = 0; i < count; i++) {
    const archetype = rng.weighted(ARCHETYPES, (a) => a.weight);
    const goal = pickGoal(rng, goals, archetype);
    personas.push({
      id: `p${String(i + 1).padStart(4, "0")}`,
      archetype: archetype.id,
      name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_INITIALS)}.`,
      age: rng.intRange(archetype.ageRange),
      occupation: rng.pick(archetype.occupations),
      device: rng.pick(archetype.devices),
      bandwidthKbps: Math.round(rng.range(archetype.bandwidthKbps)),
      techSkill: round2(rng.range(archetype.techSkill)),
      patience: rng.intRange(archetype.patience),
      attentionSpanMs: Math.round(rng.range(archetype.attentionSpanMs)),
      navigationStyle: rng.pick(archetype.navigationStyles),
      accessibilityNeeds: [...archetype.accessibilityNeeds],
      purchaseIntent: round2(rng.range(archetype.purchaseIntent)),
      goal: goal.text,
      goalScreenId: goal.screenId,
      goalKeywords: goal.keywords,
    });
  }
  return personas;
}

export interface Goal {
  screenId: string;
  text: string;
  keywords: string[];
  /** Relative share of the cohort that arrives wanting this. */
  weight: number;
}

/**
 * Infer what people are arriving to do.
 *
 * Goals come from the product itself: every reachable screen is something
 * somebody wants to get to, and screens that many other screens link to are
 * wanted more often. Conversion screens are boosted because that is where the
 * product's own incentives point.
 */
export function deriveGoals(model: ProjectModel): Goal[] {
  const inbound = new Map<string, number>();
  for (const edge of model.edges) {
    inbound.set(edge.to, (inbound.get(edge.to) ?? 0) + 1);
  }

  const goals: Goal[] = [];
  for (const screen of model.screens) {
    // Landing on the home page is not a goal; signing up very much is, so only
    // the root is excluded rather than every entry point.
    if (screen.path === "/" && model.screens.length > 1) continue;
    const links = inbound.get(screen.id) ?? 0;
    goals.push({
      screenId: screen.id,
      text: goalText(screen),
      keywords: goalKeywords(screen),
      weight: 1 + links * 1.5 + intentBoost(screen.path),
    });
  }
  if (goals.length === 0 && model.screens[0]) {
    const only = model.screens[0];
    goals.push({
      screenId: only.id,
      text: `Understand what ${model.name} does`,
      keywords: goalKeywords(only),
      weight: 1,
    });
  }
  return goals;
}

function intentBoost(path: string): number {
  if (/(checkout|pricing|upgrade|subscribe|buy|plans)/.test(path)) return 4;
  if (/(sign-up|signup|register|onboarding|start)/.test(path)) return 3;
  if (/(dashboard|home|app)/.test(path)) return 2;
  if (/(settings|account|profile)/.test(path)) return 0.5;
  return 0;
}

function goalText(screen: Screen): string {
  const noun = screen.title.toLowerCase();
  if (/checkout|cart|payment/.test(screen.path)) return `Pay for ${noun}`;
  if (/pricing|plans/.test(screen.path)) return "Work out what this costs";
  if (/sign-up|signup|register/.test(screen.path)) return "Create an account";
  if (/sign-in|signin|login/.test(screen.path)) return "Get back into my account";
  if (/settings|account|profile/.test(screen.path)) return `Change my ${noun} settings`;
  if (/new|create|add/.test(screen.path)) return `Create a new ${noun}`;
  if (/\[.+\]/.test(screen.path)) return `Open a specific ${noun}`;
  return `Get to ${screen.title}`;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "for", "my", "your", "get", "go", "page", "new",
]);

function goalKeywords(screen: Screen): string[] {
  const words = `${screen.path} ${screen.title}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

function pickGoal(rng: Rng, goals: Goal[], archetype: PersonaArchetype): Goal {
  // Buyers gravitate to conversion screens; explorers spread out evenly.
  const buyer = archetype.purchaseIntent[1] > 0.5;
  return rng.weighted(goals, (g) => {
    const commercial = /(checkout|pricing|upgrade|subscribe|buy|plans)/.test(g.screenId);
    if (buyer && commercial) return g.weight * 2;
    return g.weight;
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Human-readable one-liner, used in reports and the live feed. */
export function describePersona(persona: Persona): string {
  const bits = [
    `${persona.name}, ${persona.age}`,
    persona.occupation,
    deviceLabel(persona.device),
  ];
  if (persona.accessibilityNeeds.length > 0) {
    bits.push(persona.accessibilityNeeds.join(", "));
  }
  if (persona.bandwidthKbps < 1500) bits.push("slow connection");
  return bits.join(" · ");
}

export function deviceLabel(device: Persona["device"]): string {
  switch (device) {
    case "iphone":
      return "iPhone";
    case "android-flagship":
      return "Android";
    case "android-budget":
      return "Budget Android";
    case "tablet":
      return "Tablet";
    case "desktop":
      return "Desktop";
  }
}
