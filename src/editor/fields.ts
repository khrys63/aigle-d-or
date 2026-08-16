/**
 * Description déclarative des champs de chaque type du format.
 *
 * L'inspecteur ne connaît aucun type en particulier : il lit ces tables et engendre
 * le formulaire. Ajouter un champ au format, c'est ajouter une ligne ici - pas un
 * quatorzième formulaire écrit à la main.
 *
 * Les clés acceptent un chemin pointé (`spawn.col`, `arrowTrap.side`, `content.kind`) :
 * `setPath` crée les objets intermédiaires, et efface un champ optionnel laissé vide
 * plutôt que d'écrire `false` ou `""` - le fichier exporté ne dit que ce qui s'écarte
 * du défaut, comme `rooms.ts`.
 */

import type { ListKey } from "./store";

export interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "checkbox" | "select";
  /** Options d'un `select` ; la valeur "" signifie « champ absent ». */
  options?: readonly { value: string; label: string }[];
  /** Liste des salles du château, injectée au moment du rendu. */
  rooms?: boolean;
  /**
   * Champ facultatif : vidé, il est EFFACÉ de la donnée plutôt que mis à `false`,
   * `0` ou `""`. C'est ce qui garde le fichier au style de `rooms.ts` - on n'écrit
   * que ce qui s'écarte du défaut. Un champ requis vidé revient à sa valeur.
   */
  opt?: boolean;
}

const opts = (...values: string[]) => values.map((v) => ({ value: v, label: v || "—" }));

const ITEM_KINDS = opts(
  "treasure", "purse", "parchment", "poison", "ring",
  "torch", "crucifix", "crowbar", "ironKey", "goldKey", "vial", "sword",
  "rope", "leadEagle", "map",
  "eagle", "diamond", "book",
);
const SIDES = opts("front", "back", "left", "right");
const LOCKS = opts("", "ironKey", "crowbar");
const STAIRS = opts("", "up", "down");
const LEFT_RIGHT = opts("left", "right");
const OPT_LEFT_RIGHT = opts("", "left", "right");
const DECOR_KINDS = opts("boulet", "toile", "colonnes", "piliers", "aigleNoir", "croix", "portrait", "ecusson");
const FURNITURE_KINDS = opts("chaise", "porteManteau", "statue", "table");

const COL_ROW: Field[] = [
  { key: "col", label: "Colonne", type: "number" },
  { key: "row", label: "Rangée", type: "number" },
];

const SPAWN: Field[] = [
  { key: "spawn.col", label: "Arrivée col.", type: "number" },
  { key: "spawn.row", label: "Arrivée rang.", type: "number" },
];

