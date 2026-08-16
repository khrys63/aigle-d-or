import type { ItemKind, RoomId } from "../types";
import type { DoorSide, Lock, Spawn } from "../entities/Door";
import type { ChestContent } from "../entities/Chest";

/**
 * LE FORMAT DE CHÂTEAU - rien d'autre : ce module ne décrit aucune salle, il dit
 * seulement ce qu'une salle peut être. Le château livré est dans `ronceval.ts` ;
 * n'importe quel autre se charge depuis un fichier JSON (`loadCastle.ts`).
 *
 * Gabarit hérité des micro-ordinateurs de 1985 : salles de 16 dalles de large et
 * 2 à 3 de profondeur.
 *
 * Dimensions : `cols`×`rows` (rectangulaire) OU `layout` (forme libre : tableau de
 * chaînes de 16 caractères, une par rangée, de l'AVANT (row 0) vers le FOND ;
 * '.' = sol, '#' = vide). Portes/objets/gardes reperes par leur case (col, row).
 *
 * Conventions de la démo :
 *  - On n'arrive jamais par le bas (avant de scène) : seulement par le fond ou les côtés.
 *  - Le saut franchit 3 cases (on atterrit 4 plus loin).
 *  - La porte du MUR DU FOND est toujours a 2 sauts du mur de gauche => COLONNE 8.
 *  - La sortie par le plafond (ceilingExit) se fait de partout dans la salle (a la corde).
 */

export interface DoorDef {
  col: number;
  row: number;
  side: DoorSide;
  target: RoomId;
  spawn: Spawn;
  lock?: Lock; // serrure : clef en fer / clef en or / pied de biche
  /**
   * Escalier : la porte ne mène pas à la salle d'à côté mais à l'ÉTAGE au-dessus
   * ("up") ou au-dessous ("down") - typiquement les étages d'une tour. Sans effet
   * sur le jeu (on la franchit comme n'importe quelle porte) : cela ne sert qu'au
   * plan (`C`), qui pose alors la salle à l'aplomb, un niveau plus haut ou plus bas.
   * Il suffit de le marquer d'un côté : la porte d'en face en déduit son sens.
   */
  stairs?: "up" | "down";
  exit?: boolean;
  arch?: boolean; // arche : passage sans porte (un pas suffit)
  grille?: boolean; // grille d'acier (barreaux) au lieu d'une porte en bois
  barred?: boolean; // barrée de ce côté : dessinée mais infranchissable
}

export interface ItemDef {
  id: string;
  kind: ItemKind;
  col: number;
  row: number;
  amount?: number; // bourse : quantité d'or (sinon tirée au hasard 75-150)
  text?: string; // parchemin / livre : texte lisible (L)
  pedestal?: boolean; // posé sur un piédestal : ramassable debout
  arrowTrap?: { side: "left" | "right" }; // piège flèche : déclenché au ramassage
  closesHole?: boolean; // au ramassage, referme le trou au sol de la salle
}

/** Décors muraux, purement visuels (d'après les salles du jeu d'origine). */
export type DecorKind =
  | "boulet"     // boulet et sa chaîne pendus au mur
  | "toile"      // toile d'araignée dans l'angle du plafond, au premier plan
  | "colonnes"   // deux grosses colonnes aux angles du mur du fond
  | "piliers"    // six piliers fins sur le mur du fond (cases 1, 4, 7, 10, 13, 16)
  | "aigleNoir"  // écusson à l'aigle noir
  | "croix"      // cadre avec une croix
  | "portrait"   // portrait encadré
  | "ecusson";   // écusson armorié

export interface DecorDef {
  kind: DecorKind;
  /** Colonne du mur porteur (décors muraux : boulet, écussons, cadres, portrait).
   *  La profondeur du mur est déduite du layout (face d'aile ou mur du fond). */
  col?: number;
  /** Position le long d'un mur latéral - uniquement pour side "left"/"right". */
  row?: number;
  /** Mur porteur : "front" = mur du fond (défaut) ; "left"/"right" = mur latéral -
   *  et côté de l'angle pour la toile d'araignée (ignorée si une torche y est). */
  side?: "front" | "left" | "right";
}

export interface ChestDef {
  id: string;
  col: number;
  row: number;
  lock?: Lock; // verrou : objet à tenir en main (pied de biche en démo)
  trap?: boolean; // coffre piégé : l'ouvrir fait chuter en oubliette
  content?: ChestContent; // butin révélé au sol à l'ouverture ; absent => vide
}

export interface GuardDef {
  row: number;
  colMin: number;
  colMax: number;
  col?: number;
  speed?: number;
}

export interface TorchDef {
  side: "left" | "right";
  lit?: boolean;
}

export interface TrapDef {
  col: number;
  row: number;
  marked?: boolean;
}

export interface BatDef {
  row: number;
  col?: number;   // colonne de départ (défaut : centre de la salle)
  speed?: number;
}

export interface GhostDef {
  col: number;
  row: number;
  side: "left" | "right";
  hits?: number; // nombre de renvois nécessaires pour le tuer : 1 (défaut), 2, 4
}

/** Cheminée sur le mur du fond : 3 cases de large (col-1, col, col+1).
 *  Décorative ou passage secret (secret=true : clé en or sur montant gauche). */
