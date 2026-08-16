import type { RoomId } from "../types";
import type { DoorSide } from "../entities/Door";
import type { RoomDef } from "./rooms";

/**
 * PLAN DU CHÂTEAU, déduit des seules données de salles (RoomDef) - aucune
 * coordonnée n'est saisie à la main : le plan est un produit du graphe des salles.
 *
 * Trois déductions, valables pour n'importe quel château :
 *
 *  1. L'ORIENTATION de chaque salle. C'est la clé du plan. Une salle est toujours
 *     dessinée de face, mais RIEN ne dit que toutes regardent le même point
 *     cardinal : le « mur du fond » des cuisines de Ronceval donne sur le corps de
 *     garde, qui est pourtant leur voisin du SUD sur le plan - les cuisines sont
 *     simplement vues en regardant vers le sud. On retrouve donc l'orientation de
 *     chaque salle (un quart de tour parmi quatre) en recollant les passages deux
 *     à deux : franchir une porte et revenir par la porte d'en face doit ramener
 *     à son point de départ. La salle d'entrée sert de référence (elle regarde le
 *     nord, sa porte principale donne sur l'extérieur, en haut du plan) et de
 *     proche en proche tout le château s'oriente, sans contradiction possible.
 *
 *  2. Les POSITIONS. Chaque salle occupe une case. La direction d'une porte sur le
 *     plan, c'est son côté (fond / gauche / droite) TOURNÉ de l'orientation de sa
 *     salle. Le plan se remplit alors de proche en proche depuis l'entrée, et l'on
 *     retrouve la grille qu'on aurait dessinée à la main. Si deux salles se
 *     disputent une case (un château tortueux en produit quelques-unes, hors de la
 *     grille régulière), la seconde se pose sur la case libre la plus proche et sa porte
 *     devient un trait de liaison plutôt qu'une ouverture mitoyenne : rien n'est
 *     perdu, le plan reste vrai.
 *
 *  3. Les NIVEAUX. On part de la salle d'entrée (niveau 0). Portes et cheminées
 *     secrètes gardent le niveau ; un trou au sol (`holeTile`) descend d'un
 *     niveau, une dale étoile (`climbTile`) monte d'un niveau.
 *
 * Une salle atteinte par un trou ou une grimpe se pose à l'aplomb de sa source :
 * les niveaux restent superposés d'un étage à l'autre, comme sur un plan d'archi.
 *
 * Les OUBLIETTES sont écartées du plan : on y tombe de n'importe où, aucune porte
 * n'y mène, elles n'ont donc pas de place sur un plan - et les y faire figurer ne
 * renseignerait sur rien.
 */

/** Direction sur le PLAN (et non dans la salle) : nord, est, sud, ouest. */
export type PlanDir = 0 | 1 | 2 | 3;

/** Nature d'un passage, pour le symbole tracé sur le plan. Le plan ne dit pas si une
 *  porte est verrouillée : arche, porte ou grille suffisent - la serrure se découvre
 *  sur place. */
export type MapDoorKind = "arch" | "door" | "grille" | "exit";

export interface MapDoor {
  /** Mur de la salle sur le plan, une fois l'orientation appliquée. */
  dir: PlanDir;
  kind: MapDoorKind;
  /** Escalier : la porte mène à l'étage au-dessus / au-dessous. */
  stairs: "up" | "down" | null;
  target: RoomId;
  /** La salle cible est-elle sur la case mitoyenne, dans cette direction ? */
  adjacent: boolean;
}

export interface MapRoom {
  id: RoomId;
  name: string;
  level: number;
  /** Case du plan (grille commune à tous les niveaux). */
  gx: number;
  gy: number;
  /** Quart de tour de la salle : le mur du fond regarde `facing` sur le plan. */
  facing: PlanDir;
  doors: MapDoor[];
  /** Trou au sol : descente au niveau inférieur. */
  down: boolean;
  /**
   * Mur de la cheminée sur le plan, `null` si la salle n'en a pas. Une cheminée
   * s'adosse toujours au mur du fond : sur le plan, son mur est donc l'orientation
   * même de la salle. Décorative OU à passage secret, le plan ne fait pas la
   * différence : à charge du joueur de trouver celles qui s'ouvrent. Même raison pour
   * la dale étoile (grimpe à la corde), absente du plan : elle se voit au sol, dans
   * la salle. Une carte donne la structure du château, pas ses secrets.
   */
  fireplace: PlanDir | null;
  /** Salle sans torche allumée au départ (elle peut s'éclairer en cours de partie). */
  dark: boolean;
  entrance: boolean;
}

