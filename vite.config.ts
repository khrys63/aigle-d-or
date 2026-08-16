import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  // Inline JS/CSS dans un seul index.html autonome : ouvrable en double-clic (file://).
  plugins: [viteSingleFile()],
  build: {
    // Terser compresse mieux qu'esbuild (~-2,5 % sur le fichier final).
    minify: "terser",
  },
  server: {
    open: true,
  },
});