/** Champs par type d'élément. */
export const FIELDS: Record<ListKey | "climbTile" | "holeTile", Field[]> = {
  doors: [
    ...COL_ROW,
    { key: "side", label: "Mur", type: "select", options: SIDES },
    { key: "target", label: "Vers", type: "select", rooms: true },
    ...SPAWN,
    { key: "lock", label: "Serrure", type: "select", options: LOCKS, opt: true },
    { key: "stairs", label: "Escalier", type: "select", options: STAIRS, opt: true },
    { key: "arch", label: "Arche", type: "checkbox", opt: true },
    { key: "grille", label: "Grille", type: "checkbox", opt: true },
    { key: "barred", label: "Barrée", type: "checkbox", opt: true },
    { key: "exit", label: "Sortie", type: "checkbox", opt: true },
  ],
  items: [
    { key: "id", label: "Identifiant", type: "text" },
    { key: "kind", label: "Nature", type: "select", options: ITEM_KINDS },
    ...COL_ROW,
    { key: "amount", label: "Or (bourse)", type: "number", opt: true },
    { key: "text", label: "Texte lu", type: "text", opt: true },
    { key: "pedestal", label: "Piédestal", type: "checkbox", opt: true },
    { key: "closesHole", label: "Referme le trou", type: "checkbox", opt: true },
    { key: "arrowTrap.side", label: "Flèche-piège", type: "select", options: OPT_LEFT_RIGHT, opt: true },
  ],
  guards: [
    { key: "row", label: "Rangée", type: "number" },
    { key: "colMin", label: "Ronde de", type: "number" },
    { key: "colMax", label: "Ronde à", type: "number" },
    { key: "col", label: "Départ col.", type: "number", opt: true },
    { key: "speed", label: "Vitesse", type: "number", opt: true },
  ],
  chests: [
    { key: "id", label: "Identifiant", type: "text" },
    ...COL_ROW,
    { key: "lock", label: "Serrure", type: "select", options: LOCKS, opt: true },
    { key: "trap", label: "Piégé", type: "checkbox", opt: true },
    { key: "content.kind", label: "Contient", type: "select", options: [{ value: "", label: "— vide —" }, ...ITEM_KINDS], opt: true },
    { key: "content.amount", label: "Or", type: "number", opt: true },
    { key: "content.text", label: "Texte", type: "text", opt: true },
  ],
  torches: [
    { key: "side", label: "Côté", type: "select", options: LEFT_RIGHT },
    // Pas `opt` : c'est le seul booléen du format dont le DÉFAUT est `true`
    // (`t.lit ?? true`). Effacer la clé rallumerait la torche au lieu de
    // l'éteindre - il faut écrire `false` noir sur blanc.
    { key: "lit", label: "Allumée", type: "checkbox" },
  ],
  traps: [...COL_ROW, { key: "marked", label: "Visible au sol", type: "checkbox", opt: true }],
  herses: [
    { key: "triggerCol", label: "Déclench. col.", type: "number" },
    { key: "triggerRow", label: "Déclench. rang.", type: "number" },
    { key: "herseCol", label: "Chute col.", type: "number" },
    { key: "herseRow", label: "Chute rang.", type: "number" },
    { key: "herseSide", label: "Mur bloqué", type: "select", options: SIDES },
    { key: "herseRows", label: "Rangées", type: "number", opt: true },
    { key: "marked", label: "Visible au sol", type: "checkbox", opt: true },
  ],
  decors: [
    { key: "kind", label: "Nature", type: "select", options: DECOR_KINDS },
    { key: "col", label: "Colonne", type: "number", opt: true },
    { key: "row", label: "Rangée", type: "number", opt: true },
    { key: "side", label: "Mur", type: "select", options: opts("", "front", "left", "right"), opt: true },
  ],
  furnitures: [
    { key: "kind", label: "Nature", type: "select", options: FURNITURE_KINDS },
    ...COL_ROW,
  ],
  skeletons: [...COL_ROW, { key: "flip", label: "Crâne à droite", type: "checkbox", opt: true }],
  fireplaces: [
    { key: "id", label: "Identifiant", type: "text" },
    ...COL_ROW,
    { key: "secret", label: "Passage secret", type: "checkbox", opt: true },
    { key: "target", label: "Vers", type: "select", rooms: true, opt: true },
    { key: "spawn.col", label: "Arrivée col.", type: "number", opt: true },
    { key: "spawn.row", label: "Arrivée rang.", type: "number", opt: true },
  ],
  bats: [
    { key: "row", label: "Rangée", type: "number" },
    { key: "col", label: "Départ col.", type: "number", opt: true },
    { key: "speed", label: "Vitesse", type: "number", opt: true },
  ],
  ghosts: [
    ...COL_ROW,
    { key: "side", label: "Côté", type: "select", options: LEFT_RIGHT },
    { key: "hits", label: "Renvois requis", type: "number", opt: true },
  ],
  climbTile: [...COL_ROW, { key: "target", label: "Monte vers", type: "select", rooms: true }, ...SPAWN],
  holeTile: [...COL_ROW, { key: "target", label: "Descend vers", type: "select", rooms: true }, ...SPAWN],
};

/** Nom lisible de chaque famille d'éléments. */
export const LIST_NAME: Record<ListKey | "climbTile" | "holeTile", string> = {
  doors: "Porte", items: "Objet", guards: "Garde", chests: "Coffre", torches: "Torche",
  traps: "Dalle piégée", herses: "Herse", decors: "Décor mural", furnitures: "Meuble",
  skeletons: "Squelette", fireplaces: "Cheminée", bats: "Chauve-souris", ghosts: "Fantôme",
  climbTile: "Dalle étoile", holeTile: "Trou au sol",
};

export function getPath(target: any, path: string): unknown {
  return path.split(".").reduce((o, key) => (o == null ? undefined : o[key]), target);
}

/** Écrit une valeur ; `undefined` efface la clé (et l'objet parent devenu vide). */
export function setPath(target: any, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  let node = target;
  for (const key of keys) {
    if (value === undefined && node[key] == null) return;
    node = node[key] ??= {};
  }
  if (value === undefined) {
    delete node[last];
    // `arrowTrap: {}` ou `content: {}` n'aurait aucun sens dans le fichier.
    if (keys.length && !Object.keys(node).length) delete target[keys[0]];
  } else {
    node[last] = value;
  }
}
