// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://max-netzwerk.work',
  // Keep the old flat URLs (/projects.html, /skills.html, …) so existing
  // links, bookmarks and printed QR codes keep working.
  build: {
    format: 'file',
  },
});
