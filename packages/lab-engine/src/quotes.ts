import { hashString, Rng } from "./random.js";
import type { FrictionPoint, Persona, Screen, SessionOutcome } from "./types.js";
import { FRICTION } from "./friction.js";

/**
 * Verbatim feedback.
 *
 * The deterministic path uses templates keyed on the dominant friction cause
 * and the persona's voice. It is intentionally plain: a made-up quote that
 * sounds more insightful than the simulation actually was would be a lie
 * dressed as research. `enrichReport` in llm.ts can rewrite these with a model
 * when one is configured, and the report records which happened.
 */

type Voice = "blunt" | "polite" | "technical" | "weary";

const VOICE_BY_ARCHETYPE: Record<string, Voice> = {
  "college-student": "blunt",
  "older-adult": "polite",
  "first-smartphone": "polite",
  "software-engineer": "technical",
  "small-business-owner": "blunt",
  "busy-parent": "weary",
  "power-user": "technical",
  "screen-reader-user": "technical",
  "low-vision-user": "polite",
  "motor-impairment-user": "polite",
  "slow-network-user": "weary",
  "impatient-shopper": "blunt",
};

const TEMPLATES: Record<string, Record<Voice, string[]>> = {
  [FRICTION.slowLoad]: {
    blunt: ["It just sat there loading. I'm not waiting that long.", "Too slow. Closed it."],
    polite: [
      "I waited a while for it to appear — I wasn't sure if it was working.",
      "It took long enough that I thought my connection had dropped.",
    ],
    technical: [
      "First paint took several seconds on a throttled connection. That's a bundle problem, not a network one.",
      "The screen is shipping far more JavaScript than it needs to render.",
    ],
    weary: ["I don't have time to watch a spinner.", "Loaded slowly, and I gave up."],
  },
  [FRICTION.iconOnlyNavigation]: {
    blunt: ["What are these icons supposed to mean?", "I clicked the wrong icon twice."],
    polite: [
      "I couldn't tell what the little pictures did, so I was afraid to press them.",
      "Some words next to the symbols would help me a great deal.",
    ],
    technical: ["Icon-only nav with no tooltips or labels — pure guesswork.", "The icons carry all the meaning and none of the text."],
    weary: ["I guessed at the icons and ended up somewhere I didn't want to be.", "No idea what those buttons do."],
  },
  [FRICTION.unnamedControl]: {
    blunt: ["There's a button here with nothing on it.", "Half these buttons are blank."],
    polite: ["I found a button but I couldn't tell what it was for.", "One of the buttons had no writing on it."],
    technical: ["Several controls have no accessible name — they announce as 'button'.", "Unlabelled controls; nothing to go on."],
    weary: ["Clicked a blank button and hoped.", "Not sure what I pressed."],
  },
  [FRICTION.keyboardUnreachable]: {
    blunt: ["Tab doesn't get me to half of this.", "Can't use it without a mouse."],
    polite: ["I move around with the keyboard, and I couldn't reach some of the buttons."],
    technical: [
      "Click handlers on non-interactive elements — invisible to tab order and to assistive tech.",
      "Keyboard focus skips straight past the primary action.",
    ],
    weary: ["Gave up trying to tab to it."],
  },
  [FRICTION.invisibleToScreenReader]: {
    blunt: ["My screen reader just says 'image, image, image'.", "Nothing gets announced properly."],
    polite: ["My reader couldn't tell me what the pictures showed."],
    technical: [
      "Images with no alt text and controls with no accessible names — the screen is effectively unlabelled.",
      "Nothing in the accessibility tree describes what this screen does.",
    ],
    weary: ["I couldn't follow what was on the page at all."],
  },
  [FRICTION.noHeading]: {
    blunt: ["What page am I even on?", "No title anywhere."],
    polite: ["I wasn't quite sure which part of the app I had reached."],
    technical: ["No h1 — nothing anchors the page for readers or for search.", "Missing document outline."],
    weary: ["Lost track of where I was."],
  },
  [FRICTION.denseCopy]: {
    blunt: ["Way too much text. I skipped it all.", "I'm not reading all that."],
    polite: ["There was a lot to read before I found what I needed."],
    technical: ["Dense copy above the primary action; the CTA is buried.", "Too much prose, not enough signposting."],
    weary: ["Too many words, not enough time."],
  },
  [FRICTION.deadEnd]: {
    blunt: ["This screen goes nowhere.", "There's no way forward from here."],
    polite: ["I reached a page and couldn't find how to continue."],
    technical: ["Dead-end route — no outbound navigation at all.", "No exit from this screen except the back button."],
    weary: ["Stuck. Closed the tab."],
  },
  [FRICTION.ambiguousLabel]: {
    blunt: ["Nothing here says what I actually wanted.", "None of these options matched what I came for."],
    polite: ["I looked for the thing I wanted and I couldn't see it named anywhere."],
    technical: ["Labels use internal vocabulary, not the user's.", "No affordance maps to the task I arrived with."],
    weary: ["Couldn't find it. Tried a few things, then stopped."],
  },
  [FRICTION.authWall]: {
    blunt: ["Why do I have to sign up before I can even look?", "Account wall straight away. No thanks."],
    polite: ["It asked me to make an account before showing me anything."],
    technical: ["Hard auth gate before any value is demonstrated — that's the drop-off.", "No read-only preview before sign-up."],
    weary: ["Another account to create. I closed it."],
  },
  [FRICTION.longForm]: {
    blunt: ["Too many fields. I bailed.", "I'm not filling in all of that."],
    polite: ["The form asked for rather a lot of details."],
    technical: ["Long required-field form with no progressive disclosure.", "Too many required fields before first value."],
    weary: ["Started the form, ran out of patience."],
  },
  [FRICTION.unlabelledField]: {
    blunt: ["What's supposed to go in this box?", "The boxes have no labels."],
    polite: ["I wasn't sure what to type in one of the fields."],
    technical: ["Placeholder-only fields — the label vanishes as soon as you type.", "Inputs with no associated label element."],
    weary: ["Guessed at what the fields wanted."],
  },
  [FRICTION.navigationLoop]: {
    blunt: ["I keep ending up back where I started.", "This just loops."],
    polite: ["I seemed to go round in a circle."],
    technical: ["Navigation cycle with no breadcrumb or clear hierarchy."],
    weary: ["Went round in circles until I stopped."],
  },
  [FRICTION.smallTarget]: {
    blunt: ["The buttons are too small to hit.", "I keep tapping the wrong thing."],
    polite: ["The buttons were a little close together for me."],
    technical: ["Touch targets below the 44px minimum, packed tightly."],
    weary: ["Mis-tapped three times in a row."],
  },
};

