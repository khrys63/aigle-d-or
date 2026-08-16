/**
 * Percer un passage entre deux salles - le geste central de l'éditeur.
 *
 * Les règles immuables du format (README, « Les portes ») veulent qu'une porte soit
 * TOUJOURS accompagnée de sa jumelle dans la salle d'en face, et que le `spawn` de
 * l'une désigne la case de l'autre. On ne les vérifie donc pas après coup : on écrit
 * les deux portes d'un seul geste, et l'appariement est vrai par construction.
 *
 * Où se pose une porte est également dicté par le format : mur du fond en colonne 8
 * (`BACK_DOOR_COL`, « deux sauts du mur de gauche »), murs latéraux en rangée 0.
 */

import { BACK_DOOR_COL, DEFAULT_COLS, DEFAULT_ROWS } from "../config";
import type { DoorSide } from "../entities/Door";
import type { RoomId } from "../types";
import type { CastleDef, DoorDef, RoomDef } from "../world/rooms";
import type { PlanDir } from "../world/mapLayout";

/** Inverse de `SIDE_TURN` (mapLayout) : le mur correspondant à un quart de tour. */
const SIDE_BY_TURN: readonly DoorSide[] = ["front", "right", "back", "left"];

/** `SIDE_TURN` de `mapLayout` : le mur, en quarts de tour depuis le mur du fond. */
const TURN_BY_SIDE: Record<DoorSide, number> = { front: 0, right: 1, back: 2, left: 3 };

/** Dimensions effectives d'une salle : le `layout` prime sur `cols`/`rows`. */
export function roomSize(room: RoomDef): { cols: number; rows: number } {
  if (room.layout?.length) return { cols: room.layout[0].length, rows: room.layout.length };
  return { cols: room.cols ?? DEFAULT_COLS, rows: room.rows ?? DEFAULT_ROWS };
}

/** La case (col,row) est-elle du sol praticable ? */
export function isFloor(room: RoomDef, col: number, row: number): boolean {
  const { cols, rows } = roomSize(room);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
  return room.layout ? room.layout[row][col] === "." : true;
}

/**
 * Mur à percer pour qu'une porte parte dans la direction `dir` DU PLAN, sachant
 * que la salle regarde `facing`. C'est l'inverse exact de `planDir()` (mapLayout).
 */
export function sideForPlanDir(dir: PlanDir, facing: PlanDir): DoorSide {
  return SIDE_BY_TURN[(dir - facing + 4) % 4];
}

/** Direction opposée sur le plan. */
export function opposite(dir: PlanDir): PlanDir {
  return ((dir + 2) % 4) as PlanDir;
}

/** Case où se pose une porte sur un mur donné, selon les règles du format. */
export function doorSlot(room: RoomDef, side: DoorSide): { col: number; row: number } {
  const { cols, rows } = roomSize(room);
  // Mur du fond / mur avant : colonne 8, à la profondeur du mur.
  if (side === "front") return { col: BACK_DOOR_COL, row: rows - 1 };
  if (side === "back") return { col: BACK_DOOR_COL, row: 0 };
  // Murs latéraux : toujours au premier plan.
  return { col: side === "left" ? 0 : cols - 1, row: 0 };
}

/** Une porte occupe-t-elle déjà cette case ? */
function doorAt(room: RoomDef, col: number, row: number): DoorDef | undefined {
  return room.doors.find((d) => d.col === col && d.row === row);
}

/** Salle neuve au gabarit d'époque : 16×3, deux torches allumées, rien d'autre. */
export function makeRoom(id: RoomId, name = id): RoomDef {
  return { id, name, doors: [] };
}

/** Identifiant libre de la forme `s1`, `s2`… */
export function freeRoomId(castle: CastleDef): RoomId {
  for (let n = 1; ; n++) {
    const id = `s${n}`;
    if (!castle.rooms[id]) return id;
  }
}

