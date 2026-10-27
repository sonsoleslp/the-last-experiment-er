/**
 * Classroom display mode: `?interface=class`.
 *
 * Plays the opening cinematic and nothing else, with **no Escapp session and
 * no sign-in**. It exists for the projector at the front of the room: the
 * teacher shows the briefing to the whole class before anybody logs in and
 * teams start playing on their own machines.
 *
 * Because it authenticates nobody, it can also do nothing: no puzzle can be
 * submitted, no progress is recorded, and no Escapp client is constructed at
 * all. That last part matters. If the mode merely hid the game behind the
 * provider tree, the Escapp client would still boot, still fail to find a
 * participant, and still put a sign-in dialog on the projector. So the
 * classroom route renders OUTSIDE the providers entirely.
 */

/** Was the app opened in classroom display mode? */
export const isClassroomMode = (): boolean => {
  try {
    const value = new URLSearchParams(window.location.search).get('interface');
    return typeof value === 'string' && value.trim().toLowerCase() === 'class';
  } catch {
    return false;
  }
};
