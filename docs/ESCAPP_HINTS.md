# Hints to configure in Escapp

Hints live in **Escapp**, not in the app. Add them under each puzzle in the
Escapp authoring UI; students request them through Escapp's own interface,
where the hint allowance, scoring and monitoring already live.

The app deliberately has no hint button. The Escapp client library exposes no
hint API (verified against `public/escapp.js`), so an in-app hint panel could
only ever be a second, untracked hint system running alongside the real one:
hints you could not see being used, that did not count against the allowance,
and that did not appear in your monitoring.

## How to enter them

For each puzzle, add the three hints below **in order**. Escapp releases them
one at a time, so hint 1 should cost a team the least and hint 3 the most.

Each set follows the same shape:

1. **Where to look.** Points at the evidence without interpreting it.
2. **Why it matters.** Names the reasoning, still without doing it.
3. **How to do it.** States the method. Even this one does not give the answer:
   a team still has to differentiate, solve, and check their result.

None of the hints below contains a final answer. There is a test
(`tests/hints.test.ts`) that reads this file and fails if an answer ever creeps
in, so you can edit the wording here safely.

---

## Puzzle 1: The Locked Laboratory

**Hint 1**

> Nothing here needs any maths yet. Someone left in a hurry, so look at what
> they left behind, and read the computer.

**Hint 2**

> The badge in the desk drawer belongs to a technician. Every badge has a
> three-digit staff number on it, and the cabinet keypad wants three digits.

**Hint 3**

> Open the desk drawer, take the badge and read the number on it. Then turn the
> badge over. Type those three digits into the cabinet.

---

## Puzzle 2: Restore the Cooling System

**Hint 1**

> The formula for the flow is not on the pump. It is in the Pump B test report,
> in the folders on the shelf. You will need it, because the pump will not
> start until you can say what flow to expect.

**Hint 2**

> Look at the shape of the curve. Below the peak, turning the dial up gains you
> flow. Above the peak, turning it up loses you flow. So at the peak itself, a
> small turn changes almost nothing: the flow has stopped rising and has not
> started falling.

**Hint 3**

> That is why you set the rate of change to zero. Q′(x) tells you how much the
> flow changes for a small turn of the dial, and it is zero exactly at the
> peak. Differentiate Q, solve Q′(x) = 0, then put that x back into Q to get
> the flow and check it reaches the required minimum.

---

## Puzzle 3: The Temperature Crisis

**Hint 1**

> The recorder saved you two temperatures, and the rules ask how fast the
> temperature is changing right now. Those are not the same thing. Taking two
> readings and dividing the difference gives you an average across the whole
> gap between them.

**Hint 2**

> The formula T(t) describes the whole cooling process, so you can get the rate
> at this exact moment straight from it. You do not need the broken sensor, and
> you do not need the two saved readings.

**Hint 3**

> Differentiate T to get T′(t), then put the current time into it. Read the
> rules again carefully: they depend both on which way the temperature is going
> and on how fast.

---

## Puzzle 4: The Rescue Window

**Hint 1**

> Three things all have to be true at the same moment. Nobody is going to give
> you a list of times to try, because you are being asked to work out when they
> are all true.

**Hint 2**

> The first rule is about the temperature, so it turns into an inequality using
> T(t). The second is about whether it is still going up, so it turns into an
> inequality using the rate. The third is just a deadline.

**Hint 3**

> Solve the temperature condition by factorising, then solve the rate condition
> for t. Keep only the times that satisfy both and are also inside the air
> deadline. The earliest time left is your answer.

---

## Puzzle 5: Emergency Release

**Hint 1**

> Open the release valve. It lets some pressure out, then holds so you can read
> the gauge. The motor will not run until you have measured how fast the
> pressure is falling.

**Hint 2**

> The curve is steep at the start and flatter later, so the falling speed keeps
> changing. The console tool draws a straight line through your point. Try
> tilting it and watch what the line does to the curve.

**Hint 3**

> There is exactly one tilt where the line touches the curve and does not cut
> through it anywhere else. That line is the tangent, and how steep it is IS
> the speed the pressure is falling. If you would rather predict it than hunt
> for it, the valve report has a cross-check that tells you the speed from the
> gauge reading alone. Either way, compare the number with the motor limit.

---

## Facilitation note

Puzzle 1 hints cost nothing pedagogically; that stage is scene-setting, so give
them freely if a team is hunting pixels.

Puzzle 2 hint 2 and puzzle 3 hint 1 are the two most valuable in the room,
because each names a misconception rather than a step: "the highest setting is
not the most flow", and "two readings give an average, not a rate". If a team
is stuck, ask whether they have hit that misconception before releasing hint 3.