/**
 * Écrit la PAIRE de portes reliant `a` et `b`. Retourne un message si le passage
 * ne peut pas se faire (mur déjà occupé), `null` s'il a été percé.
 *
 * `opts` s'applique aux DEUX portes (arche, grille, serrure) sauf `stairs`, qui ne
 * se marque que d'un côté - la porte d'en face en déduit son sens (voir mapLayout).
 */
export function connect(
  castle: CastleDef,
  a: RoomId,
  b: RoomId,
  sideA: DoorSide,
  sideB: DoorSide,
  opts: Partial<DoorDef> = {},
): string | null {
  const roomA = castle.rooms[a];
  const roomB = castle.rooms[b];
  if (!roomA || !roomB) return "Salle inconnue.";

  // « On n'arrive jamais par le bas » : le mur avant (côté caméra) ne porte pas de
  // passage. Une salle tournée de telle sorte que c'est SON avant qui donne dans la
  // direction voulue ne peut pas s'y ouvrir - il faut la rejoindre par un autre côté.
  const front = sideA === "back" ? roomA : sideB === "back" ? roomB : null;
  if (front)
    return `De ce côté, « ${front.name} » présente son avant (le côté caméra) : le format n'y met pas de porte. Rejoignez-la par un autre mur.`;

  const slotA = doorSlot(roomA, sideA);
  const slotB = doorSlot(roomB, sideB);
  if (doorAt(roomA, slotA.col, slotA.row)) return `Le mur ${WALL[sideA]} de « ${roomA.name} » a déjà une porte.`;
  if (doorAt(roomB, slotB.col, slotB.row)) return `Le mur ${WALL[sideB]} de « ${roomB.name} » a déjà une porte.`;
  if (!isFloor(roomA, slotA.col, slotA.row)) return `La case de la porte est vide dans « ${roomA.name} ».`;
  if (!isFloor(roomB, slotB.col, slotB.row)) return `La case de la porte est vide dans « ${roomB.name} ».`;

  const { stairs, ...shared } = opts;
  roomA.doors.push({ ...slotA, side: sideA, target: b, spawn: { ...slotB }, ...shared, ...(stairs ? { stairs } : {}) });
  roomB.doors.push({ ...slotB, side: sideB, target: a, spawn: { ...slotA }, ...shared });
  return null;
}

/**
 * Tourne une salle d'un quart de tour SUR LE PLAN (`quarter` = +1 dans le sens des
 * aiguilles d'une montre).
 *
 * Il n'y a rien à faire tourner à proprement parler : l'orientation d'une salle
 * n'est écrite nulle part, `mapLayout` la déduit de l'appariement des portes. Le
 * seul levier est donc **le mur qui porte chaque porte** - et comme le plan garde
 * la direction d'un passage, faire avancer les murs d'un cran fait reculer
 * l'orientation d'autant : d'où le `- quarter`.
 *
 * Le contenu de la salle ne bouge pas : objets, gardes et meubles sont dans le
 * repère de la salle, qui est toujours dessinée de face.
 *
 * Retourne un message si la rotation est impossible, `null` si elle a eu lieu.
 */
export function rotateRoom(castle: CastleDef, id: RoomId, quarter: number): string | null {
  const room = castle.rooms[id];
  if (!room) return "Salle inconnue.";
  if (!room.doors.length) return `« ${room.name} » n'a aucune porte : rien ne fixe son orientation.`;

  const twins = twinsOf(castle, id);
  const moves = room.doors.map((door, i) => {
    const side = SIDE_BY_TURN[(TURN_BY_SIDE[door.side] - quarter + 8) % 4];
    return { door, side, slot: doorSlot(room, side), twin: twins[i] };
  });

  const onFront = moves.find((m) => m.side === "back");
  if (onFront)
    return `Rotation impossible : la porte vers « ${onFront.door.target} » tomberait sur le mur avant, où le format n'en met pas.`;

  const inVoid = moves.find((m) => !isFloor(room, m.slot.col, m.slot.row));
  if (inVoid)
    return `Rotation impossible : la case du mur ${WALL[inVoid.side]} (${inVoid.slot.col},${inVoid.slot.row}) est vide dans « ${room.name} ».`;

  for (const { door, side, slot, twin } of moves) {
    door.side = side;
    door.col = slot.col;
    door.row = slot.row;
    // La jumelle doit suivre, sinon son `spawn` viserait une case sans porte.
    if (twin) twin.spawn = { ...slot };
  }
  return null;
}

