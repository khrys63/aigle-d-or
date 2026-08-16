import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Build de l'ÉDITEUR (`dist/editor.html`), séparé de celui du jeu.
 *
 * Deux configs plutôt qu'une à deux entrées : `vite-plugin-singlefile` refuse
 * explicitement les entrées multiples (« Issues opened requesting multiple entry
 * points will be closed as wontfix »). Une config par fichier produit, donc.
 *
 * L'éditeur est HORS de la contrainte de taille du jeu (128 ko, la RAM d'un TO9) :
 * il n'est pas minifié, autant qu'il reste lisible.
 */
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    // Ne pas effacer le dist/index.html du jeu, construit par l'autre config.
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: "editor.html",
    },
  },
  server: {
    open: "/editor.html",
  },
});
