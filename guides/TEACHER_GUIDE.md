# Teacher guide: THE LAST EXPERIMENT: CONTAINMENT FAILURE

A 50–60 minute derivatives escape room for teams of 3–4.

**Mathematical prerequisites:** differentiating polynomials, evaluating a
derivative at a point, stationary points, increasing/decreasing behaviour,
simple maxima and minima, and interpreting a result in context. No integration,
no chain/product/quotient rule, no differential equations.

---

## 1. The pedagogical idea

Students are not asked to differentiate in order to produce a password. In each
stage the derivative answers a question the situation genuinely poses:

Each stage exercises a **different** derivative idea, deliberately. An earlier
draft had stages 3, 4 and 5 all doing "evaluate the derivative at a point and
compare it to a threshold", which made the mathematics feel repetitive even
though the contexts differed.

| Stage | Derivative idea | What makes it distinct |
|---|---|---|
| 2 | **Optimisation** | Where is the rate zero? Classify it, then evaluate |
| 3 | **Average vs instantaneous rate** | The chord through two logged readings gives a different answer, and a different action, from the tangent |
| 4 | **Inverse problem** | Solve for *when* a condition holds, rather than evaluating at times you are given |
| 5 | **The tangent itself** | The gradient is measured by building a tangent on the curve, not calculated. Chord mode shows it as a limit |

| Stage | The question the situation asks | Why a derivative answers it |
|---|---|---|
| 2 | Which pump setting actually delivers enough coolant? | The flow response is quadratic; the only setting meeting the requirement is its maximum, found where Q′(x) = 0. The pump will not start until students declare the flow they expect, so every attempt costs an evaluation of Q |
| 3 | How fast is the chamber cooling *right now*? | The logger left two readings; dividing the difference gives the average over the interval, which exceeds the thermal shock limit and calls for the wrong action. Only T′(2) gives the rate at this instant |
| 4 | When is it first safe to open the door? | Needs the value T(t), the direction T′(t), and a hard deadline: all three at once |
| 5 | How fast is the pressure falling right now? | They build the tangent at the gauge point and read its gradient. The derivative stops being a formula and becomes a line they can see |

The deliberate traps are where the learning is:

- **Stage 2:** "turn it up to maximum" gives 5 L/min: *less* than setting 2.
  The regulator is not a volume knob.
- **Stage 3:** 18 °C *feels* hot, and the instinct is to fight it with
  suppression. The protocol asks about direction, not magnitude.
- **Stage 4:** minute 4 is the **coldest** and most **stable** option, and it
  kills Dr. Vale: her air ran out at 3.5 minutes. "Coldest" ≠ "safest".

---

## 2. Full mathematical solutions

### Stage 1: The Locked Laboratory (no mathematics)

Students read the terminal, search the desk, find a maintenance badge printed
**417** plus a note saying the cabinet code *is* the personnel number, enter
`417` on the cabinet keypad, take the emergency access card, and use it on the
cooling room door.

**Answer submitted to Escapp:** `417`

---

### Stage 2: Restore the Cooling System (optimisation)

Given, from the calibration report ENG-2291-B:

$$Q(x) = -2x^2 + 12x + 5 \quad \text{L/min}, \qquad x \in \{0,1,2,3,4,5,6\}$$

Protocol EC-4 requires **Q ≥ 22 L/min**.

Differentiate:

$$Q'(x) = -4x + 12$$

Stationary point:

$$Q'(x) = 0 \implies -4x + 12 = 0 \implies x = 3$$

Classify it. Q″(x) = −4 < 0, so x = 3 is a **maximum**. (Or: Q′ > 0 for x < 3
and Q′ < 0 for x > 3.)