// ── Gabarits de salle ─────────────────────────────────────────────────────
//
// Le format ne connaît que quatre plans de sol usuels : trois rectangles de
// profondeurs différentes, et une salle en T. (`round` n'en est pas un : c'est un
// modificateur de rendu, qui s'applique à n'importe lequel.)

export type ShapeId = "rect3" | "rect2" | "corridor" | "tee";

export const SHAPES: readonly { id: ShapeId; label: string }[] = [
  { id: "rect3", label: "Rectangle - 3 rangées" },
  { id: "rect2", label: "Rectangle - 2 rangées" },
  { id: "corridor", label: "Couloir - 1 rangée" },
  { id: "tee", label: "Salle en T" },
];

/** Le fût du T reste centré sur la colonne de la porte du fond, sinon elle serait murée. */
function teeLayout(cols: number): string[] {
  const back = Array.from({ length: cols }, (_, col) =>
    Math.abs(col - BACK_DOOR_COL) <= 2 ? "." : "#",
  ).join("");
  return [".".repeat(cols), back];
}

/** Gabarit reconnu, ou `null` si la salle a été creusée à la main. */
export function shapeOf(room: RoomDef): ShapeId | null {
  const { cols, rows } = roomSize(room);
  const byDepth = rows === 1 ? "corridor" : rows === 2 ? "rect2" : rows === 3 ? "rect3" : null;
  if (!room.layout) return byDepth;
  if (rows === 2 && room.layout.join("|") === teeLayout(cols).join("|")) return "tee";
  // Un layout sans le moindre trou n'est qu'un rectangle écrit autrement - c'est
  // ainsi qu'on note le plus souvent les couloirs.
  return room.layout.every((line) => !line.includes("#")) ? byDepth : null;
}

/** Applique un gabarit en conservant la largeur de la salle. */
export function applyShape(castle: CastleDef, id: RoomId, shape: ShapeId): string | null {
  const room = castle.rooms[id];
  if (!room) return "Salle inconnue.";
  const { cols } = roomSize(room);
  if (shape === "tee" && cols < BACK_DOOR_COL + 3)
    return `Une salle en T demande au moins ${BACK_DOOR_COL + 3} colonnes : son fût est centré sur la colonne ${BACK_DOOR_COL}.`;

  const twins = twinsOf(castle, id);
  setGeometry(room, shape, cols);
  return reslotDoors(castle, id, twins);
}

function setGeometry(room: RoomDef, shape: ShapeId, cols: number): void {
  delete room.layout;
  if (shape === "tee") {
    // Une forme libre porte ses dimensions dans son layout : `cols`/`rows` seraient
    // redondants, et le format veut qu'on n'écrive que le nécessaire.
    room.layout = teeLayout(cols);
    delete room.cols;
    delete room.rows;
    return;
  }
  room.cols = cols;
  room.rows = shape === "rect3" ? 3 : shape === "rect2" ? 2 : 1;
}

/**
 * Change les dimensions d'une salle. Un gabarit se **régénère** à la nouvelle
 * largeur (élargir un T garde un T) ; une forme creusée à la main, elle, n'a pas de
 * redimensionnement qui ait un sens.
 */