/** Porte dont les deux salles ne sont pas mitoyennes : tracée en trait de liaison. */
export interface MapLink {
  from: MapRoom;
  to: MapRoom;
}

export interface CastleMap {
  rooms: MapRoom[];
  byId: Map<RoomId, MapRoom>;
  /** Niveaux occupés, du plus haut au plus bas. */
  levels: number[];
  entranceLevel: number;
  links: MapLink[];
  /** Étendue de la grille (commune à tous les niveaux). */
  minX: number;
  minY: number;
  cols: number;
  rows: number;
}

/** Décalage d'une case, par direction du plan (nord, est, sud, ouest). */
export const DELTA: readonly { dx: number; dy: number }[] = [
  { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 },
];

/** Mur d'une salle, exprimé en quarts de tour depuis le mur du fond. */
const SIDE_TURN: Record<DoorSide, PlanDir> = { front: 0, right: 1, back: 2, left: 3 };

/** Direction d'une porte SUR LE PLAN : son mur, tourné de l'orientation de la salle. */
function planDir(side: DoorSide, facing: PlanDir): PlanDir {
  return ((SIDE_TURN[side] + facing) % 4) as PlanDir;
}

/**
 * Porte d'en face : celle qui attend le héros sur sa case d'arrivée, dans la salle
 * cible. C'est elle qui donne l'orientation relative des deux salles - et c'est déjà
 * elle que le jeu cherche pour savoir dans quel sens on débarque (`Game.doTransition`).
 */
function facingDoor(defs: Record<RoomId, RoomDef>, from: RoomId, door: RoomDef["doors"][number]) {
  const target = defs[door.target];
  if (!target) return null;
  const back = target.doors.find((d) => d.col === door.spawn.col && d.row === door.spawn.row);
  return back && back.target === from ? back : null;
}

/**
 * Orientation de chaque salle, en quarts de tour, la salle d'entrée regardant le nord.
 * Deux salles reliées par une porte et sa porte d'en face doivent se tourner le dos :
 * `dir(A) = dir(B) + 2`, ce qui fixe l'orientation de B dès que celle de A est connue.
 */
function orientations(defs: Record<RoomId, RoomDef>, startRoom: RoomId): Map<RoomId, PlanDir> {
  const facing = new Map<RoomId, PlanDir>();
  const seed = (room: RoomId): void => {
    facing.set(room, 0);
    const queue: RoomId[] = [room];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const d of defs[cur].doors) {
        const back = facingDoor(defs, cur, d);
        if (!back || facing.has(d.target)) continue;
        // planDir(d, θcur) = planDir(back, θcible) + 2 (les deux portes se tournent le
        // dos) ⇒ θcible = θcur + côté(d) - côté(back) - 2, soit +2 modulo 4.
        const turn = (SIDE_TURN[d.side] + facing.get(cur)! - SIDE_TURN[back.side] + 6) % 4;
        facing.set(d.target, turn as PlanDir);
        queue.push(d.target);
      }
    }
  };
  seed(startRoom);
  // Les morceaux du château qu'aucune porte ne relie à l'entrée (catacombes,
  // oubliettes) s'orientent depuis l'une de leurs salles, prise comme référence.
  for (const id of Object.keys(defs)) if (!facing.has(id)) seed(id);
  return facing;
}

function doorKind(d: RoomDef["doors"][number]): MapDoorKind {
  if (d.exit) return "exit";
  if (d.grille) return "grille";
  if (d.arch) return "arch";
  return "door";
}

