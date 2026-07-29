# Veritas

**Every argument deserves evidence.**

A SwiftUI app for iOS and macOS. Two people argue — out loud or in text —
and Veritas acts as the referee: it times the turns, flags claims that were
asserted with nothing behind them, names the reasoning faults, and at the
end produces a report explaining exactly how each side did and why.

The point is not the verdict. It is the paragraph under the verdict.

---

## What is actually here

```
Veritas/
├── Veritas.xcodeproj          multiplatform app target (iOS 17+, macOS 14+)
├── Veritas/                   the SwiftUI app
│   ├── State/                 AppStore, DebateSession, Keychain
│   ├── Views/                 home, setup, debate room, report, progress, library
│   └── Design/                theme and shared components
└── Packages/VeritasKit/       the referee engine — pure Swift, no dependencies
    ├── Sources/VeritasKit/
    │   ├── Model/             Transcript, Claim, Fallacy, Finding, Scorecard, Report
    │   ├── Text/              tokenizer + lexicon
    │   ├── Analysis/          claim extraction, 18 fallacy detectors, scoring
    │   ├── Coach/             offline sparring partner and personas
    │   ├── Providers/         optional Claude-backed fact-checking
    │   └── Live/              incremental, per-turn analysis for the live feed
    └── Tests/VeritasKitTests/ 100+ XCTest cases
```

## Building

```bash
open Veritas/Veritas.xcodeproj    # then ⌘R — pick "My Mac" or a simulator
```

The engine has no dependencies, so there is nothing to resolve and no
network needed. Tests can be run without Xcode:

```bash
cd Veritas/Packages/VeritasKit
swift test
```

> **This project has never been compiled.** It was written in a Linux
> container with no macOS and no Swift toolchain available — `swift.org`
> is blocked by the environment's egress policy — so every line here has
> been reasoned through by hand rather than checked by a compiler. Expect
> to fix build errors on the first `⌘B`. The logic, the tests and the
> project structure are the deliverable; a clean build is not yet claimed.

## What Veritas will and will not say

This is the part worth reading before trusting a score.

**Offline (no API key — the default), Veritas can tell you a claim was
_unsupported_. It will never tell you a claim is _false_.** It has no
sources to check against, so "unsupported" is the strongest negative
verdict it is entitled to. Every screen says this; it is not buried in a
footnote.

**Values are not graded.** `ClaimExtractor` classifies each sentence before
anything else happens, and normative statements — *should*, *deserve*,
*unfair* — are marked `notApplicable`. No source settles whether a
trade-off is worth it, and a referee that marks values wrong is just a
bully with a database.

**The sparring partner never invents evidence.** Offline it produces no
digits at all — not one statistic, study or date — and a test enforces
that across all 28 persona/difficulty combinations. It argues structurally
instead: burden of proof, definitions, trade-offs, consistency. A practice
partner that fabricates numbers teaches the exact habit this product
exists to break.

**Adding an API key adds verification, not opinion.** With a key, a Claude
model checks factual claims and can bring real sources. The six scores are
unchanged by it — they are computed on-device and stay reproducible from
the transcript alone, so nobody has to wonder whether a number moved
because the argument changed or because a server did.

## How the report is built

| Stage | What it does |
| --- | --- |
| `Tokenizer` | sentence splitting that survives `Dr.`, `U.S.` and `3.5`; content words with light stemming |
| `ClaimExtractor` | classifies every sentence: empirical, statistical, causal, predictive, definitional, normative, anecdotal, rhetorical |
| `EvidenceAnalyzer` | citation cues, named institutions, quantities, hedges, absolutes → a support verdict |
| `FallacyDetector` | 18 detectors, each a cue **plus a guard** |
| `RebuttalAnalyzer` | did this turn answer the other side, and which points went unanswered |
| `ConsistencyAnalyzer` | positions reversed mid-debate |
| `CivilityAnalyzer` | attacks on the person — and credit for conceding |
| `Scorer` | six dimensions → weighted total → verdict, margin, confidence |
| `ReportBuilder` | best and weakest moments, missed opportunities, two or three things to do next time |

### False positives are treated as bugs

A referee that flags *"so you're saying the study was small?"* as a
strawman gets muted inside one debate, and then it teaches nobody
anything. So every detector pairs a trigger with at least one guard, and
every guard is pinned by a negative test:

- **Strawman** needs a misrepresentation cue *and* an exaggeration marker.
  Clarifying questions do not fire it.
- **Ad hominem** does not fire on "your argument is stupid" — harsh, but
  aimed at the argument.
- **Bandwagon** does not fire when the sentence carries an actual
  measurement of popularity. A poll is evidence about what people think.
- **Circular reasoning** compares content words on each side of *because*
  with Jaccard similarity, so "vaccines are safe because vaccines have
  been tested" stays quiet.
- **Moving the goalposts** cannot fire until the opponent has actually put
  evidence on the table — it needs the debate's history, not the sentence.
- **Hasty generalization** exempts values: "everyone deserves a fair
  hearing" is not a sampling error.

Recall is what we are willing to lose.

### The six scores

Evidence (28%), Logic (26%), Rebuttal (22%), Clarity (10%), Consistency
(8%), Respect (6%).

Persuasiveness is deliberately **not** measured. How convincing an argument
felt is precisely the thing people are already worst at judging, and
scoring it would reward whoever spoke loudest — which is the failure mode
the product exists to defuse.

Below a three-point margin Veritas reports a **draw** rather than inventing
a winner from noise, and confidence falls with a thin transcript or
lopsided airtime. Two sentences against six paragraphs does not settle
anything, whatever the scores say.

## Practice mode

Pick an opponent — Scientist, Lawyer, Historian, Economist, Politician,
Philosopher, Teacher — and a difficulty. Each persona is a lens: the
economist asks what it costs and who pays; the philosopher goes after your
premises; the lawyer holds you to your exact words.

Easy and Medium are **teaching modes**: the partner plants exactly one
catchable fallacy per turn for you to find, and a test asserts that every
planted line is one `FallacyDetector` can actually catch — otherwise the
loop breaks and the learner finds nothing in the report. Hard reasons
cleanly and concedes what it must. Expert attacks your *strongest* point
rather than your weakest, and steelmans you before answering.

## Privacy

Transcripts and reports stay on the device, in Application Support.
Nothing leaves it unless you add an API key, and then only the individual
claims being checked are sent. The key itself lives in the keychain — a
secret in `UserDefaults` is a secret in a plist.

## Not built yet

Room codes and two-device debates, tournaments, classroom dashboards,
PDF export, text-to-speech for the moderator, and public profiles. The
current app is two people on one device, plus practice — the loop worth
getting right first.
