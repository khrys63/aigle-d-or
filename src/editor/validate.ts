/**
 * LE VALIDATEUR : ce que l'éditeur sait du format, mis noir sur blanc.
 *
 * Deux niveaux, et la distinction compte :
 *  - **erreur** : le château est cassé - il planterait, ou le plan cesserait d'être
 *    « dessinable à la main » (les règles immuables du README). L'export est bloqué.
 *  - **avertissement** : le château tourne, mais quelque chose est probablement une
 *    étourderie - une salle qu'on n'atteint jamais, un trophée manquant, un étage de
 *    tour non déclaré. L'auteur reste juge : l'export passe.
 *
 * Fonction pure : elle ne connaît ni le DOM ni les vues.
 */

import { BACK_DOOR_COL } from "../config";
import type { RoomId } from "../types";
import type { CastleDef, RoomDef } from "../world/rooms";
import { FURNITURE_W, type FurnitureKind } from "../world/rooms";
import { isFloor, roomSize, WALL } from "./doors";
import type { ListKey } from "./store";

export interface Check {
  level: "error" | "warn";
  message: string;
  room?: RoomId;
  list?: ListKey;
  index?: number;
}

/** Les trois trophées : les réunir est la condition de victoire. */
const TROPHIES = ["eagle", "diamond", "book"] as const;