/**
 * Sens d'un escalier : marqué sur la porte, ou déduit de la porte d'en face - marquer
 * un seul côté suffit, l'autre descend forcément ce que celui-ci monte.
 */
function stairsDir(
  defs: Record<RoomId, RoomDef>,
  from: RoomId,
  door: RoomDef["doors"][number],
): "up" | "down" | null {
  if (door.stairs) return door.stairs;
  const back = facingDoor(defs, from, door);
  if (!back?.stairs) return null;
  return back.stairs === "up" ? "down" : "up";
}

/** Salle noire au départ : même règle que `Room.isLit` (torches absentes = deux allumées). */
function isDark(def: RoomDef): boolean {
  const torches = def.torches ?? [{ side: "left" as const }, { side: "right" as const }];
  return !torches.some((t) => t.lit !== false);
}

/** Cible d'un trou / d'une dale étoile, si elle existe dans le château. */
function vertical(def: RoomDef, dir: "down" | "up"): RoomId | null {
  const t = dir === "down" ? def.holeTile : def.climbTile;
  return t ? t.target : null;
}

function buildCastleMap(allDefs: Record<RoomId, RoomDef>, startRoom: RoomId): CastleMap {
  // Les oubliettes sortent du plan dès ici : le reste du calcul les ignore, et une
  // porte qui y mènerait est traitée comme la porte de sortie du château.
  const defs: Record<RoomId, RoomDef> = {};
  for (const [id, def] of Object.entries(allDefs)) if (def.oubliette !== true) defs[id] = def;
  const ids = Object.keys(defs);
  const level = new Map<RoomId, number>();

  // ── 1. Orientation de chaque salle ────────────────────────────────────────
  const facing = orientations(defs, startRoom);

  // ── 2. Niveaux ────────────────────────────────────────────────────────────
  /** Propage un niveau de proche en proche : portes = même étage, trou/grimpe = ±1. */
  const spread = (seed: RoomId, lv: number): void => {
    level.set(seed, lv);
    const queue: RoomId[] = [seed];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const l = level.get(cur)!;
      const def = defs[cur];
      const push = (target: RoomId | null, nl: number): void => {
        if (target === null || !defs[target] || level.has(target)) return;
        level.set(target, nl);
        queue.push(target);
      };
      for (const d of def.doors) {
        const stairs = stairsDir(defs, cur, d);
        push(d.target, stairs === "up" ? l + 1 : stairs === "down" ? l - 1 : l);
      }
      push(vertical(def, "down"), l - 1);
      push(vertical(def, "up"), l + 1);
    }
  };
  spread(startRoom, 0);

  // Les passages secrets ne disent rien de l'étage : ils ne servent qu'à rattacher
  // une salle qu'aucune porte ne relie (elle est alors au même niveau que sa source).
  for (let again = true; again; ) {
    again = false;
    for (const id of ids) {
      if (!level.has(id)) continue;
      for (const f of defs[id].fireplaces ?? []) {
        if (f.secret && f.target && defs[f.target] && !level.has(f.target)) {
          spread(f.target, level.get(id)!);
          again = true;
        }
      }
    }
  }

  // Restent les salles qu'absolument rien ne relie : on les met au niveau de l'entrée.
  for (const id of ids) if (!level.has(id)) level.set(id, 0);

  // ── 3. Positions ──────────────────────────────────────────────────────────
  const pos = new Map<RoomId, { x: number; y: number }>();
  const taken = new Map<number, Set<string>>();
  const isFree = (l: number, x: number, y: number): boolean => !taken.get(l)?.has(`${x},${y}`);
  const put = (id: RoomId, x: number, y: number): void => {
    const l = level.get(id)!;
    pos.set(id, { x, y });
    if (!taken.has(l)) taken.set(l, new Set());
    taken.get(l)!.add(`${x},${y}`);
  };
  /** Case libre la plus proche de (x, y) sur ce niveau (anneaux concentriques). */
  const nearestFree = (l: number, x: number, y: number): { x: number; y: number } => {
    for (let ring = 0; ring < 64; ring++) {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          if (!isFree(l, x + dx, y + dy)) continue;
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestD) {
            bestD = d;
            best = { x: x + dx, y: y + dy };
          }
        }
      }
      if (best) return best;
    }
    return { x, y };
  };
  /** Case voulue par la porte `d` de la salle `from`, déjà posée. */
  const wanted = (from: RoomId, d: RoomDef["doors"][number]) => {
    const p = pos.get(from)!;
    const { dx, dy } = DELTA[planDir(d.side, facing.get(from) ?? 0)];
    return { x: p.x + dx, y: p.y + dy };
  };

  /** Nombre de passages à double sens d'une salle : sa « force » de placement. */
  const grip = new Map<RoomId, number>(
    ids.map((id) => [id, defs[id].doors.filter((d) => facingDoor(defs, id, d)).length]),
  );

  /**
   * Pose de proche en proche tout ce qui tient aux salles déjà posées, sur leur case
   * exacte et elle seule : une salle dont la case est prise attend le tour suivant,
   * pour qu'un déplacement de secours ne vienne jamais voler la case d'une salle qui
   * y a droit. `sure` limite la pousse aux portes à double sens (les seules dont la
   * géométrie est certaine) ; le second tour accepte les passages à sens unique.
   *
   * Deux salles peuvent revendiquer la même case (tout château tortueux en a) :
   * `minGrip` fait poser le squelette contraint d'abord et les culs-de-sac en dernier,
   * de sorte qu'une salle à porte unique ne prenne jamais la place d'une salle tenue
   * par ses deux bouts - c'est elle qui se laissera déplacer.
   */
  const sweep = (sure: boolean, minGrip: number): boolean => {
    let placedAny = false;
    for (;;) {
      let placed = false;
      for (const cur of ids) {
        if (!pos.has(cur)) continue;
        const l = level.get(cur)!;
        for (const d of defs[cur].doors) {
          if (!defs[d.target] || pos.has(d.target) || level.get(d.target) !== l) continue;
          if (sure && !facingDoor(defs, cur, d)) continue;
          if ((grip.get(d.target) ?? 0) < minGrip) continue;
          const w = wanted(cur, d);
          if (!isFree(l, w.x, w.y)) continue;
          put(d.target, w.x, w.y);
          placed = placedAny = true;
        }
      }
      if (!placed) return placedAny;
    }
  };

  /** Salles d'un autre étage à poser à l'aplomb : trou, grimpe, escalier. */
  const aboveOrBelow = (id: RoomId): RoomId[] => {
    const out: RoomId[] = [];
    for (const dir of ["down", "up"] as const) {
      const t = vertical(defs[id], dir);
      if (t !== null) out.push(t);
    }
    for (const d of defs[id].doors) if (stairsDir(defs, id, d)) out.push(d.target);
    return out;
  };

  /** Un trou, une grimpe ou un escalier pose la salle d'arrivée à l'aplomb. */
  const seedVertical = (): boolean => {
    for (const id of ids) {
      const p = pos.get(id);
      if (!p) continue;
      for (const target of aboveOrBelow(id)) {
        if (!defs[target] || pos.has(target)) continue;
        const l = level.get(target)!;
        const cell = isFree(l, p.x, p.y) ? { x: p.x, y: p.y } : nearestFree(l, p.x, p.y);
        put(target, cell.x, cell.y);
        return true;
      }
    }
    return false;
  };

  /** Salle dont toutes les cases voulues sont prises : case libre la plus proche. */
  const displaceOne = (): boolean => {
    for (const id of ids) {
      if (pos.has(id)) continue;
      for (const from of ids) {
        if (!pos.has(from) || level.get(from) !== level.get(id)) continue;
        const d = defs[from].doors.find((dd) => dd.target === id);
        if (!d) continue;
        const w = wanted(from, d);
        const cell = nearestFree(level.get(id)!, w.x, w.y);
        put(id, cell.x, cell.y);
        return true;
      }
    }
    return false;
  };

  /** Morceau du château qu'aucun lien ne rattache. */
  const seedIsolated = (): boolean => {
    for (const id of ids) {
      if (pos.has(id)) continue;
      const cell = nearestFree(level.get(id)!, 0, 0);
      put(id, cell.x, cell.y);
      return true;
    }
    return false;
  };

  // L'entrée donne le nord et l'origine du plan ; tout le reste en découle, du plus
  // certain (portes à double sens, salles les plus contraintes) au plus arbitraire
  // (passages à sens unique, puis déplacements, puis composants isolés).
  put(startRoom, 0, 0);
  const maxGrip = Math.max(0, ...grip.values());
  const byGrip = (sure: boolean): boolean => {
    for (let g = maxGrip; g >= 0; g--) if (sweep(sure, g)) return true;
    return false;
  };
  for (let progress = true; progress; ) {
    progress =
      byGrip(true) || seedVertical() || byGrip(false) || displaceOne() || seedIsolated();
  }

  // ── 3. Assemblage ─────────────────────────────────────────────────────────
  const byId = new Map<RoomId, MapRoom>();
  const rooms: MapRoom[] = ids.map((id) => {
    const def = defs[id];
    const p = pos.get(id)!;
    const doors: MapDoor[] = def.doors
      .filter((d) => defs[d.target] || d.exit)
      .map((d) => ({
        dir: planDir(d.side, facing.get(id) ?? 0),
        kind: doorKind(d),
        stairs: stairsDir(defs, id, d),
        target: d.target,
        adjacent: false,
      }));
    const room: MapRoom = {
      id,
      name: def.name,
      level: level.get(id)!,
      gx: p.x,
      gy: p.y,
      facing: facing.get(id) ?? 0,
      doors,
      down: def.holeTile !== undefined,
      // La cheminée est murée dans le mur du fond : sur le plan, elle regarde donc
      // là où regarde la salle.
      fireplace: (def.fireplaces ?? []).length > 0 ? (facing.get(id) ?? 0) : null,
      dark: isDark(def),
      entrance: id === startRoom,
    };
    byId.set(id, room);
    return room;
  });

  // Porte mitoyenne (ouverture dessinée sur le mur commun) ou porte lointaine
  // (trait de liaison) : la distinction se fait ici, une fois tout posé.
  const links: MapLink[] = [];
  const seen = new Set<string>();
  for (const room of rooms) {
    for (const door of room.doors) {
      const to = byId.get(door.target);
      if (!to) continue; // porte de sortie du château
      const { dx, dy } = DELTA[door.dir];
      door.adjacent = to.level === room.level && to.gx === room.gx + dx && to.gy === room.gy + dy;
      if (door.adjacent || to.level !== room.level) continue;
      const key = room.id < to.id ? `${room.id}|${to.id}` : `${to.id}|${room.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ from: room, to });
    }
  }

  const xs = rooms.map((r) => r.gx);
  const ys = rooms.map((r) => r.gy);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    rooms,
    byId,
    levels: [...new Set(rooms.map((r) => r.level))].sort((a, b) => b - a),
    entranceLevel: level.get(startRoom)!,
    links,
    minX,
    minY,
    cols: Math.max(...xs) - minX + 1,
    rows: Math.max(...ys) - minY + 1,
  };
}

/** Le plan ne dépend que des données du château : calculé une fois, puis mémorisé. */
let cached: { defs: Record<RoomId, RoomDef>; map: CastleMap } | null = null;

export function castleMap(defs: Record<RoomId, RoomDef>, startRoom: RoomId): CastleMap {
  if (cached === null || cached.defs !== defs) {
    cached = { defs, map: buildCastleMap(defs, startRoom) };
  }
  return cached.map;
}

/** Intitulé d'un niveau, relatif à celui de l'entrée. */
export function levelLabel(map: CastleMap, level: number): string {
  const n = level - map.entranceLevel;
  if (n === 0) return "Rez-de-chaussée (entrée)";
  if (n > 0) return n === 1 ? "1er étage" : `${n}e étage`;
  return -n === 1 ? "Sous-sol" : `${-n}e sous-sol`;
}
