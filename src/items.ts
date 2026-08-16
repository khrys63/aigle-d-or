import type { HeldItem, InventoryItem, ItemKind } from "./types";

/** Objets tenables en main dans l'ordre des touches 1..7 (la corde n'en fait pas partie). */
export const HELD_KEYS: HeldItem[] = ["torch", "crucifix", "crowbar", "ironKey", "goldKey", "vial", "sword"];

/** Nom affiché de chaque objet d'inventaire. */
export const HELD_NAME: Record<InventoryItem, string> = {
  torch: "Torche",
  crucifix: "Crucifix",
  crowbar: "Pied de biche",
  ironKey: "Clef en fer",
  goldKey: "Clef en or",
  vial: "Fiole",
  sword: "Epée",
  rope: "Corde",
  leadEagle: "Aigle de plomb",
  ring: "Bague",
  map: "Carte du chateau",
};

/** Inventaire vide (un compteur par objet ; tous les objets ont un nombre). */
export function emptyInventory(): Record<InventoryItem, number> {
  return {
    torch: 0, crucifix: 0, crowbar: 0, ironKey: 0, goldKey: 0, vial: 0, sword: 0,
    rope: 0, leadEagle: 0, ring: 0, map: 0,
  };
}

/** Points gagnés au ramassage de chaque objet (objets absents : 0 point). */
export const SCORE: Partial<Record<ItemKind, number>> = {
  ironKey: 70, 
  purse: 30,
  vial: 30,
  poison: 5,
  ring: 10,
  goldKey: 200,
  leadEagle: 100,
  parchment: 100,
  crucifix: 200,
  diamond: 500,
  book: 1000,
  eagle: 5000,
};

/** Articles vendus à la boutique (touches 1..4). */
export const SHOP: { item: InventoryItem; price: number }[] = [
  { item: "vial", price: 250 },
  { item: "torch", price: 170 },
  { item: "rope", price: 110 },
  { item: "crowbar", price: 250 },
];
