// DEV ONLY. Copy to `config.mjs` (git-ignored) to run THE LAST EXPERIMENT
// locally against a real Escapp escape room with `npm run dev`.
//
// In production the Escapp server injects these settings itself, so config.mjs
// is never used there. Never put API credentials or secret keys in this file
// it is bundled into client-side code.
//
// The escape room must have 5 puzzles configured with the solutions documented
// in src/escapp/puzzles.ts and guides/ESCAPP_SETUP.md:
//   1: 417        2: 3        3: MAINTAIN        4: 3;15;-2        5: 22;11;RELEASE
export let ESCAPP_APP_SETTINGS = {
  // App language. Currently "en" only.
  locale: 'en',

  escappClientSettings: {
    // Your escape room's API endpoint.
    endpoint: 'https://escapp.es/api/escapeRooms/<YOUR_ESCAPE_ROOM_ID>',
    // Author preview mode: play without a real participant team.
    preview: true,
    // Real-time team sync via websockets. MUST be true for a teammate's
    // success to reach the other members' screens. Preview mode forces it off.
    rtc: true,
  },
};
