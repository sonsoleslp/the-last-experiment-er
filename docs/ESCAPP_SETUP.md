# Escapp configuration guide

How to create the escape room in Escapp, configure the five puzzles, and connect
this application to it.

Everything in this guide was checked against the Escapp server source
(`helpers/utils.js`, `routes/api.js`, `controllers/puzzle_controller.js`) and the
shipped client library (`public/escapp.js`). Behaviour that is easy to get wrong
is flagged.

---

## 1. Create the escape room

1. Sign in to your Escapp instance (e.g. `https://escapp.es`) as a teacher/author.
2. **Escape rooms → New escape room.**
3. Give it a name (e.g. *The Last Experiment: Containment Failure*) and a
   description. Suggested duration **60 minutes**, team size **3–4**.
4. Save. Note the numeric id in the URL: `/escapeRooms/123` means your id is
   `123`, and your API endpoint is:

   ```
   https://<your-escapp-host>/api/escapeRooms/123
   ```

---

## 2. Create the five puzzles: **order matters**

> **This is the single most important thing to get right.**
>
> The Escapp client submits to `/api/escapeRooms/:id/puzzles/:n/submit`, and on
> the server that `:n` is loaded by **`puzzleOrder`**; the puzzle's **1-based
> position in the escape room**, *not* its database id.
>
> So "puzzle 1" means **the first puzzle in the list**. You do not need to look
> up any ids. You just need these five puzzles, in this order.

In **Escape room → Puzzles**, create exactly five puzzles in this order, with
these solutions:

| # (order) | Title | Solution (the `sol` field) | What the students actually did |
|---|---|---|---|
| 1 | The Locked Laboratory | `417` | Found the badge in the desk and opened the cabinet keypad |
| 2 | Restore the Cooling System | `3` | Calibrated the pump to the setting that maximises flow and meets 22 L/min |
| 3 | The Temperature Crisis | `MAINTAIN` | Chose the intervention justified by T′(2) = −4 °C/min |
| 4 | The Rescue Window | `3;15;-2` | Authorised release at t = 3 min, with T(3) = 15 °C and T′(3) = −2 °C/min |
| 5 | Emergency Release | `22;11;RELEASE` | Vented twice, derived dP/dt = −kP = −0.4 × 21 from the gauge, and fired the actuator |

Copy the solution strings **exactly** (no trailing spaces are needed: see the
note on matching below).

### How Escapp compares solutions

From the server source:

```js
removeDiacritics(answer.toLowerCase().trim()) === removeDiacritics(sol.toLowerCase().trim())
```

So matching is **case-insensitive, trimmed and diacritic-insensitive**. `MAINTAIN`,
`maintain` and ` Maintain ` are all accepted. The semicolons and the minus sign in
`3;15;-2` **are** significant: they are compared literally.

The development mock adapter reproduces this exact normalisation, so a local test
run cannot pass something the real server would reject, or vice versa.

### Suggested per-puzzle feedback

Escapp lets you set a success and a failure message per puzzle (`correct` / `fail`).
The app shows its own in-fiction consequences, so keep these short and neutral
they appear in Escapp's own UI:

| # | Success message | Failure message |
|---|---|---|
| 1 | Emergency cabinet open. | That combination is not in facility records. |
| 2 | Coolant flow established. | That configuration does not meet the flow requirement. |
| 3 | Intervention accepted. | That intervention is not valid for this thermal trend. |
| 4 | Release plan accepted. | That window does not satisfy all three release conditions. |
| 5 | Containment released. Dr. Vale is safe. | That rate does not match the vent model, or the pressure is still falling too fast. |

### Other per-puzzle settings

- **Score**: optional. Equal weights (e.g. 20 each) work well.
- **Automatic**: leave **off**. The app submits each solution itself.
- **Order**: must be 1…5 as in the table. If you reorder puzzles later, the
  app's stage mapping changes with them, so don't.

---

## 3. Hints

**Hints are configured in Escapp, not in the app.** Add three per puzzle, in
order, from **[docs/ESCAPP_HINTS.md](ESCAPP_HINTS.md)**, and set the escape
room's hint allowance to taste.

The app has no hint button, deliberately. The Escapp client library exposes no
hint API (verified against `public/escapp.js`), so an in-app hint panel could
only ever be a second, untracked hint system running next to the real one:
hints you could not see being used, that did not count against the allowance,
and that never appeared in your monitoring. Escapp already does this properly,
so the app stays out of it.

## 3a. Team synchronisation

Two settings make this work, and **the client does the hard part**, not the app.

### `rtc: true`

Required. Escapp pushes a new escape-room state to every connected member over
its websocket whenever any of them solves a puzzle. With `rtc: false` nothing
is pushed and each member is on their own. (Preview mode forces it off.)

### `restoreState: 'AUTO'`, with the app doing the telling

