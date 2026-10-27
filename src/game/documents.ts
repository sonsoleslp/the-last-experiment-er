/**
 * Recovered documents: the scientific evidence of the facility.
 *
 * Once discovered, every document stays available from the case file so teams
 * can return to earlier information at any time (an accessibility as well as a
 * usability requirement).
 *
 * LANGUAGE: written for high-school readers, including students reading in a
 * second language. An earlier draft used real plant-engineering vocabulary
 * ("thermal transient", "actuator interlock", "occupant reserve", "dissimilar
 * materials") which was authentic and far too hard. The rule now is: short
 * sentences, everyday words, and where a technical term genuinely earns its
 * place it is explained in the same sentence it appears in. The mathematics is
 * the difficulty in this room; the reading should not be.
 *
 * Paragraphs starting with "> " render as monospaced callouts, and that is
 * where the numbers and formulas live.
 */

export interface GameDocument {
  id: string;
  /** Short label in the case file. */
  title: string;
  /** Document kind, used for styling. */
  kind: 'memo' | 'report' | 'protocol' | 'log';
  /** Letterhead line. */
  source: string;
  /** Body paragraphs. Strings starting with "> " render as callouts. */
  body: string[];
  /** Stage at which this document becomes relevant. */
  stage: number;
}

export const DOCUMENTS: GameDocument[] = [
  {
    id: 'emergency-broadcast',
    title: 'Emergency Message',
    kind: 'memo',
    source: 'MERIDIAN RESEARCH FACILITY: AUTOMATIC SYSTEM',
    stage: 1,
    body: [
      'THE WHOLE BUILDING IS LOCKED DOWN. The automatic cooling system has broken. Every door on this floor has sealed itself shut.',
      'ONE PERSON IS MISSING:',
      '> DR. ELENA VALE. Last seen in Test Chamber C-7. The chamber sealed with her inside. Her emergency air supply has switched on.',
      'The instruments in Chamber C-7 are damaged. The safety system cannot work out on its own whether the door is safe to open. A person has to decide.',
      'Emergency team: go to the cooling control room. Get the coolant flowing, work out which way the temperature is going, and work out the earliest safe moment to open the door.',
    ],
  },
  {
    id: 'vale-notebook',
    title: "Dr. Vale's Notebook",
    kind: 'log',
    source: 'E. VALE: LAB NOTEBOOK, PAGES 112 TO 113',
    stage: 2,
    body: [
      'Everyone treats the dial on pump B like a volume knob. It is not one. Turn it too far and you get LESS coolant, not more. There is a best setting, and past it the flow drops away again.',
      'I have told maintenance twice. I have put the test report in the cooling room with the other folders so the next person does not have to guess.',
      'Also: the sensor that measures how fast the temperature is changing in C-7 has been faulty for a week. If it dies completely, the formula for the chamber is in the thermal folder. You can work the rate out from the formula. You do not need the sensor.',
      '> Note to self: the chamber door does not care how hot it IS. It cares whether it is still getting hotter. I found that out the hard way in the March practice drill.',
    ],
  },
  {
    id: 'calibration-report',
    title: 'Pump B Test Report',
    kind: 'report',
    source: 'MERIDIAN ENGINEERING: REPORT ENG-2291-B',
    stage: 2,
    body: [
      'We tested coolant pump B across every position of its dial, 0 to 6.',
      'The flow Q, in litres per minute, for a dial setting of x, follows this formula:',
      '> Q(x) = -2x² + 12x + 5    (litres per minute, for x from 0 to 6)',
      'ENGINEER\'S NOTE: the flow does not simply rise as you turn the dial up. It rises to a high point and then falls away again, because past that point the dial starts to squeeze the pipe shut. Do not assume the highest setting gives the most flow.',
      'HOW TO FIND THE BEST SETTING. Below the high point, turning the dial one step up gains you flow. Above it, turning it one step up loses you flow. At the high point itself it does neither: a small turn either way barely changes the flow at all.',
      '> So the best setting is the one where the flow has stopped rising and has not started falling. The RATE at which flow changes is zero exactly there. Work out that rate, set it to zero, and solve for the dial setting.',
      'The dial only clicks into whole-number positions. There are no settings in between.',
      'BEFORE YOU START THE PUMP: the controller will not start the pump until you type in the flow you expect at your chosen setting. It checks your number against the formula above. This is to stop people starting the pump without reading this report.',
    ],
  },
  {
    id: 'emergency-protocol',
    title: 'Emergency Cooling Rules',
    kind: 'protocol',
    source: 'MERIDIAN SAFETY OFFICE: RULE EC-4',
    stage: 2,
    body: [
      'If the cooling system fails, you must get the coolant flowing by hand before you touch the chamber.',
      '> YOU NEED AT LEAST 22 LITRES PER MINUTE, STEADY.',
      'Below that, the coolant cannot take heat away fast enough to bring a sealed chamber back to a safe temperature. Do not move on to the temperature checks until you are getting at least 22 and it is holding.',
    ],
  },
  {
    id: 'thermal-model',
    title: 'C-7 Temperature Formula',
    kind: 'report',
    source: 'THERMAL FOLDER: CHAMBER C-7',
    stage: 3,
    body: [
      'How Chamber C-7 cools once the coolant is flowing by hand. Measured on 11 March and checked against three practice drills since.',
      'The temperature T in degrees Celsius, t minutes after you start cooling by hand, follows this formula:',
      '> T(t) = t² - 8t + 30    (degrees Celsius, t in minutes)',
      'This formula describes the whole cooling process. It works whether or not the chamber sensors are still alive.',
    ],
  },
  {
    id: 'safety-protocol',
    title: 'Temperature Action Rules',
    kind: 'protocol',
    source: 'MERIDIAN SAFETY OFFICE: RULE TH-9',
    stage: 3,
    body: [
      'Before you touch the chamber, work out how fast its temperature is changing RIGHT NOW. Then follow the table.',
      '> If the temperature is GOING UP: turn on the emergency cooling gas.',
      '> If it is FALLING faster than 5 °C per minute: turn the coolant down. Cooling too fast is dangerous.',
      '> If it is FALLING at 5 °C per minute or less: leave the cooling as it is.',
      'Why the 5 °C limit: the chamber window and its frame are made of different materials. If you cool them too quickly they shrink by different amounts and the window can crack.',
      'WARNING about the emergency cooling gas: it fills the chamber with cold gas. That stops a fire or a runaway heating problem, but it also stops the normal cooling and uses up the air of anyone inside much faster. Never use it on a chamber that is already cooling down.',
      'WARNING about turning the coolant down: if you drop below the 22 litres per minute in rule EC-4, the chamber will never get cool enough at all. Only turn it down if cooling too fast is the bigger danger.',
      'IF THE SENSOR IS DEAD: you can switch the reading back on by typing in the rate of temperature change yourself. The console checks your number against the chamber formula before it will let you use the controls. The plus or minus sign matters.',
      'A NOTE ON SAVED READINGS: the data recorder saves temperatures, not rates. If you take two saved readings and divide the difference by the time between them, you get the AVERAGE rate over that stretch of time. That is not the same as the rate right now. When the cooling curves, the two are different numbers.',
    ],
  },
  {
    id: 'containment-protocol',
    title: 'C-7 Door Opening Rules',
    kind: 'protocol',
    source: 'MERIDIAN SAFETY OFFICE: RULE CR-2, CHAMBER C-7',
    stage: 4,
    body: [
      'The chamber door will only unlock when all three of these are true at the same moment.',
      '> 1. The chamber is at 15 °C or below.',
      '> 2. The temperature is not going up.',
      '> 3. The person inside still has air left.',
      'Rule 1 is there because the rubber seal around the door warps above 15 °C, and then we cannot promise it will pull back out of the way.',
      'Rule 2 is there because opening a door on a chamber that is still heating up pushes that heat out into the corridor. Cool enough is not sufficient. It also has to be no longer getting hotter.',
      'Rule 3 is absolute. The emergency air lasts 3.5 minutes from the moment hand cooling starts. Do not agree to open the door after that point.',
      'Your job is to find the EARLIEST moment when all three are true, and open the door then.',
    ],
  },
  {
    id: 'air-reserve',
    title: 'C-7 Air Supply Details',
    kind: 'report',
    source: 'MERIDIAN LIFE SUPPORT: SPEC LS-C7',
    stage: 4,
    body: [
      'Emergency air supply for Test Chamber C-7. Enough for one person.',
      '> IT LASTS 3.5 MINUTES, counting from the moment hand cooling starts.',
      'The air comes from a sealed tank. While the chamber is shut you cannot top it up, swap it, or make it last longer. The door has to be opened inside that time.',
    ],
  },
  {
    id: 'valve-spec',
    title: 'C-7 Release Valve Details',
    kind: 'report',
    source: 'MERIDIAN ENGINEERING: REPORT ENG-3310-V',
    stage: 5,
    body: [
      'The emergency release valve on Chamber C-7, and the rule for opening the door.',
      'The chamber is kept at a higher pressure than the corridor during tests. The release valve lets that extra pressure out before the door can be opened.',
      'WHY THE RULE IS ABOUT SPEED, NOT PRESSURE. A person can sit at high pressure all day and feel nothing. What hurts is pressure CHANGING quickly: it is the same reason your ears hurt when an aircraft comes down. Open the door while the pressure is still dropping fast and the rest of it empties through the doorway in one rush, straight past whoever is in there.',
      '> So the door may only be opened while the pressure is falling SLOWER than 12 kPa per minute.',
      'THE PROBLEM YOU HAVE. The gauge tells you how HIGH the pressure is. The rule is about how FAST it is changing. Those are two different things, and getting from one to the other is the job.',
      'Measured decay of the extra pressure once the valve opens:',
      '> P(t) = 90 \u00D7 e^(-0.5t)    kPa, t in minutes since the valve opened',
      'HOW TO READ A SPEED OFF THAT CURVE. The curve is steep at first and flattens out later, so the speed keeps changing. To find it at one moment, draw the straight line that just TOUCHES the curve there without cutting through it. That line is called the tangent, and how steep the line is, is how fast the pressure is falling. The console has a tool for drawing it.',
      'A SHORTCUT WE NOTICED. On this valve the speed always comes out as half the pressure showing on the gauge. At 40 kPa it is falling at 20 kPa per minute; at 10 kPa, only 5. Useful as a check on what the tangent tool tells you.',
      'The valve lets pressure out in bursts and then HOLDS, so you can take a reading. There is only enough charge for two bursts.',
      'A NOTE ON AIR: opening the release valve also connects the chamber to the corridor air line. From that moment the person inside is breathing corridor air, so the 3.5 minute tank limit no longer applies.',
    ],
  },
];

export const documentById = (id: string): GameDocument | undefined =>
  DOCUMENTS.find((d) => d.id === id);

export const documentsForStage = (stage: number): GameDocument[] =>
  DOCUMENTS.filter((d) => d.stage === stage);
