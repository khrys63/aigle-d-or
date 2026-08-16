/** Types partagés dans tout le jeu. */

export interface Vec2 {
  x: number;
  y: number;
}

/** Position sur le plan-sol : x ∈ [-1,1] (gauche→droite), z ∈ [0,1] (proche→loin). */
export interface FloorPos {
  x: number;
  z: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RoomId = string;

/** Objets que l'on peut tenir EN MAIN (sélection par les touches 1..7). */
export type HeldItem = "torch" | "crucifix" | "crowbar" | "ironKey" | "goldKey" | "vial" | "sword";

/** Objets de l'inventaire non tenables en main (corde, aigle de plomb, bague, carte). */
export type InventoryItem = HeldItem | "rope" | "leadEagle" | "ring" | "map";

/** Objets-trophées de la quête (les trois). */
export type QuestItem = "eagle" | "diamond" | "book";

/** Nature d'un objet ramassable / lisible au sol. */
export type ItemKind = InventoryItem | "treasure" | "purse" | "poison" | "parchment" | QuestItem;

/** Orientation du héros : il ne se déplace que dans la direction qu'il regarde. */
export type Dir = "right" | "left" | "back" | "front";

/** États de la machine à états du jeu. */
export type GameStateName = "title" | "select" | "shop" | "playing" | "win" | "gameover";
