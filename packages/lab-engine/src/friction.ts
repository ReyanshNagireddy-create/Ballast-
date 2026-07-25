/**
 * Friction causes.
 *
 * Every id here is a claim about the product, not about the persona: it names
 * something in the source that made the session harder. Issue synthesis groups
 * sessions by these ids, which is what lets a report say "412 of 1,000 people
 * hit this specific button" instead of "users were confused".
 */
export const FRICTION = {
  slowLoad: "slow-load",
  iconOnlyNavigation: "icon-only-navigation",
  unnamedControl: "unnamed-control",
  keyboardUnreachable: "keyboard-unreachable",
  invisibleToScreenReader: "invisible-to-screen-reader",
  noHeading: "no-heading",
  denseCopy: "dense-copy",
  deadEnd: "dead-end",
  ambiguousLabel: "ambiguous-label",
  authWall: "auth-wall",
  longForm: "long-form",
  unlabelledField: "unlabelled-field",
  navigationLoop: "navigation-loop",
  smallTarget: "small-target",
} as const;

export type FrictionCause = (typeof FRICTION)[keyof typeof FRICTION];

/** Plain-English rendering of a cause, for quotes, notes, and report copy. */
export function readableCause(cause: string): string {
  switch (cause) {
    case FRICTION.slowLoad:
      return "the app took too long to load";
    case FRICTION.iconOnlyNavigation:
      return "the icon-only navigation gave nothing away";
    case FRICTION.unnamedControl:
      return "controls with no labels";
    case FRICTION.keyboardUnreachable:
      return "controls that a keyboard cannot reach";
    case FRICTION.invisibleToScreenReader:
      return "content a screen reader cannot announce";
    case FRICTION.noHeading:
      return "no heading explaining the screen";
    case FRICTION.denseCopy:
      return "a wall of text";
    case FRICTION.deadEnd:
      return "a screen with no way forward";
    case FRICTION.ambiguousLabel:
      return "labels that did not match what they wanted";
    case FRICTION.authWall:
      return "being asked to sign in first";
    case FRICTION.longForm:
      return "a form that asked for too much";
    case FRICTION.unlabelledField:
      return "form fields with no labels";
    case FRICTION.navigationLoop:
      return "navigation that went in circles";
    case FRICTION.smallTarget:
      return "tap targets too small to hit";
    default:
      return cause.replace(/-/g, " ");
  }
}

/** Which category a cause counts against when scoring. */
export function causeCategory(cause: string): "accessibility" | "performance" | "usability" {
  switch (cause) {
    case FRICTION.keyboardUnreachable:
    case FRICTION.invisibleToScreenReader:
    case FRICTION.unnamedControl:
    case FRICTION.unlabelledField:
    case FRICTION.smallTarget:
      return "accessibility";
    case FRICTION.slowLoad:
      return "performance";
    default:
      return "usability";
  }
}