The client does **not** hand a newer team state straight to the app. Its
websocket handler calls `_validateStateToRestore` first and only then invokes
`onNewErStateCallback`, so `restoreState` decides what happens in between:

| Value | Behaviour |
|---|---|
| `NEVER` | Ignore team progress entirely |
| `AUTO` | Adopt it and tell the app, with no dialog. **What this app uses** |
| `AUTO_NOTIFICATION` | Adopt it, but show a modal dialog first |
| `REQUEST_USER` | Ask, with OK / Cancel |

`AUTO` is chosen because **the app provides the notification, not the client**.
A teammate sees the very same message the solver saw, in the same place, and
then their scene catches up. A modal dialog from the client would be a
different, interrupting message, which is not the same experience.

`AUTO` on its own would be abrupt, so the gentleness lives in the app:

- One source for the stage-solved message (`src/game/notifications.ts`), used
  by the solver and by every teammate. Each message is derived from the model,
  so every browser produces identical wording without being told what happened.
- One rule for moving anyone (`src/game/progression.ts`): **always show the
  notification first.** A player standing on the stage that was just solved
  keeps their proceed control and moves on when ready. A player who is behind
  their team catches up once the notification has been read. Nobody is ever
  moved the instant a message arrives.

Both are covered by `tests/sync.test.ts`.

### What the app does with that state

It derives the team's verified progress from the solved puzzle list and follows
it:

- A puzzle solved by any member shows every online member the same
  stage-solved notification, and moves those who are behind once it is read.
- **On refresh or reconnect the app reads the current escape-room state and
  puts the player straight into the matching scene.** A team four stages in
  reloads into stage 4, not back at the start.

Nothing about the local browser can advance a stage: the scene shown is derived
from Escapp's verified list and nothing else.

### Testing it

You need `preview: false`, `rtc: true`, and two participant accounts on the
same team in a running turn. Open the app in two browsers, solve a puzzle in
one, and watch the other announce it and catch up.

## 4. Attach the application

### Option A: hosted by Escapp (recommended for class use)

1. Build the app:

   ```bash
   npm install
   npm run build
   ```

2. Upload/serve the contents of `dist/` as the escape room's resource, following
   your Escapp instance's process for attaching a custom web app.
3. Escapp injects `window.ESCAPP_APP_SETTINGS` into the page at load time,
   including `escappClientSettings.endpoint`. **No endpoint is compiled into the
   bundle**, which is why there is no credential or secret anywhere in the
   client code.

The app expects `escapp.js` and `css/escapp.css` to sit next to `index.html`.
`npm run build` already copies them into `dist/` from `public/`.

### Option B: hosted elsewhere, pointed at Escapp

Serve `dist/` from any static host and pass the endpoint as a URL parameter, which
the client reads natively:

```
https://your-host/the-last-experiment/?escapp_endpoint=https://escapp.es/api/escapeRooms/123
```

---

## 5. Local development against a real escape room

```bash
cp config.example.mjs config.mjs     # config.mjs is git-ignored
```

Edit `config.mjs`:

```js
export let ESCAPP_APP_SETTINGS = {
  locale: 'en',
  escappClientSettings: {
    endpoint: 'https://escapp.es/api/escapeRooms/123',
    preview: true,
    rtc: false,
  },
};
```

Then `npm run dev`. Vite injects these settings exactly the way the Escapp server
does in production, so the **production adapter** runs; not the mock.

### Author test mode (`preview: true`)

**Authors can play in test mode.** The client explicitly accepts participation
`AUTHOR` as well as `PARTICIPANT` when `preview` is set:

```js
i.preview ? ["AUTHOR","PARTICIPANT"].includes(participation) ? ok : fail
          : ["PARTICIPANT","NOT_STARTED"].includes(participation) ? ok : fail
```

So test mode is the normal way for you to play your own room. Launching the app
from **Escapp's own test mode** is all you need: Escapp adds your credentials
to the URL and everything works.

#### One catch when running on `localhost`

Preview mode cannot *ask* who you are. Three things combine:

- `preview: true` forces `silent: true`, and silent mode returns false
  immediately instead of showing the login dialog;
- `validateUser()` requires **`user.token`** specifically; an email and
  password in settings is not enough;
- `init()` calls `_resetForPreview()`, which **clears Escapp's storage**, so a
  token remembered from an earlier sign-in is wiped before it can be read.

So a local preview run needs its credentials in the URL:

```
http://localhost:5173/?escapp_email=<your-email>&escapp_token=<token>
```

Get a token once (it is returned by the `/auth` endpoint):

```bash
curl -s -X POST https://escapp.es/api/escapeRooms/<id>/auth \
  -H 'Content-Type: application/json' \
  -d '{"email":"<your-email>","password":"<your-password>"}'
```

The response contains `"token": "..."` along with
`"participation": "AUTHOR"`. Paste the token into the URL above.

