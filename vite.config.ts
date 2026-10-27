import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// THE LAST EXPERIMENT — build config.
//
// In production the Escapp server serves this app and injects
// `window.ESCAPP_APP_SETTINGS` into the page itself. For local `npm run dev`
// we reproduce that injection from a git-ignored `config.mjs`, so the real
// production adapter can be exercised against a preview escape room without
// any code change. See guides/ESCAPP_SETUP.md.
export default defineConfig(async ({ mode }) => {
  let devSettings: unknown = null;
  const configPath = resolve(process.cwd(), 'config.mjs');
  if (mode === 'development' && existsSync(configPath)) {
    try {
      const mod = await import(pathToFileURL(configPath).href);
      devSettings = mod.ESCAPP_APP_SETTINGS ?? null;
    } catch (e) {
      console.warn('vite: could not load config.mjs —', (e as Error).message);
    }
  }

  const escappDevSettings = {
    name: 'escapp-dev-settings',
    transformIndexHtml() {
      if (!devSettings) return;
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend' as const,
          children: `window.ESCAPP_APP_SETTINGS = ${JSON.stringify(devSettings)};`,
        },
      ];
    },
  };

  return {
    plugins: [react(), escappDevSettings],
    // Relative base so the bundle works wherever Escapp mounts/embeds it, and
    // equally under a GitHub Pages project subpath.
    base: process.env.VITE_BASE_PATH || './',
    build: {
      /*
       * Build into `docs/` rather than `dist/`, because GitHub Pages can serve
       * a site straight from `/docs` on the default branch. One `npm run build`
       * then both produces the bundle to hand to Escapp and updates the live
       * page.
       *
       * The written guides used to live here and were moved to `guides/` for
       * this: Vite EMPTIES its output directory on every build, so leaving
       * them in place would have deleted them the first time anyone built.
       */
      outDir: 'docs',
      emptyOutDir: true,
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    },
  };
});
