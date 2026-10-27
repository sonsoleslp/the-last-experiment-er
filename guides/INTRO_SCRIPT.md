# Intro narration script

## The recording that ships with this

Narration is **already installed**, as one clip per beat:

| File | Beat | Runs |
|---|---|---|
| `public/media/intro-1.mp3` | corridor | 5.98 s |
| `public/media/intro-2.mp3` | cooling failure | 6.87 s |
| `public/media/intro-3.mp3` | the window | 9.22 s |
| `public/media/intro-4.mp3` | two instruments | 10.53 s |
| `public/media/intro-5.mp3` | the mission | 9.85 s |
| `public/media/intro-6.mp3` | title card | 5.02 s |

**Total 47.5 s.** Voice: Michael C. Vincent (ElevenLabs), 44.1 kHz mono,
128 kbps.

### Why one clip per beat

Each clip plays while its own caption is on screen, and the next beat starts
when the clip ends. So the words, the captions and the visuals cannot drift
apart however the narration was paced.

That matters here: the shipped recording runs 47.5 s against the 56 s the
caption lengths predicted. A single continuous file played against estimated
timings would have been nearly nine seconds out by the final beat.

### Re-recording a single line

Replace just that numbered file. Nothing else needs changing: no timings to
update, no code to touch. `tests/narration.test.ts` checks the set is complete
and in the right order, by comparing the clips' relative sizes against the
caption lengths, so a swapped or missing clip is caught.

### Other options

| Supply | Behaviour |
|---|---|
| `intro-1.mp3` … one per beat | **Preferred.** Perfect sync, as above |
| `intro.mp4` | A finished video, played full-bleed with captions off |
| `intro.mp3` | One continuous take; captions follow the audio clock against the derived beat times |
| nothing | The same beats with on-screen captions on timers |

## Direction

- **Voice:** facility emergency dispatcher. Calm, clipped, professional. Not a
  movie-trailer voice; this is someone reading a situation report to a team
  who are already running.
- **Pace:** unhurried but not slow. Leave a clear beat at each paragraph break;
  those breaks are where the visuals change.
- **Total runtime:** the shipped take is **47.5 seconds**. Length does not
  matter when recording per beat: each clip simply holds its own caption on
  screen for as long as it runs.
- **Tone note:** no shouting, no urgency theatre. The restraint is what sells
  the stakes.

## Script, with timings

The holds below are the **actual clip lengths** of the shipped recording. With
per-beat clips the timings come from the audio itself, so these are a record of
what was recorded rather than a target to hit. The derived times in
`src/game/intro.ts` are only used when there is no audio at all.

The wording is deliberately plain, for high-school readers including students
listening in a second language. Read it straight; the restraint is what sells
the stakes.

Total runtime: **47.5 seconds**.

---

**[0:00.0] a dark corridor, red strobe**

> Meridian Research Facility. Sublevel three. Six minutes past two in the afternoon.

*(5.98 s)*

---

**[0:06.5] a cooling diagram, gone dark**

> The cooling system broke. The building locked itself down, and every door on this floor sealed shut.

*(6.87 s)*

---

**[0:13.9] the window, a figure behind it**

> Doctor Elena Vale was inside test chamber C-7 when it closed. She is alive. She has an emergency air tank, and it is measured in minutes.

*(9.22 s)*

---

**[0:23.7] two panels: one reading, one dead**

> The instruments in that chamber are damaged. The safety system can still measure things, but it cannot decide what to do. It will not open the door until someone proves it is safe.

*(10.53 s)*

---

**[0:34.8] three mission rings drawing in**

> You are the emergency team. Get the coolant flowing. Find out which way the temperature is going. Work out the earliest moment that door can open.

*(9.85 s)*

---

**[0:45.2] title card**

> The instruments will give you numbers. What those numbers mean is up to you. Go.

*(5.02 s)*

---

## Pronunciation

- **Meridian**: muh-RID-ee-an
- **C-7**: "see seven"
- **Vale**: rhymes with "pale"
- **"Six minutes past two in the afternoon"**: read it plainly, as speech. An
  earlier draft said "fourteen oh six", which was authentic to a facility clock
  and harder for students listening in a second language. The wall clock in the
  laboratory still reads 14:06, so the two agree.

## Technical

| | |
|---|---|
| Format | MP3, 128 kbps or better (or AAC in an `.m4a` renamed to `.mp3` if needed) |
| Sample rate | 44.1 kHz |
| Channels | Mono is fine; stereo also works |
| Loudness | Normalise to about −16 LUFS so it is audible on laptop speakers |
| Headroom | Leave ~0.5 s of silence at the start and end |
| Path | `public/media/intro-N.mp3`, one per beat |

Keep it dry; no music bed and no heavy reverb. Classroom laptop speakers turn
reverb into mud, and the captions have to stay readable against the audio.

If you want music, supply it mixed into the same file at roughly −20 dB
relative to the voice.

## Checking it

```bash
npm run dev
```

Open the app and you should see **▶ Begin transmission**. Click it: the
narration plays clip by clip, each caption holds for exactly its own clip, and
the visuals change between them. `Esc` or **Skip** jumps straight into stage 1.

If the narration does not play, the app falls back to silent captions rather
than failing, so check that `public/media/intro-1.mp3` exists and reload. A
clip that is missing or broken mid-sequence is treated as finished, so the
intro moves on to the next beat rather than stalling.
