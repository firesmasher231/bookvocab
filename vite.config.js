import { defineConfig } from 'vite';
import { resolve } from 'path';

// The site is served from the root of its custom domain
// (https://bookvocab.adityajoshi.cc/), so assets live at /. Set
// BASE_PATH=/bookvocab/ to serve from https://<user>.github.io/bookvocab/
// instead (that only applies if the custom domain is removed).
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  publicDir: 'public',
});
