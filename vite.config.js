import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Custom domain (https://bookvocab.adityajoshi.cc/) serves from /.
// Set BASE_PATH=/bookvocab/ only if the custom domain is removed.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [react()],
});
