# AI Product Lab

Upload a React or Next.js app; simulate a cohort of AI users with different
devices, connections, patience, and accessibility needs; get the drop-off
points, the ranked fixes, and a roadmap — before real users find them.

Two workspaces:

| Package | What it is |
|---|---|
| `packages/lab-engine` (`@productlab/engine`) | The simulation engine. Dependency-free TypeScript, fully testable, no browser. |
| `apps/lab` (`@productlab/web`) | Landing page, dashboard, project ingest, and the report UI. |

## Running it

```console
$ npm install
$ npm run build -w @productlab/engine
$ npm run dev:lab                       # http://localhost:3100
```

Open the dashboard, pick **Sample project**, and press the button. The bundled
`examples/expense-tracker` is a small Next.js app with real problems in it — an
icon-only sidebar, a seven-field signup form, and a feature nothing links to.

Runs are stored under `.productlab/` in the working directory (override with
`PRODUCTLAB_DATA_DIR`). No database, no queue, no browser.

## How a run works

```
source files
    │
    ▼
┌─────────┐   routes, affordances, forms, auth gates, nav edges
│ ingest  │   plus static signals (a11y, perf, security, scale)
└─────────┘
    │  ProjectModel
    ▼
┌─────────┐   a weighted cohort: age, device, bandwidth, patience,
│personas │   attention span, navigation style, accessibility needs,
└─────────┘   and a goal inferred from the product itself
    │  Persona[]
    ▼
┌─────────┐   each persona walks the model on labels alone, accruing
│simulate │   friction from slow loads, icon-only nav, unnamed controls,
└─────────┘   auth walls, and long forms, until they finish or leave
    │  Session[]
    ▼
┌─────────┐   scores, issues, funnel, feature demand, business outlook,
│ report  │   ranked recommendations, verbatim feedback
└─────────┘
```

### 1. Ingest

Reads the source; executes nothing. It recovers the shape a user experiences:

- **Routes.** Next.js `app/` and `pages/`, plus `pages|routes|views|screens`
  folders for plain React. Route groups and parallel slots are stripped.
- **Screens.** A screen is not just its page file — it composes the page, every
  layout wrapping it, and the local components those render (two levels of
  imports, capped at 24 files). A sidebar in `app/dashboard/layout.tsx` is on
  the screen; a form inside `<LoginForm />` is what stops the login page being a
  dead end.
- **Affordances.** Links, buttons, inputs, selects, toggles — with their labels,
  targets, whether they are icon-only, whether they have an accessible name, and
  whether a keyboard can reach them. JSX tags are scanned with a brace-aware
  scanner, because `onClick={() => go()}` contains a `>` that kills a regex.
- **Forms.** Fields, types, required flags, and whether each one has a label.
- **Where a submit goes.** An explicit `redirect()`/`router.push()` anywhere in
  the screen's source set, or — for a sign-up/sign-in form — the app's first
  gated screen.
- **Static signals.** Missing alt text, unnamed controls, click handlers on
  `<div>`s, heavy client bundles, secret-shaped `NEXT_PUBLIC_*` vars,
  unauthenticated API routes, missing rate limits.

If the upload holds several apps, the largest is analysed and the rest are named
in `warnings` — merging their routes would invent navigation that does not exist.

### 2. Personas

Twelve weighted archetypes, from `college-student` to `screen-reader-user` to
`slow-network-user`. Roughly one in seven simulated users has an accessibility
need and one in twelve is on a connection under 1.2 Mbps — the tails are the
point, because the median user is exactly who the product was designed for.

Goals come from the product: every non-root screen is something somebody wants
to reach, weighted by how many screens link to it and boosted for conversion
routes.

### 3. Simulate

Each persona starts at an entry screen and, at each step:

- waits out the screen's load time, computed from its client payload against
  their bandwidth and device parse speed;