> **Why set Q′(x) = 0 at all?** This is the step students most often perform
> without understanding, so the room explains it in three places: the test
> report, hint 2, and a "Why does the top of the curve matter?" panel in the
> pump console itself. The argument given is the physical one rather than the
> formal one:
>
> *Below the peak, turning the dial one step up gains you flow. Above it,
> turning it up loses you flow. At the peak it does neither, so the rate at
> which flow changes is zero exactly there.*
>
> Q′(x) is that rate. Setting it to zero asks "where does turning the dial stop
> making any difference?", and the answer is the top of the curve. Worth
> drawing out in the debrief: this is also why Q″ < 0 tells you it is a maximum
> and not a minimum.

Evaluate:

$$Q(3) = -2(9) + 12(3) + 5 = -18 + 36 + 5 = \mathbf{23\ \text{L/min}}$$

23 ≥ 22, so setting 3 works. And since 23 is the **greatest** value Q takes, no
other setting can reach 22. The full table confirms it:

| x | 0 | 1 | 2 | **3** | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Q(x) | 5 | 15 | 21 | **23** | 21 | 15 | 5 |
| Q′(x) | 12 | 8 | 4 | **0** | −4 | −8 | −12 |

**Setting 3 is the unique integer setting satisfying the protocol.**

**Answer submitted to Escapp:** `3`

#### Why students cannot simply guess

Setting 3 is the **midpoint** of the regulator's travel, so "try the middle
one" would otherwise solve this stage by accident, and seven free test-fires
would solve it by brute force with no calculus at all.

So the pump has a **pre-start interlock**: before it will turn over, the
operator must type the flow they expect at the chosen setting, and the
controller checks that figure against the calibration curve. A mismatch refuses
the start and **leaks nothing** about which setting is right.

The consequence is that every attempt costs an evaluation of Q(x). Students can
legitimately brute-force by evaluating all seven settings by hand, that is
still real mathematics, and it is the fallback for a struggling group: but
finding the maximum with Q′(x) = 0 is dramatically faster, which is exactly the
lesson.

The console **draws the curve, but does not label the x-axis**, and has no
vertical gridlines. That is a deliberate middle setting:

- The shape is the motivation for the whole stage. It rises, peaks and falls
  away, so there is obviously a best setting to find, and only the very top of
  it clears the 22 L/min line. An earlier version withheld the curve entirely
  and left teams unsure the problem even had a shape.
- But a labelled x-axis, or gridlines they could count, would let the peak be
  read straight off the plot. With both gone, the curve tells them *that* there
  is a peak without telling them *where*.

The **tangent** is drawn only at settings the team has actually started. Each
start costs a correct pre-start declaration, so watching the tangent go flat at
the peak is a reward for having used the formula rather than a way around it,
and it is a good moment to point at: *that* is what Q′(x) = 0 looks like.

If you want the x-axis back, set `xTicks` on the `<FunctionGraph>` in
`src/stages/Stage2Cooling.tsx` to `true`.

---

### Stage 3: Average rate vs instantaneous rate

Given, from the C-7 thermal calibration:

$$T(t) = t^2 - 8t + 30 \quad ^\circ\text{C}, \qquad t \text{ in minutes}$$

The trend sensor is dead. What it left behind is the **data logger**, holding
two readings:

| | |
|---|---|
| t = 0 min | 30.0 °C |
| t = 2 min | 18.0 °C |

The natural move is to divide the difference:

$$\text{average rate} = \frac{T(2)-T(0)}{2-0} = \frac{18-30}{2} = \mathbf{-6\ ^\circ\text{C/min}}$$

That is the gradient of the **chord**. It is the average across the interval,
not the rate at this moment. The rate now is the gradient of the **tangent**:

$$T'(t) = 2t - 8 \qquad T'(2) = \mathbf{-4\ ^\circ\text{C/min}}$$

**And this is where it bites.** Protocol TH-9 has three branches, with a
thermal shock limit at 5 °C/min:

| Trend | Action |
|---|---|
| Increasing | Activate backup suppression |
| Falling faster than 5 °C/min | **Reduce coolant flow** (thermal shock) |
| Falling at 5 °C/min or less | **Maintain cooling** |

