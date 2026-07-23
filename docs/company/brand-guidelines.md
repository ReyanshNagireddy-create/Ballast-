# Ballast Brand Guidelines

*v1.0 — July 2026. Owner: Brand Design.*

## The idea

**Ballast** is the weight low in a ship's hull that keeps it steady in rough
water. The brand promise is the same: *you move fast up top; we keep you
stable underneath.* Everything — voice, color, motion — should feel like
calm competence in a domain famous for 2 AM panic.

## Voice

- **Calm, precise, a little dry.** We explain lock semantics without drama
  and without dumbing down. Humor is allowed exactly where nothing is at
  stake (the 404 page), never in findings or incident-adjacent copy.
- **Teach, don't scold.** A finding is a senior engineer leaning over your
  shoulder, not a compliance gate. "This will block writes — here's the safe
  way" beats "VIOLATION: RULE 7."
- **Honest to a fault.** We name our competitors, publish benchmarks that
  don't flatter us, and say "we are not the fastest linter" out loud. Trust
  is the product.

Words we use: *safety layer, gate, rehearsal, mechanism, safe rewrite.*
Words we avoid: *magic, AI-powered, revolutionary, blazingly fast.*

## Logo

The mark is three **keel lines** — descending strokes suggesting ballast
stacked low in a hull, doubling as a "signal strength" of stability — inside
a rounded square. Files in `assets/`:

- `assets/logo.svg` — mark only (dark tile, safe on any background)
- `assets/logo-wordmark.svg` — mark + "Ballast" set in Inter SemiBold
- App icon: `apps/web/src/app/icon.svg` (identical geometry)

Rules: don't rotate, recolor, or add effects; don't set the wordmark in
another typeface; keep clear space equal to one keel-line height around the
mark. Minimum size 16 px.

## Color

Dark-first. The abyss palette is the product; teal is the beacon light.

| Token | Hex | Use |
| --- | --- | --- |
| `abyss` | `#060A12` | page background |
| `surface` | `#0C1220` | cards, terminal chrome |
| `raised` | `#111A2C` | hovers, chips |
| `line` | `rgba(148,163,184,.14)` | hairline borders |
| `ink` | `#E6EBF4` | primary text |
| `muted` | `#8A99B0` | secondary text |
| `faint` | `#5B6B84` | metadata |
| `beacon` | `#2DD4BF` | brand accent, CTAs, links |
| `beacon-bright` | `#5EEAD4` | hover states, code accents |
| `indigo-soft` | `#818CF8` | secondary accent, notices |
| `ok` | `#34D399` | pass states |
| `warn` | `#FBBF24` | warnings |
| `danger` | `#FB7185` | blockers, fail states |

Severity colors are **semantic and reserved**: never use `danger`/`warn`
decoratively — if it's red, something is actually dangerous.

Machine-readable: `docs/company/design-tokens.json`. CSS source of truth:
`apps/web/src/app/globals.css` (`@theme`).

## Typography

- **Inter** — UI and prose. Weights: 400 / 500 / 600. Tight tracking on
  display sizes (−0.02em), features `cv11`, `ss01`.
- **JetBrains Mono** — all SQL, CLI output, identifiers, and anything a
  developer might copy. If it could be typed into a terminal, it's mono.

Scale (marketing): display 60/1.1, h2 36/1.15, h3 20/1.3, body 16/1.65,
small 14/1.6, code 13/1.6.

## Motion

Subtle and few: `fade-up` (0.7s, custom ease) for hero entrances,
`pulse-soft` for live indicators. Nothing loops decoratively, nothing
parallaxes, and `prefers-reduced-motion` disables all of it (implemented
globally).

## Imagery

No stock photos, no 3D blobs, no mascots. Our imagery is the product:
terminal output, diff annotations, the score bar, and fine-line grid
backdrops (`.bg-grid`). Screenshots are framed in `surface` cards with the
three-dot terminal chrome.