export function resizeRoom(castle: CastleDef, id: RoomId, cols: number, rows: number): string | null {
  const room = castle.rooms[id];
  if (!room) return "Salle inconnue.";
  const shape = shapeOf(room);
  if (room.layout && !shape)
    return "Cette salle est dessinée à la main : creusez ou rebouchez le sol, ou repartez d'un gabarit.";
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1)
    return "Des dimensions entières et positives, au minimum.";
  if (rows > 8) return "Au-delà de 8 rangées la salle ne tient plus à l'écran (le gabarit d'époque est 2 à 3).";
  // La porte du fond est toujours en colonne 8 : une salle qui en porte une doit
  // être assez large pour l'accueillir.
  if (cols <= BACK_DOOR_COL && room.doors.some((d) => d.side === "front" || d.side === "back"))
    return `Il faut au moins ${BACK_DOOR_COL + 1} colonnes : la porte du fond se pose en colonne ${BACK_DOOR_COL}.`;

  const twins = twinsOf(castle, id);
  if (room.layout && shape) setGeometry(room, shape, cols);
  else {
    room.cols = cols;
    room.rows = rows;
  }
  return reslotDoors(castle, id, twins);
}

/**
 * Replace les portes sur leur case réglementaire après un changement de géométrie,
 * et met à jour le `spawn` de chaque jumelle - sans quoi redimensionner une salle
 * casserait tous ses passages d'un coup.
 *
 * On contrôle AVANT de rien recâbler : mieux vaut refuser le geste (le brouillon
 * sera jeté par `tryEdit`) que laisser une salle à moitié faite.
 */
function reslotDoors(castle: CastleDef, id: RoomId, twins: (DoorDef | null)[]): string | null {
  const room = castle.rooms[id];
  for (const door of room.doors) {
    const slot = doorSlot(room, door.side);
    if (!isFloor(room, slot.col, slot.row))
      return `Cette forme murerait la porte vers « ${door.target} » : sa case du mur ${WALL[door.side]} est vide.`;
  }
  room.doors.forEach((door, i) => {
    const slot = doorSlot(room, door.side);
    door.col = slot.col;
    door.row = slot.row;
    if (twins[i]) twins[i]!.spawn = { ...slot };
  });
  return null;
}

/**
 * Les portes d'en face, relevées AVANT toute modification : une jumelle se
 * reconnaît à la CASE de sa porte, qui est justement ce que rotation et
 * redimensionnement vont changer.
 */
function twinsOf(castle: CastleDef, id: RoomId): (DoorDef | null)[] {
  return castle.rooms[id].doors.map((door) => {
    const index = facingDoorIndex(castle, id, door);
    return index >= 0 ? castle.rooms[door.target].doors[index] : null;
  });
}

/** Porte d'en face : celle qui attend le héros sur la case d'arrivée. */
export function facingDoorIndex(castle: CastleDef, from: RoomId, door: DoorDef): number {
  const target = castle.rooms[door.target];
  if (!target) return -1;
  return target.doors.findIndex(
    (d) => d.col === door.spawn.col && d.row === door.spawn.row && d.target === from,
  );
}

/** Supprime une porte ET sa jumelle. */
export function disconnect(castle: CastleDef, from: RoomId, index: number): void {
  const room = castle.rooms[from];
  const door = room?.doors[index];
  if (!door) return;
  const twin = facingDoorIndex(castle, from, door);
  if (twin >= 0) castle.rooms[door.target].doors.splice(twin, 1);
  room.doors.splice(index, 1);
}

/** Porte de sortie du château : la porte principale, au mur du fond. */
export function makeExitDoor(room: RoomDef): DoorDef {
  const slot = doorSlot(room, "front");
  return { ...slot, side: "front", target: "__exit__", spawn: { col: BACK_DOOR_COL, row: 0 }, exit: true };
}

/** Libellés des murs, pour les messages. */
export const WALL: Record<DoorSide, string> = {
  front: "du fond",
  back: "avant",
  left: "gauche",
  right: "droit",
};