| Rate used | Size | Branch | |
|---|---|---|---|
| Average, −6 | 6 > 5 | Reduce coolant flow | ✗ **wrong** |
| T′(2) = −4 | 4 ≤ 5 | Maintain cooling | ✓ **correct** |
| +4 (sign error) | — | Suppression | ✗ wrong |

So averaging does not produce a near miss. **It produces the wrong call.** The
shock limit of 5 sits deliberately between 4 and 6.

The console shows the logged readings and their average in plain sight, because
the temptation *is* the lesson. If a student enters −6 in the trend field, the
console says specifically: *"that is the AVERAGE rate across the logged
interval, not the rate at this instant. The transient is curved, so the two
differ."*

Three branches also means the decision is not a coin flip even before the rate
is declared, which was the flaw in an earlier two-button version of this stage.

**Decision: MAINTAIN COOLING.** Choosing flow reduction is refused because it
would drop loop B below the 22 L/min minimum established in stage 2, so the
chamber would never reach containment limits; the message says so. Choosing
suppression halts the transient and burns air.

**Answer submitted to Escapp:** `MAINTAIN`

> **Teaching note.** This is the cleanest place in the whole room to make the
> chord/tangent distinction concrete. If your class has met "average rate of
> change" and "instantaneous rate of change" as two definitions to memorise,
> this stage is where they find out why anyone bothered to distinguish them.
>
> Worth knowing: for *any* quadratic the average over an interval equals the
> instantaneous rate at the interval's **midpoint**. Here the interval is
> [0, 2] and the reading is at t = 2, not t = 1, which is exactly why the two
> disagree. A strong group will enjoy discovering that; it is debrief
> question 12.

---

### Stage 4: Solving for the release window (inverse problem)

Protocol CR-2 requires **all three** conditions simultaneously, and asks for
the **earliest** time at which that happens. Students are given no list of
times to try: they have to solve.

$$\text{(1)}\quad T(t) \le 15 \;\Longrightarrow\; t^2-8t+30 \le 15 \;\Longrightarrow\; t^2-8t+15 \le 0 \;\Longrightarrow\; (t-3)(t-5) \le 0 \;\Longrightarrow\; 3 \le t \le 5$$

$$\text{(2)}\quad T'(t) \le 0 \;\Longrightarrow\; 2t-8 \le 0 \;\Longrightarrow\; t \le 4$$

$$\text{(3)}\quad \text{air reserve} \;\Longrightarrow\; t \le 3.5$$

Intersecting the three:

$$[3,5] \cap (-\infty,4] \cap (-\infty,3.5] = \mathbf{[3,\ 3.5]}$$

**The earliest safe release is t = 3 min**, and the window is only half a
minute wide.

This is an *inverse* problem, which is what makes it different from stages 3
and 5: there the team is handed a moment and asked for the rate, here they are
handed a requirement and asked for the moment. Condition 1 is a quadratic
inequality in the function, condition 2 a linear inequality in the derivative.

#### The rehearsal tool, and the instructive failures

The console lets students **rehearse any time they type**, reporting all three
condition checks. That is how engineers work, and it keeps the three most
instructive times reachable:

| t | T(t) | T′(t) | ① ≤ 15 °C | ② not rising | ③ air left | |
|---|---|---|---|---|---|---|
| 2 | 18 | −4 | ✗ too hot | ✓ | ✓ | cooling nicely, still too hot |
| **3** | **15** | **−2** | **✓** | **✓** | **✓** | **the answer** |
| 4 | 14 | 0 | ✓ | ✓ | ✗ gone | **coldest and most stable, and fatal** |

Minute 4 is the single most useful mistake in the room. It is the coolest and
most thermally stable moment available, and Dr. Vale's air ran out at 3.5.
*Coldest is not safest.*

Note also that a time which merely *works* is refused: file t = 3.2 and the
console accepts that all three conditions hold, then says CR-2 requires the
**earliest** such time. Every second earlier is air she still has.

