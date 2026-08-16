/**
 * Lire et écrire le fichier de château.
 *
 * L'export élague ce qui vaut déjà par défaut - une salle 16×3 n'écrit pas ses
 * dimensions, un booléen faux ne s'écrit pas du tout. C'est l'usage de `rooms.ts`
 * (« on n'écrit dans chaque salle que ce qui s'en écarte ») et cela rend le fichier
 * relisible et comparable d'une version à l'autre.
 *
 * La LECTURE, elle, est celle du jeu (`world/loadCastle.ts`) : une seule
 * implémentation du format, donc aucun risque que l'éditeur accepte un fichier que
 * le jeu refuserait.
 */

import { DEFAULT_COLS, DEFAULT_ROWS } from "../config";
import type { CastleDef, RoomDef } from "../world/rooms";

export const FORMAT = "aigledor-castle";
export const VERSION = 1;

/**
 * Listes dont le vide veut dire quelque chose :
 *  - `torches: []` = salle noire (l'absence du champ, elle, vaut deux torches allumées) ;
 *  - `doors: []` = salle sans issue (l'oubliette), et le jeu exige le tableau.
 */
const KEEP_EMPTY = new Set(["torches", "doors"]);

export function toJSON(castle: CastleDef, name: string): string {
  const rooms: Record<string, unknown> = {};
  for (const [id, room] of Object.entries(castle.rooms)) rooms[id] = pruneRoom(room);

  return JSON.stringify(
    {
      format: FORMAT,
      version: VERSION,
      name,
      startRoom: castle.start,
      startSpawn: castle.spawn,
      oubliette: castle.oubliette,
      rooms,
    },
    null,
    1,
  );
}

function pruneRoom(room: RoomDef): Record<string, unknown> {
  // L'id n'est pas répété dans le fichier : la clé fait foi (le jeu le réinjecte).
  const { id: _key, ...rest } = room as Record<string, any>;

  if (!rest.layout) {
    if (rest.cols === DEFAULT_COLS) delete rest.cols;
    if (rest.rows === DEFAULT_ROWS) delete rest.rows;
  } else {
    delete rest.cols;
    delete rest.rows;
  }

  for (const key of Object.keys(rest)) {
    const value = rest[key];
    if (value === false || value === undefined) delete rest[key];
    else if (Array.isArray(value) && !value.length && !KEEP_EMPTY.has(key)) delete rest[key];
  }
  return rest;
}

/** Propose le fichier au téléchargement. */
export function download(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Ouvre un fichier et rend son contenu brut (l'analyse est faite par l'appelant). */
export function openFile(then: (text: string, name: string) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) file.text().then((text) => then(text, file.name.replace(/\.json$/i, "")));
  };
  input.click();
}

/** Nom de fichier acceptable, tiré du nom du château. */
export function fileName(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug || "chateau"}.json`;
}