const SUCCESS: Record<Voice, string[]> = {
  blunt: ["Did what I came for. Fine.", "Worked. Took a couple of tries to find it."],
  polite: ["I managed it in the end, thank you.", "It worked once I found the right button."],
  technical: [
    "Flow completed without errors. The path was longer than it needed to be.",
    "Task completed. Would be faster with a direct entry point.",
  ],
  weary: ["Got it done, eventually.", "Fine. Took longer than I'd like."],
};

const NEUTRAL: Record<Voice, string[]> = {
  blunt: ["Not sure what this is for.", "Didn't get very far."],
  polite: ["I had a look around but didn't get where I meant to go."],
  technical: ["Explored a few routes, never reached the target flow."],
  weary: ["Ran out of time before I got anywhere."],
};

/** Pick the quote that matches what actually happened in the session. */
export function quoteFor(
  persona: Persona,
  outcome: SessionOutcome,
  friction: FrictionPoint[],
  lastScreen: Screen | undefined,
): string {
  const voice = VOICE_BY_ARCHETYPE[persona.archetype] ?? "polite";
  const rng = new Rng(hashString(`${persona.id}:quote`));

  if (outcome === "success" && friction.length === 0) {
    return rng.pick(SUCCESS[voice]);
  }

  const dominant = dominantCause(friction);
  if (!dominant) {
    return rng.pick(outcome === "success" ? SUCCESS[voice] : NEUTRAL[voice]);
  }

  const byVoice = TEMPLATES[dominant];
  const options = byVoice?.[voice];
  if (!options || options.length === 0) return rng.pick(NEUTRAL[voice]);

  const quote = rng.pick(options);
  // Anchor the complaint to a screen so a reader can act on it.
  if (lastScreen && rng.chance(0.45)) {
    return `${quote} (on ${lastScreen.title})`;
  }
  return quote;
}

export function dominantCause(friction: FrictionPoint[]): string | undefined {
  if (friction.length === 0) return undefined;
  const totals = new Map<string, number>();
  for (const point of friction) {
    totals.set(point.cause, (totals.get(point.cause) ?? 0) + point.weight);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}