**Answer submitted to Escapp:** `3;15;-2` (the minute, with the temperature
and rate that justify it)

#### An honest limitation

A determined team could narrow in on t = 3 by rehearsing times rather than
solving the inequalities. The rehearsal tool is there on purpose, so this is a
trade rather than an oversight: testing a candidate is legitimate engineering,
and removing it would also remove the minute-4 lesson. In practice solving
(t−3)(t−5) ≤ 0 is far quicker than hunting for a boundary to one decimal place,
and if you want to close it off entirely, ask the class to show their working
for the window on paper before they are allowed to file the plan.

---

### Stage 5: What a tangent actually is

**Students do not calculate the rate of change in this stage. They build it.**

Opening the release valve lets the chamber's extra pressure out along a curve:

$$P(t) = 90\,e^{-0.5t} \quad \text{kPa}$$

The door motor needs to know how fast the pressure is falling *right now*, and
will not run unless that is **below 12 kPa per minute**.

The console plots the curve. The gauge reading fixes one point on it. Students
then **rotate a straight line through that point** until it stops cutting the
curve and merely touches it, and the console reads the gradient off the line
they made.

That gradient is the rate of change. This is the idea the whole room has been
circling, made physical: **the derivative is the gradient of the tangent.**

#### What they see while they work

| Their line | What the console says |
|---|---|
| Too shallow or too steep | "This line cuts straight through the curve, and comes back across it at about 3.4 minutes. A tangent only touches." |
| Off by a small amount | "This line cuts through the curve instead of touching it. Keep tilting until it rests against the curve without crossing it." |
| The tangent | "This line touches the curve at one point only. That is the tangent, and how steep it is tells you how fast the pressure is falling right now." |

The feedback never says "too steep" or "too shallow", so the line cannot be
found by bisection without looking at the curve. Only one of the fifty-one
slider positions touches, and that is checked in the test suite.

#### The task

| Burst | Gauge | Tangent gradient | Under 12? | Action |
|---|---|---|---|---|
| 1 | 40 kPa | **-20** kPa/min | ✗ | Let more pressure out |
| 2 | 18 kPa | **-9** kPa/min | ✓ | **Run the door motor** |

Running the motor at burst 1 is a real failure: the escaping air slams the
door and jams the motor. It is recoverable, the console says why, and the valve
only has charge for two bursts.

**Answer submitted to Escapp:** `18;9;RELEASE`

#### Chord mode: the definition of a derivative, on a slider

The tool has a second mode that ties stage 5 back to stage 3. Students place a
second point on the curve, see the **chord's** gradient, then slide that point
closer to the first and watch the chord's gradient close in on the tangent's:

| Gap between the points | Chord gradient |
|---|---|
| 2.00 min | -6.95 |
| 1.00 min | -8.66 |
| 0.50 min | -9.73 |
| 0.25 min | -10.34 |
| 0.10 min | -10.73 |
| → 0 | **-11.00** (the tangent) |

That is the definition of a derivative, visible and draggable: the average rate
over a shrinking interval becoming the rate at an instant. It is also stage 3's
chord-versus-tangent lesson in a second setting, and on this curve the chord
always understates how fast the pressure is falling.

**Use this in the debrief.** Ask what the chord gradient would be if the gap
could be made zero, and why you cannot simply set the gap to zero and divide.

#### Two routes in, by design

A team can get the number either way, and both teach something:

1. **Tilt the line until it touches.** The tangent tool's own feedback says
   where a wrong line cuts the curve, so the search is guided and the concept
   is the picture.
2. **Predict it, then confirm.** The valve report carries a cross-check: the
   speed always works out as **half the gauge reading**. A team can compute 17
   and 11, set the slider straight to them, and watch the line fall flat
   against the curve.

Route 2 exists because an early version had only route 1, with feedback that
deliberately refused to say which way to move so the answer could not be found
by bisection. That made a fifty-one position slider close to opaque. The guard
was also pointless: with a manipulative like this the understanding *is* the
picture, so hunting for the touching line is the learning, not a way around it.

