/**
 * Charger un château fabriqué dans l'éditeur (`dist/editor.html`).
 *
 * Le jeu embarque le château de Ronceval ; ce module est la SEULE porte d'entrée
 * d'un autre château, sous forme d'un fichier JSON que le joueur dépose depuis
 * l'écran de sélection (touche 3) ou en le glissant sur la fenêtre.
 *
 * On n'y vérifie QUE ce qui empêcherait le jeu de démarrer : la validation des
 * règles du format (portes appariées, spawns, orientations, jouabilité) est le
 * travail de l'éditeur, qui refuse d'exporter un château fautif. La refaire ici
 * coûterait des centaines d'octets au bundle pour un cas qui ne se produit qu'en
 * bricolant le fichier à la main.
 *
 * Format attendu (voir README, « L'éditeur de château ») :
 *   { format, version, name?, startRoom, startSpawn, oubliette, rooms: { id: RoomDef } }
 * L'`id` d'une salle n'est pas répété dans le fichier : la clé fait foi.
 */

import type { RoomId } from "../types";
import type { CastleDef, RoomDef } from "./rooms";

/** Château lu depuis un fichier, avec le nom du fichier pour l'afficher. */
export interface LoadedCastle {
  castle: CastleDef;
  name: string;
}

/** Analyse le contenu d'un fichier de château. `null` si ce n'en est pas un. */
export function parseCastle(text: string): CastleDef | null {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  const rooms = data?.rooms as Record<RoomId, RoomDef> | undefined;
  if (!rooms || typeof rooms !== "object") return null;

  const ids = Object.keys(rooms);
  if (!ids.length) return null;
  for (const id of ids) {
    const room = rooms[id];
    // `Room` construit ses portes sans filet (`def.doors.map`) : une salle sans
    // tableau de portes ferait planter le jeu au premier pas.
    if (!room || !Array.isArray(room.doors)) return null;
    room.id = id;
    room.name ??= id;
  }

  const start = data.startRoom as RoomId;
  const oubliette = (data.oubliette ?? "oubliette") as RoomId;
  // Sans salle de départ on ne peut pas entrer ; sans oubliette, la première dalle
  // piégée ferait tomber le héros dans le vide.
  if (!rooms[start] || !rooms[oubliette]) return null;

  return { rooms, start, spawn: data.startSpawn ?? { col: 0, row: 0 }, oubliette };
}

/** Ouvre le sélecteur de fichiers du système. Rien n'est ajouté à `index.html`. */
export function pickCastle(then: (loaded: LoadedCastle) => void, fail: () => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) readCastle(file, then, fail);
  };
  input.click();
}

/** Glisser-déposer d'un fichier de château n'importe où sur la fenêtre. */
export function dropCastle(then: (loaded: LoadedCastle) => void, fail: () => void): void {
  addEventListener("dragover", (e) => e.preventDefault());
  addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) readCastle(file, then, fail);
  });
}

function readCastle(file: File, then: (loaded: LoadedCastle) => void, fail: () => void): void {
  file.text().then((text) => {
    const castle = parseCastle(text);
    if (castle) then({ castle, name: file.name.replace(/\.json$/i, "") });
    else fail();
  }, fail);
}