- reads or skims, at a speed set by their navigation style;
- picks an affordance by **label relevance** to their goal, plus how much closer
  it gets them (weighted by tech skill — the model of "experienced users guess
  right more often"), plus prominence. Sometimes they do not read at all and
  click the first plausible thing;
- accrues friction, and leaves when it exceeds their patience or when their
  attention span runs out.

Every friction point names the thing in the product that caused it, which is what
lets a report say "412 people hit this specific button" rather than "users were
confused".

### 4. Report

Issues are grouped by `(cause, screen)` and ranked by **sessions lost**, not by
how severe the rule sounds. Scores are blends with capped penalties, so a bad
product lands in a measurable range instead of pinning every dimension to zero —
a score of 0 cannot tell you whether the next commit helped.

## Determinism

The same project, cohort size, and seed always produce a byte-identical report.
That is the whole basis for comparison: change some code, re-run with the same
seed, and any movement came from the change rather than from the dice.

```console
$ curl -X POST localhost:3100/api/projects/$ID/runs \
    -H 'content-type: application/json' -d '{"seed": 1, "personaCount": 300}'
```

## Optional LLM enrichment

Not required, and off unless configured. A model only rewrites the *prose* of
recommendations — never a number, never a count — and the report records whether
it happened:

```console
$ export PRODUCTLAB_LLM_BASE_URL=http://localhost:4000/v1
$ export PRODUCTLAB_LLM_MODEL=<model>
$ export PRODUCTLAB_LLM_API_KEY=<key>          # optional
```

The client speaks the OpenAI chat-completions format, so it works against any
gateway that does. [OmniRoute](https://github.com/diegosouzapw/OmniRoute) is a
good fit — it fans one endpoint out across many providers with automatic
fallback, which is exactly what you want when a per-provider quota runs out
mid-run. It is also read directly from `OMNIROUTE_BASE_URL` / `OMNIROUTE_API_KEY`:

```console
$ export OMNIROUTE_BASE_URL=http://localhost:4000/v1
$ export OMNIROUTE_API_KEY=<key>
$ export PRODUCTLAB_LLM_MODEL=<a model your gateway routes>
```

Enrichment only ever sees issue titles and counts. It never sees your source.
Any failure — no key, timeout, bad JSON — degrades silently to the deterministic
text rather than failing the run.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects` | List projects |
| `POST` | `/api/projects` | Create from `{"kind":"demo"}`, `{"kind":"github","repo":"owner/name"}`, or a multipart ZIP — and run the first simulation |
| `GET` | `/api/projects/:id/runs` | Run history |
| `POST` | `/api/projects/:id/runs` | Re-run against stored source; `{"seed":n}` reproduces a cohort |
| `GET` | `/api/runs/:id` | Full run and report; `?download=1` saves it as JSON |

## What it is not

Simulated users are a model of your product, and a model is wrong in ways the
real world is not. This will not tell you that your pricing is too high, that
the market does not want the thing, or that your onboarding email lands in spam.

What it does is exhaust the failure modes that are actually in the code — the
unlabelled control, the screen that takes nine seconds on a budget phone, the
feature nothing links to — before a real person has to find them for you. The
business projections are calibrated to move in the right direction when the
product improves; use them to compare two versions of your own app, not to plan
revenue. Then go and talk to five real users, with much better questions.

## Not built yet

Stated MVP scope that this does **not** cover, so nobody discovers it the hard
way:

- **Authentication.** There is none. Every route and every API endpoint is open,
  and any caller can read any project or run. That is fine for `npm run dev:lab`
  on a laptop and unacceptable anywhere else — the store holds uploaded source
  code. Wiring in a real provider (the sibling `apps/web` uses Clerk) is the
  first thing to do before this is reachable from a network. A local-only
  password gate was deliberately not added: it would look like protection
  without being any.
- **Billing.** The pricing page is presentational. Plan limits exist in one
  place (`MAX_PERSONAS` in `src/lib/run.ts`) and are enforced server-side, but
  nothing is charged and no plan is associated with a project.
- **Persistence beyond a directory.** Projects and runs are JSON files. The
  shape matches what a Postgres schema would hold, so it is a swap rather than a
  rewrite, but concurrent writers are not coordinated.

Non-MVP items from the roadmap — mobile and native simulation, video replay of
sessions, team workspaces, Slack/Discord notifications, competitor comparison,
AI-generated pull requests, continuous post-deploy monitoring — are untouched.

## Tests

```console
$ npm run test -w @productlab/engine     # 88 tests
```

Two of them exist specifically to keep the scoring honest: they run a
well-built app and a deliberately degraded version of the same app, and assert
the scores actually separate them.
