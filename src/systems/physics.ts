import type { Dir } from "../types";
import { JUMP_TIME, LEAP_CROUCH_TIME, LEAP_LAND_TIME, LEAP_RISE_TIME, LEAP_STEPS, LEAP_TIME, STEP_TIME, TURN_GRACE } from "../config";
import type { Player } from "../entities/Player";
import type { Input } from "../engine/Input";
import type { Room } from "../world/Room";
import { colToX, rowToZ } from "../world/grid";

/** Vecteur de grille (colonne, rangée) d'une direction. */
const DELTA: Record<Dir, [number, number]> = {
  right: [1, 0],
  left: [-1, 0],
  back: [0, 1], // vers le fond
  front: [0, -1], // vers la caméra
};

/** Direction maintenue (flèches uniquement ; les lettres sont des actions). */
function heldDir(input: Input): Dir | null {
  if (input.isDown("ArrowRight")) return "right";
  if (input.isDown("ArrowLeft")) return "left";
  if (input.isDown("ArrowUp")) return "back";
  if (input.isDown("ArrowDown")) return "front";
  return null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t * t * (3 - 2 * t);

/** Démarre l'animation d'un déplacement vers la case (col, row). */
function startStep(p: Player, room: Room, col: number, row: number, leap: boolean): void {
  p.fromX = p.x;
  p.fromZ = p.z;
  p.col = col;
  p.row = row;
  p.toX = colToX(col, room.cols);
  p.toZ = rowToZ(row, room.rows);
  p.animT = 0;
  p.animDur = leap ? LEAP_TIME : STEP_TIME;
  p.hopArc = leap;
  p.animating = true;
}

/**
 * Démarre un saut directionnel décomposé : on fixe d'abord la case d'arrivée puis on
 * entre en phase d'élan accroupi. Le vol (déplacement réel) ne démarre qu'ensuite,
 * piloté par advanceLeap().
 */
function startLeap(p: Player, room: Room, col: number, row: number): void {
  p.col = col;
  p.row = row;
  p.toX = colToX(col, room.cols);
  p.toZ = rowToZ(row, room.rows);
  p.leapStage = "crouch";
  p.leapTimer = LEAP_CROUCH_TIME;
  p.crouching = true;
  p.animating = false;
  p.hop = 0;
}

/** Fait avancer la machine d'état du saut directionnel d'un pas de temps `dt`. */
function advanceLeap(p: Player, dt: number): void {
  p.leapTimer -= dt;
  if (p.leapStage === "crouch") {
    p.crouching = true; // maintien de l'élan accroupi
    if (p.leapTimer <= 0) {
      // Décollage : on lance le vol (déplacement + arc).
      p.fromX = p.x;
      p.fromZ = p.z;
      p.animT = 0;
      p.animDur = LEAP_TIME;
      p.hopArc = true;
      p.animating = true;
      p.crouching = false;
      p.leapStage = "air";
    }
    return;
  }
  if (p.leapStage === "air") {
    p.animT += dt / p.animDur;
    let t = p.animT;
    if (t >= 1) {
      t = 1;
      p.animating = false;
    }
    const e = easeInOut(t);
    p.x = lerp(p.fromX, p.toX, e);
    p.z = lerp(p.fromZ, p.toZ, e);
    p.hop = Math.sin(Math.PI * t);
    if (!p.animating) {
      // Réception : on retombe accroupi.
      p.hop = 0;
      p.crouching = true;
      p.leapStage = "land";
      p.leapTimer = LEAP_LAND_TIME;
    }
    return;
  }
  if (p.leapStage === "land") {
    p.crouching = true;
    if (p.leapTimer <= 0) {
      p.leapStage = "rise";
      p.leapTimer = LEAP_RISE_TIME;
    }
    return;
  }
  // "rise" : on se relève, puis fin de la séquence.
  p.crouching = false;
  if (p.leapTimer <= 0) p.leapStage = "none";
}

/** Tente un pas dans `dir` : marche si la case est libre, sinon arme blockedDir (arche/mur). */
function tryStep(p: Player, room: Room, dir: Dir): void {
  const [dc, dr] = DELTA[dir];
  const tc = p.col + dc;
  const tr = p.row + dr;
  if (room.isWalkable(tc, tr) && !room.isGhostAt(tc, tr) && !room.isSkeletonAt(tc, tr) && !room.isFurnitureAt(tc, tr)) {
    if (room.isHerseBlocking(p.col, p.row, tc, tr)) p.blockedDir = dir;
    else startStep(p, room, tc, tr, false);
  } else p.blockedDir = dir; // pas vers un mur/bord/fantôme/squelette/meuble : peut être une arche
}

/** Saut sur place (sans changer de case) - utile plus tard pour torches/crucifix. */
export function jumpInPlace(p: Player): void {
  p.fromX = p.toX = p.x;
  p.fromZ = p.toZ = p.z;
  p.animT = 0;
  p.animDur = JUMP_TIME;
  p.hopArc = true;
  p.animating = true;
}

/**
 * Déplacement « à la 1984 » sur la grille :
 * - Une flèche dans une direction qu'on ne regarde pas => on PIVOTE (sans bouger).
 * - Une flèche dans la direction regardée => un PAS dans cette direction.
 * - S => SAUT de LEAP_STEPS cases dans la direction regardée. Non raccourci : si la
 *   case d'arrivée n'existe pas / n'est pas praticable, le saut ne se fait pas (et on
 *   n'avance pas pour autant).
 * L'entrée n'est lue qu'à l'arrêt et hors accroupissement.
 */
export function stepPlayer(p: Player, room: Room, input: Input, dt: number): void {
  p.blockedDir = null;
  if (p.turnGrace > 0) p.turnGrace = Math.max(0, p.turnGrace - dt);

  // Saut directionnel en cours : la séquence accroupi→vol→réception→relève consomme
  // toute l'entrée (le héros est injouable le temps du bond).
  if (p.leapStage !== "none") {
    advanceLeap(p, dt);
    return;
  }

  if (p.animating) {
    p.animT += dt / p.animDur;
    let t = p.animT;
    if (t >= 1) {
      t = 1;
      p.animating = false;
    }
    const e = easeInOut(t);
    p.x = lerp(p.fromX, p.toX, e);
    p.z = lerp(p.fromZ, p.toZ, e);
    p.hop = p.hopArc ? Math.sin(Math.PI * t) : 0;
    if (!p.animating) p.hop = 0;
    return;
  }

  // Juste après une transition : on ne bouge/pivote pas (on garde le dos à la porte).
  if (p.moveLock > 0) {
    p.moveLock = Math.max(0, p.moveLock - dt);
    return;
  }

  // Accroupi : on peut pivoter (en restant accroupi) ; un pas dans la direction
  // déjà regardée relève le héros et le fait avancer.
  if (p.crouching) {
    const dir = heldDir(input);
    if (!dir) return; // immobile tant qu'on reste accroupi sans direction
    // Direction différente : on PIVOTE en restant accroupi (et on arme l'anti-tap).
    if (p.facing !== dir) {
      p.facing = dir;
      p.turnGrace = TURN_GRACE;
      return;
    }
    // On regarde déjà dans cette direction : on attend la fin du délai, puis on
    // se relève et on avance d'un pas.
    if (p.turnGrace > 0) return;
    p.crouching = false;
    tryStep(p, room, dir);
    return;
  }

  // Saut directionnel (S) : dans la direction regardée, sans raccourci.
  if (input.wasChar("s")) {
    const [dc, dr] = DELTA[p.facing];
    const tc = p.col + dc * LEAP_STEPS;
    const tr = p.row + dr * LEAP_STEPS;
    // Un squelette ou un meuble sous la trajectoire s'enjambe ; seule la case d'ARRIVÉE doit être libre.
    if (room.isWalkable(tc, tr) && !room.isGhostAt(tc, tr) && !room.isSkeletonAt(tc, tr) && !room.isFurnitureAt(tc, tr)) {
      // Vérifie qu'aucune herse ne barre une étape intermédiaire du saut.
      let blocked = false;
      for (let step = 1; step <= LEAP_STEPS; step++) {
        if (room.isHerseBlocking(p.col + dc * (step - 1), p.row + dr * (step - 1), p.col + dc * step, p.row + dr * step)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) startLeap(p, room, tc, tr);
    }
    return;
  }

  const dir = heldDir(input);
  if (!dir) return;

  // Direction differente : on PIVOTE (sans avancer) et on arme le delai anti-tap.
  if (p.facing !== dir) {
    p.facing = dir;
    p.turnGrace = TURN_GRACE;
    return;
  }

  // On regarde deja dans cette direction : on attend la fin du delai (un tap ne fait que tourner),
  // puis on avance en continu tant que la touche reste maintenue.
  if (p.turnGrace > 0) return;
  tryStep(p, room, dir);
}
