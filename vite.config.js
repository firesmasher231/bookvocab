import { defineConfig } from 'vite';
import { resolve } from 'path';

// GitHub Pages serves project sites from https://<user>.github.io/<repo>/,
// so every built URL must be prefixed with the repo name. Override with
// BASE_PATH=/ when deploying to a domain root instead.
const base = process.env.BASE_PATH || '/bookvocab/';

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