export interface FireplaceDef {
  id: string;
  col: number;      // centre (typiquement BACK_DOOR_COL = 8)
  row: number;      // rangée (typiquement rows-1, mur du fond)
  secret?: boolean; // passage caché ; montant gauche = cercle plein
  target?: RoomId;  // salle cible (passage secret)
  spawn?: Spawn;    // point d'arrivée dans la salle cible
}

/** Squelette allongé au sol : 3 cases de large (col-1, col, col+1), infranchissable
 *  à pied (mais le saut de 4 cases l'enjambe). Purement décoratif par ailleurs. */
export interface SkeletonDef {
  col: number;   // centre
  row: number;
  flip?: boolean; // crâne à droite au lieu de gauche
}

/** Meubles au sol du jeu d'origine : posés n'importe où dans une salle,
 *  NON traversables à pied - mais le saut (4 cases) les enjambe. */
export type FurnitureKind = "chaise" | "porteManteau" | "statue" | "table";

/** Largeur de chaque meuble, en dalles. */
export const FURNITURE_W: Record<FurnitureKind, number> = {
  chaise: 2, porteManteau: 1, statue: 2, table: 3,
};

export interface FurnitureDef {
  kind: FurnitureKind;
  /** Dalle de GAUCHE : le meuble occupe col .. col+largeur-1 sur la rangée. */
  col: number;
  row: number;
}

/** Piège à herse : une case déclencheuse + la position de la herse qui tombe. */
export interface HerseDef {
  triggerCol: number;
  triggerRow: number;
  /** Case d'atterrissage de la herse (identifie le mur bloqué). */
  herseCol: number;
  herseRow: number;
  /** Côté du mur : "front" = bord loin de la case, "back" = bord proche. */
  herseSide: DoorSide;
  /** Points au sol visibles sur la case d'atterrissage, alignés sur la chute. */
  marked?: boolean;
  /**
   * Herse latérale : nombre de rangées couvertes à partir de `herseRow`
   * (défaut : toute la profondeur de la salle).
   */
  herseRows?: number;
}

/** Salle par défaut : 16×3, sans objets ni gardes, deux torches allumées.
 *  On n'écrit dans chaque salle que ce qui s'en écarte. */
export interface RoomDef {
  id: RoomId;
  name: string;
  cols?: number;  // défaut : 16
  rows?: number;  // défaut : 3
  layout?: string[];
  /** Salle cylindrique (tour) : murs du fond rendus en voûte arrondie. */
  round?: boolean;
  doors: DoorDef[];
  items?: ItemDef[];   // défaut : aucun
  guards?: GuardDef[]; // défaut : aucun
  chests?: ChestDef[];
  /** Défaut : une torche allumée de chaque côté ; `[]` = salle sombre. */
  torches?: TorchDef[];
  traps?: TrapDef[];
  herses?: HerseDef[];
  /** Décors muraux (sans interaction). */
  decors?: DecorDef[];
  /** Meubles au sol (obstacles : infranchissables à pied, enjambables d'un saut). */
  furnitures?: FurnitureDef[];
  /** Squelettes au sol : obstacles de 3 cases, à enjamber d'un saut. */
  skeletons?: SkeletonDef[];
  fireplaces?: FireplaceDef[];
  oubliette?: boolean;
  /** Sortie par le plafond (a la corde, plus tard) : utilisable de partout dans la salle. */
  ceilingExit?: boolean;
  /** Dale étoile (*) : G + corde fait monter (vers target, en arrivant à spawn). */
  climbTile?: { col: number; row: number; target: RoomId; spawn: Spawn };
  /** Trou rond au sol : marcher dessus fait descendre au niveau inférieur (target, spawn = dale étoile).
   *  Avec une corde = indolore ; sans corde = dégâts + saignement. */
  holeTile?: { col: number; row: number; target: RoomId; spawn: Spawn };
  /** Donjon (niveau supérieur) : piège sans porte ; seule issue = cheminée secrète (clef en or). */
  donjon?: boolean;
  /** Chauves-souris : vol horizontal au plafond, piquent si le joueur passe dessous sans s'accroupir ni avoir une fiole. */
  bats?: BatDef[];
  /** Fantômes : fixes, lévitent, lancent des éclairs en ligne ; crucifix en main au bon moment = renvoi. */
  ghosts?: GhostDef[];
}

export const OUBLIETTE_ROOM: RoomId = "oubliette";

/**
 * Un château complet : ses salles et les trois repères dont le jeu a besoin pour
 * s'y lancer. Le jeu en embarque un (`RONCEVAL_CASTLE`) mais n'y est pas tenu :
 * l'éditeur (`dist/editor.html`) en produit d'autres, chargés depuis un fichier
 * JSON par l'écran de sélection (`world/loadCastle.ts`).
 */
export interface CastleDef {
  rooms: Record<RoomId, RoomDef>;
  /** Salle où l'on entre. */
  start: RoomId;
  /** Case d'arrivée dans la salle de départ. */
  spawn: Spawn;
  /** Salle où l'on tombe : toute dalle piégée y mène. */
  oubliette: RoomId;
}

