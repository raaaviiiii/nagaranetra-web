import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
/* The manifest needs literal colours — a JSON manifest cannot reference a CSS variable.
   Rather than copy two hex values out of tokens.css and let them rot, read them at build
   time. tokens.css stays the single source of colour (CLAUDE.md §5). */
const tokens = readFileSync(new URL('./src/styles/tokens.css', import.meta.url), 'utf8');
function token(name: string): string {
  const hit = tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!hit) throw new Error(`token --${name} not found in tokens.css`);
  return hit[1];
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The emergency path must survive a reload on a dead network, so the shell
      // and every asset it needs are precached. autoUpdate: a resident should
      // never be looking at a stale build during an event.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        // Fonts and the committed hazard scenarios are part of the offline product,
        // not incidental assets (CLAUDE.md §3, §5).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'],
      },
      manifest: {
        name: 'Nagaranetra',
        short_name: 'Nagaranetra',
        description:
          'Household-aware multi-hazard warnings. What the hazard means for your house, not your district.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: token('paper'),
        theme_color: token('ink'),
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