If you'd rather not deal with tokens, run the mock adapter instead: it needs no
account at all and plays the whole game.

#### Test mode does not record progress

In preview mode the client also forces every submission to the read-only
`/check_solution` endpoint and never adds the puzzle to its local solved list,
so `getSolvedPuzzles()` stays empty for an author however many puzzles they
solve. It clears its storage on init too, so the app's own exploration state
does not persist either.

Left alone that would strand you at stage 1. The production adapter handles it:
in preview mode only, it remembers the verdicts itself. The verdicts are still
the server's own `correctAnswer`, computed against your configured solutions;
Escapp is simply declining to *record* a practice run. The app shows an
**AUTHOR PREVIEW** banner saying progress is not being saved and will reset on
reload.

To test real persistence and team sync, use a **participant** account with
`preview: false`: there the login dialog appears normally, and the account must
belong to a team in a turn that is currently running.

### Playing with no Escapp at all

```bash
npm run dev          # no config.mjs -> mock adapter, with a loud SIMULATED banner
```

or on any build: append `?mock=1`.

Fault injection, for checking the reconnection UI:

| URL parameter | Effect |
|---|---|
| `?mock=1` | Mock adapter: local verification, labelled SIMULATED |
| `?mock=1&escappFail=1` | Every submission fails to reach the server |
| `?mock=1&escappOffline=1` | The client never connects |

---

## 6. Pre-class checklist

- [ ] Escape room created; endpoint id noted.
- [ ] Exactly **five** puzzles, in order, with the solutions from the table above.
- [ ] Three hints per puzzle, pasted from [docs/ESCAPP_HINTS.md](ESCAPP_HINTS.md), and a hint allowance set.
- [ ] `rtc: true` so team synchronisation works (preview forces it off).
- [ ] Solutions copied exactly: especially `3;15;-2` and `22;11;RELEASE`.
- [ ] Duration set (60 min suggested) and teams created (3–4 students).
- [ ] App built and attached; opening it shows the mission briefing with **no**
      SIMULATED or AUTHOR PREVIEW banner.
- [ ] One full playthrough as a participant: all five stages verify and the
      progress rail fills with five green ticks.
- [ ] Refresh mid-run: the team returns to the same stage.

---

## 7. Troubleshooting

The app distinguishes four failure modes on its boot screen, because the fixes
are completely different. Each one also prints the adapter's specific diagnosis.

| Screen | Means | Fix |
|---|---|---|
| **ESCAPP CLIENT UNAVAILABLE** | `window.ESCAPP` undefined: `escapp.js` did not load | Serve **all** of `dist/`, not just its `assets/` folder |
| **ESCAPP CLIENT NOT CONFIGURED** | The client loaded but refused to initialise | Endpoint must match `https://host/api/escapeRooms/<id>` exactly (no trailing slash, no extra path) |
| **RESPONSE TEAM NOT IDENTIFIED** | Reached Escapp, but it did not validate who you are | See §5. Locally this is almost always `preview: true` with no `escapp_email`/`escapp_token` in the URL |
| **FACILITY UPLINK LOST** | Escapp unreachable, or sign-in cancelled | Check connectivity and that the turn is running, then press Reconnect |

| Other symptom | Cause | Fix |
|---|---|---|
| Hangs forever on "ESTABLISHING FACILITY UPLINK" | Was a bug in this app (a React StrictMode double-mount discarded the boot result) | Fixed; covered by a regression test in `tests/provider.test.tsx` |
| Stage 1 verifies but stages stay locked | Puzzle **order** doesn't match, or fewer than 5 puzzles exist | Re-check that the puzzle list is in the order in §2 |
| A correct answer is rejected | The puzzle's solution in Escapp does not match what the game submits | The app detects this and shows a red **"Escape room setup problem"** banner naming the puzzle and the exact string to configure. Re-paste from the table in §2 |
| A stage cannot be completed at all | Same cause. Most likely a solution left over from an earlier version of the room | Check the banner. Puzzle 5's solution in particular is `22;11;RELEASE` |
| Progress resets on reload while authoring | You are in `preview: true` | Expected: Escapp does not record an author's practice run. See §5 |
| Local preview fails instantly with no login dialog | Preview is silent and needs a token in the URL | Append `?escapp_email=…&escapp_token=…`, or launch from Escapp's test mode. See §5 |
| Teammates don't see each other's progress | `rtc: false`, or the room is in preview mode | Set `rtc: true` and `preview: false`; preview forces rtc off |
| A refresh sends the player back to stage 1 | Was a bug in this app (the viewed stage clamped instead of following verified progress) | Fixed; covered by a regression test |
| The last stage opens saying the vent valve is already spent | Was a bug: local stage state persisted across playthroughs with no run or version scoping | Fixed. Persisted state is now discarded unless it belongs to this run and schema version |