export function validate(castle: CastleDef): Check[] {
  const checks: Check[] = [];
  const error = (message: string, room?: RoomId, list?: ListKey, index?: number) =>
    checks.push({ level: "error", message, room, list, index });
  const warn = (message: string, room?: RoomId, list?: ListKey, index?: number) =>
    checks.push({ level: "warn", message, room, list, index });

  const rooms = castle.rooms;
  const ids = Object.keys(rooms);

  // ── Repères du château ────────────────────────────────────────────────
  if (!rooms[castle.start]) error(`La salle de départ « ${castle.start} » n'existe pas.`);
  const trapped = ids.some((id) => rooms[id].traps?.length || rooms[id].chests?.some((c) => c.trap));
  if (!rooms[castle.oubliette]) {
    if (trapped) error(`Des pièges font tomber en oubliette, mais « ${castle.oubliette} » n'existe pas.`);
    else warn(`Aucune salle-oubliette : le château ne peut pas avoir de dalle piégée.`);
  }

  for (const id of ids) {
    const room = rooms[id];
    const { cols, rows } = roomSize(room);

    // ── La salle elle-même ──────────────────────────────────────────────
    if (room.id !== id) error(`L'identifiant interne (« ${room.id} ») ne correspond pas à la clé.`, id);
    if (!room.name) warn("Salle sans nom.", id);
    if (room.layout?.some((line) => line.length !== cols))
      error("Les rangées du layout n'ont pas toutes la même longueur.", id);

    // ── Portes ──────────────────────────────────────────────────────────
    room.doors.forEach((door, index) => {
      const where = (message: string, level: "error" | "warn" = "error") =>
        (level === "error" ? error : warn)(message, id, "doors", index);

      // Règles immuables : sans elles, le plan cesse d'être déductible.
      if (door.side === "left" || door.side === "right") {
        if (door.row !== 0) where(`Porte ${WALL[door.side]} hors de la rangée 0 (règle : toujours au premier plan).`);
        if (door.col !== (door.side === "left" ? 0 : cols - 1))
          where(`Porte ${WALL[door.side]} qui n'est pas contre son mur.`);
      }
      if (door.side === "front") {
        if (door.col !== BACK_DOOR_COL) where(`Porte du fond en colonne ${door.col} au lieu de ${BACK_DOOR_COL}.`);
        if (door.row !== rows - 1) where(`Porte du fond en rangée ${door.row} au lieu de ${rows - 1} (le mur du fond).`);
      }
      if (!isFloor(room, door.col, door.row)) where("Porte posée sur une case vide.");

      if (door.target === "__exit__") return;
      const target = rooms[door.target];
      if (!target) return where(`Mène à une salle inconnue (« ${door.target} »).`);

      if (!isFloor(target, door.spawn.col, door.spawn.row))
        return where(`L'arrivée (${door.spawn.col},${door.spawn.row}) n'est pas du sol dans « ${door.target} ».`);

      const arrival = target.doors.find((d) => d.col === door.spawn.col && d.row === door.spawn.row);
      if (!arrival) return where(`L'arrivée dans « ${door.target} » n'est pas une porte (règle : un spawn est toujours une porte).`);
      if (arrival.side === "back") where("On arrive par une porte « back » : proscrit par le format.");
      if (arrival.target !== id && !arrival.barred)
        where(`Passage à sens unique non assumé : la porte d'en face mène à « ${arrival.target} ». Barrez-la (barred).`, "warn");
    });

    // ── Éléments posés sur la grille ────────────────────────────────────
    checkTiles(room, cols, rows, error);

    // ── Passages verticaux ──────────────────────────────────────────────
    for (const key of ["climbTile", "holeTile"] as const) {
      const tile = room[key];
      if (!tile) continue;
      const label = key === "climbTile" ? "La dalle étoile" : "Le trou";
      if (!isFloor(room, tile.col, tile.row)) error(`${label} est posé hors du sol.`, id);
      if (!tile.target) { error(`${label} ne mène nulle part : choisissez une salle.`, id); continue; }
      const target = rooms[tile.target];
      if (!target) { error(`${label} mène à une salle inconnue (« ${tile.target} »).`, id); continue; }
      if (!isFloor(target, tile.spawn.col, tile.spawn.row))
        error(`${label} fait arriver hors du sol de « ${tile.target} ».`, id);
      // Le retour se fait par la contrepartie (un trou répond à une dalle étoile).
      // On ne demande pas qu'elle soit SOUS la case d'arrivée : on fait toujours
      // arriver à CÔTÉ - arriver sur un trou y ferait aussitôt retomber.
      const back = key === "climbTile" ? target.holeTile : target.climbTile;
      if (back?.target !== id)
        warn(`${label} est sans retour : rien dans « ${tile.target} » ne ramène ici.`, id);
    }

    // ── Cheminées ───────────────────────────────────────────────────────
    (room.fireplaces ?? []).forEach((fireplace, index) => {
      if (!fireplace.secret) return;
      if (!fireplace.target || !fireplace.spawn)
        return error("Cheminée à passage secret sans destination.", id, "fireplaces", index);
      const target = rooms[fireplace.target];
      if (!target) return error(`Cheminée vers une salle inconnue (« ${fireplace.target} »).`, id, "fireplaces", index);
      if (!isFloor(target, fireplace.spawn.col, fireplace.spawn.row))
        return error(`La cheminée fait arriver hors du sol de « ${fireplace.target} ».`, id, "fireplaces", index);
      // Comme pour les dalles étoile, on arrive DEVANT la cheminée d'en face, pas
      // dedans : c'est son existence qu'on vérifie, pas sa case.
      const back = (target.fireplaces ?? []).some((f) => f.secret && f.target === id)
        || target.doors.some((d) => d.target === id && !d.barred);
      if (!back)
        warn(`Passage de cheminée sans retour : rien dans « ${fireplace.target} » ne ramène ici.`, id, "fireplaces", index);
    });
  }

  checks.push(...reachability(castle));
  checks.push(...winnability(castle));
  return checks;
}

