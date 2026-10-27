# THE LAST EXPERIMENT: CONTAINMENT FAILURE

An interactive, browser-based educational escape room about **derivatives**,
built as a custom web application and integrated with the
[Escapp](https://github.com/ging/escapp) platform through the
[Escapp Client API](https://github.com/agordillo/escapp_client).

> Dr. Elena Vale is sealed inside experimental chamber C-7 with 3½ minutes of
> emergency air. The cooling system has failed, the chamber's monitoring
> hardware is damaged, and the safety system cannot decide anything for you.
> You are the response team. Restore cooling, work out what the temperature is
> doing, and find the earliest moment it is safe to open the door.
>
> **The escape-room interactions create the mystery. The derivatives make the
> rescue possible.**

- 50–60 minutes · teams of 3–4 · any modern browser
- Mostly basic polynomial differentiation; stage 5 adds d/dt e^(kt): see the
  prerequisite note in the teacher guide, which includes a way to run it
  without that prerequisite
- Five stages, strictly linear between stages, free exploration within each

## Documentation

| Document | What's in it |
|---|---|
| **[guides/ESCAPP_SETUP.md](guides/ESCAPP_SETUP.md)** | Creating the escape room, configuring the five puzzles and their solutions, attaching the app, local development, troubleshooting |
| **[guides/TEACHER_GUIDE.md](guides/TEACHER_GUIDE.md)** | Full mathematical solutions, expected decisions, timings, facilitation notes, debrief questions |
| **[guides/ESCAPP_HINTS.md](guides/ESCAPP_HINTS.md)** | The three hints per puzzle to paste into Escapp |

---

## Quick start

```bash
npm install
npm run dev            # http://localhost:5173: plays immediately via the mock adapter
```

With no `config.mjs` present, the app runs on the **mock Escapp adapter** so the
whole game is playable with zero setup. A persistent banner reads
**SIMULATED MODE: nothing is being verified or recorded by Escapp**, so a
simulated run can never be mistaken for a real one.

```bash
npm test               # 55 tests: mathematics, progression, playthrough, failure modes
npm run typecheck      # strict TypeScript
npm run build          # production bundle into docs/ (also the Pages site)
npm run preview        # serve the production build
```

To run against a real escape room, copy `config.example.mjs` to `config.mjs` and
set your endpoint: see [guides/ESCAPP_SETUP.md](guides/ESCAPP_SETUP.md) §5.

---

## Classroom display mode

```
?interface=class
```

Plays the opening cinematic and nothing else, with **no Escapp session and no
sign-in**. It is for the projector at the front of the room: show the briefing
to the whole class, then let teams open the escape room on their own machines
and log in.

When the cinematic ends it offers to play it again rather than entering the
game, because there is no authenticated team in this mode and so nothing to
enter.

It authenticates nobody and therefore records nothing: no puzzle can be
submitted and no progress is stored. **No Escapp client is constructed at
all** — the route is mounted outside the providers on purpose, because
`EscappProvider` boots the client as soon as it mounts and the client would
then put a sign-in dialog up on the projector. That is asserted in
`tests/classroom.test.tsx`.

Because it needs no account, it works on a public URL as-is:

```
https://<user>.github.io/<repo>/?interface=class
```

## Deploying

`npm run build` writes the bundle to **`docs/`**, which is both the folder to
hand to Escapp and the folder GitHub Pages serves from. So one build does both
jobs.

- **GitHub Pages:** Settings → Pages → Source: *Deploy from a branch*, branch
  `main`, folder `/docs`. The published URL is then
  `https://<user>.github.io/<repo>/`.
- **Escapp:** upload the contents of `docs/`, keeping `escapp.js`,
  `css/` and `media/` next to `index.html`.

`docs/` is committed on purpose, so the deployable build is always in the repo.
Rebuild and commit it alongside any source change or the published page goes
stale.

The bundle uses **relative asset paths**, so it works unchanged at a Pages
project subpath, at a domain root, or wherever Escapp mounts it. A `.nojekyll`
marker is included so Pages serves every file as-is.

The written guides live in **`guides/`**, not `docs/`: Vite empties its output
directory on every build, so documentation kept there would be deleted.

---

## The five stages

| # | Stage | Mathematical role | What the team must realise |
|---|---|---|---|
| 1 | The Locked Laboratory |: (exploration) | Search the room; the cabinet code is a badge number |
| 2 | Restore the Cooling System | Optimisation | Flow is quadratic in the regulator setting; only its maximum meets the required 22 L/min |
| 3 | The Temperature Crisis | Instantaneous rate of change | 18 °C is a *value*; the protocol asks for a *direction*, and the trend sensor is dead |
| 4 | The Rescue Window | Value + derivative + constraint | The coldest moment is after the air runs out; only one minute satisfies all three conditions |
| 5 | Emergency Release | **The tangent itself** | Students build a tangent on the pressure curve and read its gradient; chord mode shows it arising as a limit |

Answers and worked solutions are in the
[teacher guide](guides/TEACHER_GUIDE.md); not here, so this file can be shared.

---

## Escapp integration

**Escapp is the authority on stage completion.** The app never treats an
unverified local answer as progress.

| Escapp owns | The app owns |
|---|---|
| Participant & team authentication | Laboratory environments, navigation, hotspots |
| Puzzle solution verification | Inventory, documents, case file |
| Team progress, synchronisation, and the "your team moved on" dialog | Mathematical simulations and instruments |
| Activity monitoring, game management | Interactive control panels, locks, the release controller |
| Hints, and the hint allowance | Narrative, feedback, animations |

### Client API actually used

Every call was verified against the shipped `public/escapp.js`; nothing is
assumed or invented:

```
new window.ESCAPP(settings)   validate()            submitPuzzle()
checkPuzzle()                 getSolvedPuzzles()    getAllPuzzlesSolved()
getStorage()                  getAppSettings()      registerCallback()
isPreviewMode()               isUserValidParticipant()
displayCustomNotification()   startAnimation()
```

`registerCallback` is used with the three names the library accepts
(`initCallback`, `onNewErStateCallback`, `onErRestartCallback`).

**The client library has no hint API**: there is no hint method on the client
object. In-app hints are therefore app-side; Escapp's platform-side hints work
independently and in parallel.

### Two adapters

Both implement the same `EscappAdapter` interface (`src/escapp/types.ts`):

- **`productionAdapter.ts`**; the real documented client API.
- **`mockAdapter.ts`**: local development without an Escapp session. It
  reports `isMock: true`, the UI labels it SIMULATED, and it reproduces the
  Escapp server's exact solution normalisation (case-insensitive, trimmed,
  diacritic-insensitive) so it is never stricter or looser than production.

Fault injection for exercising the reconnection UI:

| URL parameter | Effect |
|---|---|
| `?interface=class` | Classroom display: the cinematic only, no sign-in |
| `?mock=1` | Force the mock adapter |
| `?mock=1&escappFail=1` | Submissions never reach the server |
| `?mock=1&escappOffline=1` | The client never connects |

### Team synchronisation

The client gates team progress behind its `restoreState` flow, and this app
sets **`AUTO`**: adopt the new state, no client dialog. The notification is the
app's job, because a teammate should see **the same message the solver saw**,
not a different modal one.

- `src/game/notifications.ts` is the single source of the stage-solved message,
  derived from the model so every browser produces identical wording.
- `src/game/progression.ts` decides when anyone moves, and always shows the
  notification first. A player standing on the solved stage keeps their proceed
  control; a player who is behind catches up once the message is read.

Local stage state is persisted with a schema version and a run id, so a
previous playthrough's machinery can never leak into a fresh one.

### Two behaviours worth knowing about

Both were found by reading the Escapp sources and are handled in code:

1. **Puzzle ids are positions.** The `/submit` endpoint resolves its id as
   `puzzleOrder`; the puzzle's **1-based position** in the escape room, not a
   database id. So "puzzle 1" is simply the first puzzle you created.
2. **Author test mode works, but never records progress.** The client accepts
   participation `AUTHOR` as well as `PARTICIPANT` when `preview` is set, so
   authors can play their own room. But preview forces all submissions to the
   read-only endpoint and never grows the solved list, which would strand an
   author at stage 1. In preview mode only, the production adapter remembers
   the server's verdicts itself and the UI shows an **AUTHOR PREVIEW** banner.
   Verdicts remain the server's own; only the persistence is local.
   Preview is also silent: it cannot show a login dialog and needs
   `escapp_email`/`escapp_token` in the URL, which Escapp's own test-mode
   launch supplies.

### No secrets in client code

The escape-room endpoint is **never** compiled into the bundle. In production
Escapp injects `window.ESCAPP_APP_SETTINGS`; in development Vite injects the
same shape from the git-ignored `config.mjs`. There are no API keys or
privileged credentials anywhere in this repository.

---

## Progression security

The stage being rendered is React state only: never read from the URL, never
read from local storage, never persisted, and it is clamped on every render to
`unlockedStage`, which is derived **exclusively** from Escapp's verified puzzle
list:

```ts
const stage = Math.min(Math.max(viewStage, 1), unlockedStage);
```

Consequences, all covered by tests:

- Editing local storage, changing the URL, or using back/forward cannot unlock a
  stage, because none of them is an input to `unlockedStage`.
- A gap in verified progress holds the team **at the gap** (`[1,3,4,5] → 2`), so
  inconsistent data never skips ahead.
- A tampered or stale local blob degrades to safe defaults rather than crashing
  or unlocking anything; injected `unlockedStage` / `verifiedStages` fields are
  dropped by hydration.
- Revisiting a *completed* stage is deliberately allowed, so teams can re-read
  evidence. Its decisive controls are disabled.

### Local state vs verified progress

Escapp has no API for synchronising arbitrary application state, so the app's
exploration state (what's been inspected, inventory, documents, dial positions)
is persisted into Escapp's own per-team storage wrapper under a single key.
This is a documented trade-off: it survives refresh and reconnection for the
same browser, and it is per-device, so teammates each keep their own exploration
state while sharing Escapp-verified stage progress. Nothing gated lives there
a teammate joining late lands on the correct stage and can reopen any document.

---

## Mathematical integrity

The models live in one place (`src/game/model.ts`) and **every** number the UI
shows or judges is computed from them: pump readouts, graphs, tangent lines,
safety verdicts and the final interlocks. No stage hard-codes an answer, so a
mathematically wrong choice cannot accidentally satisfy the rescue conditions:
the conditions *are* the mathematics.

`tests/model.test.ts` verifies this independently, including analytic
derivatives against numeric ones, maximum/minimum classification, domain
restrictions, unit consistency and cross-stage model consistency. It also proves
the result the scenario depends on:

- Condition ① T(t) ≤ 15 ⟺ (t−3)(t−5) ≤ 0 ⟺ t ∈ [3, 5]
- Condition ② T′(t) ≤ 0 ⟺ t ≤ 4
- Condition ③ air ⟺ t ≤ 3.5

⟹ feasible set **exactly [3, 3.5]** ⟹ **t = 3** is the unique earliest safe
release. The scenario needs no invented numbers to make its answer unique.

---

## Accessibility

- Every interactive object; including every hotspot over the room art: is a
  real `<button>`, keyboard reachable, with a descriptive accessible name that
  serves as the text alternative to the visual clue.
- Visible focus rings throughout; modals trap focus, close on `Escape`, and
  return focus to the trigger.
- The combination lock accepts the number row, `Backspace` and `Enter`.
- Status is never carried by colour alone: every indicator has a glyph and a
  word (`✓ PASS`, `✕ FAIL`, `CONDITION 3: … : FAIL`).
- Graphs expose a full text summary of the curve, tangent, threshold and marked
  points via `role="img"` and `aria-label`.
- `prefers-reduced-motion` disables the emergency strobe, pulses and animations.
- Laid out for standard laptop screens; collapses to one column below 900px.
- Explicit loading, error and reconnection states rather than silent failure.

---

## Project structure

```
src/
  escapp/
    types.ts              # typed subset of the client API actually used + adapter interface
    puzzles.ts            # stage -> puzzle id mapping and the solutions to configure
    productionAdapter.ts  # real Escapp Client API
    mockAdapter.ts        # development adapter (clearly labelled SIMULATED)
    EscappProvider.tsx    # boots an adapter; owns verified progression
  game/
    model.ts              # THE MATHEMATICS: single source of truth
    gameState.ts          # local exploration state (never a progression input)
    GameProvider.tsx      # persists exploration state via Escapp storage
    documents.ts          # the recovered scientific evidence
    hints.ts              # three progressive hints per stage
  components/             # room scenes, hotspots, documents, lock, graphs, instruments
  stages/                 # Stage1Lab … Stage5Release
  styles/                 # design system + equipment styling
tests/
  model.test.ts           # mathematical integrity
  progression.test.ts     # linear unlocking, puzzle wiring, state tampering
  playthrough.test.ts     # full runs, wrong answers, refresh, outages
guides/                   # Escapp setup, teacher guide, hints, intro script
docs/                     # BUILD OUTPUT, served by GitHub Pages
public/                   # escapp.js + its CSS/images (runtime assets)
```

## Stack

React 18 · TypeScript (strict) · Vite 5 · Vitest · inline SVG for all
environments and instruments. No UI framework, no asset pipeline, no runtime
dependencies beyond React and the Escapp client.

---

## Status

Complete and runnable. All five stages are playable start to finish, both
adapters work, and `npm test` (55 tests), `npm run typecheck` and `npm run build`
all pass.

**Verified by automated test:** the mathematics, linear stage progression,
puzzle wiring against the documented solutions, local-state tampering, full
correct playthroughs, rejection of every wrong answer at every stage, refresh
restoration, and three distinct Escapp failure modes.

**Not verified by automated test** (no browser was available in the authoring
environment, and these are visual/manual concerns): the rendered appearance of
the room scenes and animations, and a live end-to-end run against a real Escapp
server instance. The production adapter is written strictly against the
verified client API surface, but a real-server smoke test is the one thing worth
doing before class; the checklist in
[guides/ESCAPP_SETUP.md](guides/ESCAPP_SETUP.md) §6 covers it.
