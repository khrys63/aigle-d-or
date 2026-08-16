import { HORIZON_Y, NEAR_BOT, NEAR_HALF_W, NEAR_TOP, VP_X } from "../config";

/**
 * Projection en perspective à un point de fuite (point de fuite = (VP_X, HORIZON_Y)).
 *
 * Le monde est un plan-sol : x ∈ [-1, 1] (gauche→droite), z ∈ [0, 1] (proche→loin).
 * Tout converge vers le point de fuite à mesure que z augmente. C'est la base du
 * rendu « couloir en perspective » fidèle à L'Aigle d'Or.
 */

export interface Pt {
  x: number;
  y: number;
}

const HALF_TOP = HORIZON_Y - NEAR_TOP; // hauteur visible au-dessus du fuyant
const HALF_BOT = NEAR_BOT - HORIZON_Y; // hauteur visible en-dessous du fuyant

/**
 * Échelle : œil à 240 (px d'époque, front de scène 640), chaque rangée fait
 * exactement 50 px de profondeur - la grille est donc IDENTIQUE d'une salle à
 * l'autre (pas de « saut » des dalles en passant une porte). Le mur du fond est
 * à 50·cases : 3 cases = 240/390 = 0.615, quasiment l'échelle d'époque (0.6).
 * (L'époque calait le fond à 40·(cases+1), soit 0.6/0.667, mais au prix de
 * rangées étirées différemment selon la salle.)
 */
const EYE_DIST = 240;
let depthRows = 3;

/** À appeler au début du rendu d'une salle : sa profondeur (en cases) règle la perspective. */
export function setRoomDepth(rows: number): void {
  depthRows = rows;
}

/** Facteur d'échelle à la profondeur z (1 au plus près, E/(E+profondeur) au fond). */
export function scaleAt(z: number): number {
  return EYE_DIST / (EYE_DIST + z * roomDepthPx());
}

/**
 * Profondeur de la salle courante en px d'époque : z ∈ [0,1] couvre cette distance,
 * alors que x ∈ [-1,1] couvre 2·NEAR_HALF_W. Sert à mesurer une longueur dans le
 * plan-sol (arc d'une tour ronde) sans déformer le rapport x/z.
 */
export function roomDepthPx(): number {
  return 50 * depthRows;
}

/** Projette un point au sol (h=0) à la position (x, z). */
export function floorPoint(x: number, z: number): Pt {
  const s = scaleAt(z);
  return { x: VP_X + x * NEAR_HALF_W * s, y: HORIZON_Y + HALF_BOT * s };
}

/** Projette un point au plafond (h=1) à la position (x, z). */
export function ceilPoint(x: number, z: number): Pt {
  const s = scaleAt(z);
  return { x: VP_X + x * NEAR_HALF_W * s, y: HORIZON_Y - HALF_TOP * s };
}

/**
 * Projette un point sur un mur à (x, z), à la hauteur h ∈ [0,1]
 * (0 = sol, 1 = plafond). Sert à dessiner portes et panneaux muraux.
 */
export function wallPoint(x: number, z: number, h: number): Pt {
  const s = scaleAt(z);
  const yFloor = HORIZON_Y + HALF_BOT * s;
  const yCeil = HORIZON_Y - HALF_TOP * s;
  return { x: VP_X + x * NEAR_HALF_W * s, y: yFloor + (yCeil - yFloor) * h };
}
