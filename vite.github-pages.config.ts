import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "../public",
  root: "github-pages",
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: "../gh-pages-dist",
  },
});