If a team is stuck, point them at the cross-check rather than the slider. Then
ask them to set the slider to their predicted value and say what they expect to
see; watching the line go flat exactly where they predicted is the better
moment anyway.

#### Difficulty

Deliberately low on computation. No differentiation is required: the gradient
is measured off a curve rather than derived. Two earlier versions were harder
and worse. The first asked students to differentiate $e^{-kt}$, which was a
step beyond stages 2 to 4. The second handed them a rule ("the pressure falls
at half the gauge reading"), which was easy but taught nothing, since halving a
number tells you nothing about what the result means.

#### An extension for a strong class

Having measured -20 at 40 kPa and -9 at 18 kPa, ask what they notice. Both are
half the gauge reading. That is $dP/dt = -0.5P$: **the rate of change is
proportional to how much is left**, which is the defining property of
exponential decay and the same mathematics as radioactive decay or a cooling
drink. Letting students discover it from their own two measurements is far
better than being told it.

#### Consistency with the air supply

Stage 4's 3.5-minute limit is on the **cooling clock** and governs when the
door may be *agreed*. The vent clock starts when the valve opens. The valve
report states that opening the valve connects the chamber to the corridor air
line, restoring the person's air from that point, so the sealed tank no longer
binds. This is asserted in the fiction and checked in the test suite.

---

## 3. Progression logic

Progression between stages is **strictly linear and Escapp-verified**. Within a
stage, students explore freely in any order.

```
Stage N  --(correct answer)-->  Escapp verifies  -->  Stage N+1 unlocks
```

- A stage unlocks **only** when Escapp has verified the previous one. The app
  never unlocks a stage on an unverified local answer.
- Students can **revisit** any completed stage to re-read evidence; the decisive
  controls there are disabled.
- Refreshing, editing local storage, or using the browser's back/forward buttons
  cannot skip a stage; the current stage is derived solely from Escapp's
  verified puzzle list.
- If Escapp becomes unreachable, the team is held where they are and shown a
  reconnection banner. Nothing is reported as complete.

---

## 4. Hint explanations

Three hints per stage, revealed one at a time, on request. Hint 1 points at the
evidence, hint 2 names the reasoning, hint 3 states the method: **none gives
the answer**.

| Stage | Hint 1 (evidence) | Hint 2 (reasoning) | Hint 3 (method) |
|---|---|---|---|
| 1 | Look at what was left behind; read the computer | Badges carry a three-digit personnel number | Read the badge, enter the digits, take the card |
| 2 | The curve is in report ENG-2291-B in the binder, and the controller needs an expected flow | The best setting gives the greatest flow, then check it's enough | Find where Q′(x) = 0, evaluate Q there, verify ≥ 22 |
| 3 | Two logged readings and a question about the rate *now* are not the same thing | The model gives the rate at this exact moment, without the sensor and without the logged pair | Differentiate T, evaluate T′(2), then check TH-9's branches carefully |
| 4 | Check every condition separately | Value from T(t); direction from the rate; air is a deadline | Evaluate T and T′ at 2, 3, 4; keep those passing all three; take the earliest |
| 5 | Open the valve; the controller wants the rate before it releases the actuator | The spec gives P(t) = P₀e^(−kt), but you are not told t: differentiate anyway and see what comes out | dP/dt = −kP₀e^(−kt) = −k × the gauge reading. Compare its size with the limit |

**Facilitation tip:** if a team is stuck in stage 3, don't give a hint: ask
them *"is 18 °C hot?"* then *"is it getting hotter?"*. The gap between those two
questions is the entire lesson.

---

## 5. Estimated timings

| Stage | Target | Notes |
|---|---|---|
| Briefing | 2–3 min | Read together; flag that the 3.5 min is simulated time |
| 1: Locked Laboratory | 8–10 min | Longest if teams explore thoroughly; no mathematics |
| 2: Cooling System | 12–15 min | First real derivative. Expect a guess, then the pre-start check sends them to the report |
| 3: Temperature Crisis | 8–10 min | The locked controls force the calculation; fast once "direction vs value" drops |
| 4: Rescue Window | 12–15 min | The hardest stage; three conditions to track |
| 5; Emergency Release | 8–12 min | New model. Longer if exponential derivatives are unfamiliar: see the prerequisite note |
| Debrief | 8–10 min | See §7 |
| **Total** | **55–70 min** | Trim the debrief for a 50-minute lesson |

If you are tight on time, hints for stage 1 cost nothing pedagogically: that
stage is scene-setting.

---

## 6. Classroom facilitation

**Before class**

- Complete the checklist in `ESCAPP_SETUP.md` §6.
- Play it through once yourself. The ⚠️ preview-mode note in §5 of that guide
  will save you confusion.
- Teams of 3–4, one screen per team. Rotate the keyboard between stages.
- Have scrap paper out. Teams that differentiate on paper beat teams that poke
  at the interface.

**During**

- **Do not** tell teams which rule to apply. The situation is designed to make
  the need for a derivative obvious; let it do that work.
- In stage 2, teams who try to guess hit the pre-start check immediately. That
  is the intended moment: they discover they cannot start the pump without a
  number, go and find the report, and from there the question becomes "which
  setting gives the most?", which is the derivative. If a group grinds through
  all seven evaluations by hand, let them finish, then ask: "how would you find
  that peak if the dial had a hundred positions?"
- Watch for the stage 4 "pick the coldest" error. It is the most instructive
  mistake in the room. Let them inspect minute 4, see the air condition fail,
  and work out why being coldest wasn't enough.
- Teams may check the **Case File** at any time: encourage it. Rereading a
  protocol beats guessing.
- Reassure anyone who panics about the 3.5 minutes: it is simulated experiment
  time. The app says so, and so should you.

**Differentiation (teaching, not calculus)**

- *Struggling:* point them at the Hints button; it is designed for this. For
  stage 4 suggest a three-column table: minute, temperature, rate.
- *Racing ahead:* ask the extension questions in §7.

---

## 7. Debrief questions

**Consolidating**

1. In stage 2, why wasn't the highest setting the best one? What does
   Q′(x) = 0 mean physically for the pump?
2. In stage 3, the display showed 18 °C. Why was that number alone not enough
   to decide what to do? What did T′(2) tell you that T(2) couldn't?
3. In stage 4, minute 4 was the coolest *and* the most stable. Why was it the
   worst choice?
4. The release window turned out to be [3, 3.5]: half a minute. What made it so
   narrow, and which condition would you want to relax if you were redesigning
   the chamber?

**Extending**

5. Suppose the seal were rated to 14 °C instead of 15 °C. Solve
   t² − 8t + 30 ≤ 14 and find the new safe window. *(⟹ (t−4)² ≤ 0 ⟹ t = 4 only
   and the air is gone by then, so the rescue becomes impossible. A single
   degree of engineering margin is the difference between a rescue and a
   fatality.)*
6. If the air reserve were 5 minutes instead of 3.5, what would the safe window
   become? *(⟹ [3, 4], and minute 4 would then be the coolest safe option. The
   right answer depends on the constraint, not just the curve.)*
7. The chamber eventually warms up again: T′(t) > 0 for t > 4. What is
   physically happening, and what should the facility do at that point?
8. Why could the safety system not have made these decisions on its own? What
   exactly did the broken sensor take away, and why was the *model* enough to
   replace it?

**Transfer**

9. Where else does "the rate of change matters more than the value" decide
   something real? *(Prompt: a patient's temperature trend vs a single reading;
   infection rates; speed vs acceleration when braking; a falling share price
   that is slowing down.)*
10. In stage 5 the rate of pressure change was proportional to the pressure
    itself. What does that mean for how the venting *feels* over time: fast at
    first, then slower and slower? Where else does a quantity decay at a rate
    proportional to how much is left? *(Prompt: radioactive decay, a cooling
    cup of coffee, charge leaking off a capacitor, a drug clearing the
    bloodstream. This is the same mathematics every time.)*
11. The gauge told you the pressure but never the time. Why did that make the
    relationship dP/dt = −kP essential rather than merely convenient?
12. In stage 3 the average rate over [0, 2] was −6 and the instantaneous rate
    at t = 2 was −4. For a quadratic, the average over an interval always
    equals the instantaneous rate at the interval's **midpoint**. Check that:
    what is T′(1)? Why does that explain the disagreement, and what interval
    would have made the two agree? *(⟹ T′(1) = −6; an interval centred on
    t = 2, such as [0, 4], would agree.)*

---

## 8. Common misconceptions, and what to say

| Misconception | What students do | Response |
|---|---|---|
| "Maximum setting = maximum output" | Dial the pump to 6 | Ask them what flow they will declare for setting 6, then what the curve says |
| "I'll just try them all" | Click through the dial | The pre-start check stops them. Ask where the expected-flow figure is meant to come from |
| "T′ is the temperature" | Enter 18 in the trend field | Console rejects it. "What are the units of the trend field? What does 'per minute' tell you?" |
| Average instead of instantaneous | Enter −6 in the trend field | Console names it explicitly. "Over what stretch of time is −6 the rate? Is that the same as the rate right now?" |
| Loses the minus sign | Enter +4 in the trend field | Console rejects it and says to check the sign. "Is the chamber getting hotter or colder? What should that do to the sign?" |
| "Negative rate means negative temperature" | Think the chamber is below 0 °C | "T(2) = 18 °C. Is 18 negative? What is actually negative here?" |
| "Coldest is safest" | Choose minute 4 | "How much air does she have? When does minute 4 arrive?" |
| "Stationary point = maximum" | Don't classify | "How do you know it's a maximum and not a minimum? Check Q″, or check the sign of Q′ either side" |
| "The game wants a number" | Hunt for a code to type | "You're not entering a password. You're setting a machine. What does the machine need to do?" |
| Confuses pressure with how fast it falls | Reads 18 off the gauge and treats it as the speed | "What are the units? Is 18 a pressure or a speed? The rule is about speed" |
| Thinks the time is needed in stage 5 | Stuck looking for elapsed time | "The gauge only shows pressure. Read the rule in the valve report again" |
| Thinks any line through the point is a tangent | Accept a line that visibly cuts the curve | "Follow your line past the point. Does it stay on one side of the curve, or go through it?" |
| Thinks the chord gradient is the rate | Use chord mode and stop there | "Slide the second point closer. Does the number settle anywhere?" |

---

## 9. Answer key at a glance

| Stage | Key mathematics | Result | Submitted |
|---|---|---|---|
| 1 | none | Badge 417 | `417` |
| 2 | Q′(x) = −4x + 12; Q′ = 0 at x = 3; Q″ < 0; Q(3) = 23 ≥ 22. The flow entered before starting must match Q(x) | Setting **3**, entering **23** L/min | `3` |
| 3 | Chord over [0,2] = −6 (wrong branch); tangent T′(2) = −4, and \|−4\| ≤ 5 | Enter **−4**, then **maintain cooling** | `MAINTAIN` |
| 4 | Solve (t−3)(t−5) ≤ 0 → [3,5]; 2t−8 ≤ 0 → t ≤ 4; air → t ≤ 3.5. Intersection [3, 3.5] | Release at **t = 3** | `3;15;-2` |
| 5 | Build the tangent on P(t) at each gauge reading. At 40 kPa: falling 20 kPa/min (over 12). At 18 kPa: 9 kPa/min (under 12) | Two bursts, open at **18 kPa** | `18;9;RELEASE` |

All of the above is verified automatically by the test suite
(`npm test` → `tests/model.test.ts`), including that no mathematically incorrect
choice can satisfy the rescue conditions.
