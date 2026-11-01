# Bookvocab wall

This branch is the cover wall. `main` is unchanged, and [bookvocab.adityajoshi.cc](https://bookvocab.adityajoshi.cc) keeps serving `main`.

The wall is a static Vite app (`src/main.tsx`). The old vanilla files are still in the tree and are not the entry point.

## Pages

GitHub Pages is one site per repository. `.github/workflows/wall.yml` builds on every push to `wall`, but it deploys only when you run the workflow by hand. That manual run replaces the live site. To put the old site back, re-run **Deploy Vite to GitHub Pages** from `main`.