/** Tout ce qui est posé sur une case doit tenir dans la salle, sur du sol. */
function checkTiles(
  room: RoomDef,
  cols: number,
  rows: number,
  error: (message: string, room?: RoomId, list?: ListKey, index?: number) => void,
): void {
  const inside = (col: number, row: number) => col >= 0 && col < cols && row >= 0 && row < rows;

  const simple: ListKey[] = ["items", "traps", "bats", "ghosts"];
  for (const list of simple) {
    (room[list] as any[] | undefined)?.forEach((element, index) => {
      const col = element.col ?? 0;
      if (!inside(col, element.row)) error("Posé hors de la salle.", room.id, list, index);
      else if (!isFloor(room, col, element.row) && list !== "bats")
        error("Posé sur une case vide.", room.id, list, index);
    });
  }

  // Coffres, cheminées, squelettes : 3 dalles, centrées sur `col`.
  for (const list of ["chests", "fireplaces", "skeletons"] as ListKey[]) {
    (room[list] as any[] | undefined)?.forEach((element, index) => {
      if (!inside(element.col - 1, element.row) || !inside(element.col + 1, element.row))
        error("Déborde de la salle : ces éléments occupent 3 dalles.", room.id, list, index);
    });
  }

  room.furnitures?.forEach((furniture, index) => {
    const width = FURNITURE_W[furniture.kind as FurnitureKind];
    if (!inside(furniture.col, furniture.row) || !inside(furniture.col + width - 1, furniture.row))
      error(`Déborde de la salle (${width} dalles).`, room.id, "furnitures", index);
  });

  room.guards?.forEach((guard, index) => {
    if (!inside(guard.colMin, guard.row) || !inside(guard.colMax, guard.row))
      error("Ronde hors de la salle.", room.id, "guards", index);
    else if (guard.colMin > guard.colMax) error("Ronde à l'envers (début après la fin).", room.id, "guards", index);
  });

  room.herses?.forEach((herse, index) => {
    if (!inside(herse.triggerCol, herse.triggerRow) || !inside(herse.herseCol, herse.herseRow))
      error("Herse hors de la salle.", room.id, "herses", index);
  });

  room.decors?.forEach((decor, index) => {
    if (decor.col != null && (decor.col < 0 || decor.col >= cols))
      error("Décor hors du mur.", room.id, "decors", index);
  });
}

/** Salles qu'aucun chemin ne relie au départ : le joueur ne les verra jamais. */
function reachability(castle: CastleDef): Check[] {
  const seen = new Set<RoomId>();
  const queue: RoomId[] = [castle.start];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || !castle.rooms[id]) continue;
    seen.add(id);
    const room = castle.rooms[id];
    for (const door of room.doors) if (!door.barred && door.target !== "__exit__") queue.push(door.target);
    for (const fireplace of room.fireplaces ?? []) if (fireplace.target) queue.push(fireplace.target);
    if (room.climbTile?.target) queue.push(room.climbTile.target);
    if (room.holeTile?.target) queue.push(room.holeTile.target);
  }

  return Object.values(castle.rooms)
    // Les oubliettes n'ont volontairement aucune porte : on y TOMBE.
    .filter((room) => !seen.has(room.id) && !room.oubliette && room.id !== castle.oubliette)
    .map((room) => ({
      level: "warn" as const,
      message: "Salle injoignable depuis le départ.",
      room: room.id,
    }));
}

/** Le château est-il gagnable ? Rien de bloquant : c'est l'affaire de l'auteur. */
function winnability(castle: CastleDef): Check[] {
  const checks: Check[] = [];
  const rooms = Object.values(castle.rooms);
  const kinds = new Set<string>();
  for (const room of rooms) {
    for (const item of room.items ?? []) kinds.add(item.kind);
    for (const chest of room.chests ?? []) if (chest.content) kinds.add(chest.content.kind);
  }

  const missing = TROPHIES.filter((trophy) => !kinds.has(trophy));
  if (missing.length)
    checks.push({ level: "warn", message: `Château ingagnable : trophée(s) absent(s) - ${missing.join(", ")}.` });
  if (kinds.has("eagle") && !kinds.has("leadEagle"))
    checks.push({ level: "warn", message: "L'Aigle d'Or est là, mais pas l'aigle de plomb : il restera imprenable." });
  if (!rooms.some((room) => room.doors.some((door) => door.exit)))
    checks.push({ level: "warn", message: "Aucune porte de sortie (`exit`) : on ne peut pas quitter le château." });

  // Une serrure sans sa clef ferme le château pour de bon (le pied-de-biche s'achète).
  const locks = new Set<string>();
  for (const room of rooms) {
    for (const door of room.doors) if (door.lock) locks.add(door.lock);
    for (const chest of room.chests ?? []) if (chest.lock) locks.add(chest.lock);
  }
  if (locks.has("ironKey") && !kinds.has("ironKey"))
    checks.push({ level: "warn", message: "Des serrures demandent la clef en fer, qui n'est nulle part." });
  if (rooms.some((room) => room.fireplaces?.some((f) => f.secret)) && !kinds.has("goldKey"))
    checks.push({ level: "warn", message: "Des cheminées secrètes, mais aucune clef en or pour les ouvrir." });

  return checks;
}
