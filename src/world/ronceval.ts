/**
 * LE DONJON DE RONCEVAL - le château livré avec le jeu.
 *
 * Château original, écrit pour ce dépôt : il n'emprunte rien au plan de 1984. Son
 * rôle est double - donner une partie complète à qui ouvre `dist/index.html`, et
 * servir de démonstration exhaustive du format décrit dans `world/rooms.ts` : on y
 * trouve au moins une fois chaque élément que l'éditeur sait poser (serrures,
 * arches, grilles, escaliers, cheminée à passage secret, dalle étoile et trou,
 * herse, oubliette, gardes, chauves-souris, fantômes, meubles, squelettes).
 *
 * Le château de L'AIGLE D'OR (Loriciels, 1984) n'est PAS dans ce dépôt : son plan
 * est l'œuvre de Louis-Marie Rocques, pas la nôtre. Qui veut le rejouer le
 * reconstruit dans l'éditeur (`dist/editor.html`) et le charge depuis l'écran de
 * sélection (touche 3) - voir le NOTICE et la section « Jouer un autre château »
 * du README.
 *
 * 13 salles sur quatre niveaux : sous-sol (cave, souterrain, puits),
 * rez-de-chaussée (entrée, corps de garde, cuisines, galerie, armurerie,
 * chapelle, crypte), puis les deux étages de la tour. L'oubliette est hors plan :
 * on y tombe, on n'y entre pas.
 */

import type { RoomId } from "../types";
import type { CastleDef, RoomDef } from "./rooms";
import { OUBLIETTE_ROOM } from "./rooms";

/** Salle où l'on entre : la porte du fond donne sur la lande. */
export const RONCEVAL_START_ROOM: RoomId = "entree";
export const RONCEVAL_START_SPAWN = { col: 8, row: 2 };

/** Deux rangées au lieu de trois : couloirs, crypte, puits. */
const TWO_ROWS = ["................", "................"];

export const RONCEVAL_ROOMS: Record<RoomId, RoomDef> = {
  // ── Oubliette ───────────────────────────────────────────────────────────────
  // Aucune porte : toute dalle piégée du château y mène. Seule issue, le plafond,
  // à la corde - celle du malheureux qui a fait le voyage avant vous.
  oubliette: {
    id: "oubliette",
    name: "Oubliette",
    layout: TWO_ROWS,
    torches: [],
    doors: [],
    oubliette: true,
    ceilingExit: true,
    skeletons: [{ col: 3, row: 1 }],
    items: [{ id: "it-oubliette-corde", kind: "rope", col: 12, row: 0 }],
  },

  // ── Rez-de-chaussée ─────────────────────────────────────────────────────────
  entree: {
    id: "entree",
    name: "Entree du donjon",
    doors: [
      { col: 8, row: 2, side: "front", target: "__exit__", spawn: { col: 8, row: 0 }, exit: true },
      { col: 0, row: 0, side: "left", target: "gardes", spawn: { col: 15, row: 0 }, arch: true },
      { col: 15, row: 0, side: "right", target: "galerie", spawn: { col: 0, row: 0 }, arch: true },
    ],
    decors: [
      { kind: "ecusson", col: 4 },
      { kind: "aigleNoir", col: 12 },
    ],
    // Le vestiaire du visiteur : de quoi forcer un coffre et tenir un fantôme à
    // distance, ramassable avant d'avoir croisé quoi que ce soit. Sans cela, le
    // pied-de-biche était un achat obligé et le premier fantôme, une embuscade.
    items: [
      { id: "it-entree-bourse", kind: "purse", col: 3, row: 1, amount: 120 },
      { id: "it-entree-pince", kind: "crowbar", col: 6, row: 1 },
      { id: "it-entree-crucifix", kind: "crucifix", col: 10, row: 1 },
    ],
  },

  gardes: {
    id: "gardes",
    name: "Corps de garde",
    doors: [
      { col: 15, row: 0, side: "right", target: "entree", spawn: { col: 0, row: 0 }, arch: true },
      { col: 8, row: 2, side: "front", target: "cuisine", spawn: { col: 8, row: 2 } },
    ],
    // Ronde courte et lente : on passe en longeant un mur, sans avoir à combattre.
    guards: [{ row: 1, colMin: 5, colMax: 11, speed: 0.9 }],
    furnitures: [
      { kind: "table", col: 2, row: 2 },
    ],
    // Premier coffre du château : il apprend le geste (pied-de-biche en main, `O`)
    // avec l'outil ramassé à l'entrée, et rend la clef qui ouvre la cave.
    chests: [{ id: "ch-gardes", col: 12, row: 2, lock: "crowbar", content: { kind: "ironKey" } }],
    decors: [{ kind: "boulet", col: 4 }],
  },

  cuisine: {
    id: "cuisine",
    name: "Cuisines",
    doors: [{ col: 8, row: 2, side: "front", target: "gardes", spawn: { col: 8, row: 2 } }],
    // Passage secret : la cheminée ne s'ouvre qu'avec la clef en or, trouvée en crypte.
    fireplaces: [
      { id: "fp-cuisine", col: 12, row: 2, secret: true, target: "cave", spawn: { col: 4, row: 2 } },
    ],
    furnitures: [
      { kind: "table", col: 1, row: 1 },
      { kind: "porteManteau", col: 14, row: 0 },
    ],
    items: [{ id: "it-cuisine-fiole", kind: "vial", col: 5, row: 1 }],
    bats: [{ row: 0, speed: 1.0 }],
    decors: [{ kind: "toile", side: "left" }],
  },

  galerie: {
    id: "galerie",
    name: "Galerie des portraits",
    doors: [
      { col: 0, row: 0, side: "left", target: "entree", spawn: { col: 15, row: 0 }, arch: true },
      { col: 15, row: 0, side: "right", target: "armurerie", spawn: { col: 0, row: 0 } },
      { col: 8, row: 2, side: "front", target: "chapelle", spawn: { col: 8, row: 2 } },
    ],
    decors: [
      { kind: "portrait", col: 3 },
      { kind: "portrait", col: 12 },
    ],
    // La carte est un objet à trouver, pas un acquis : sans elle, on dessine son
    // plan à la main.
    items: [{ id: "it-galerie-carte", kind: "map", col: 4, row: 1, pedestal: true }],
  },

  armurerie: {
    id: "armurerie",
    name: "Armurerie",
    doors: [
      { col: 0, row: 0, side: "left", target: "galerie", spawn: { col: 15, row: 0 } },
      {
        col: 8, row: 2, side: "front", target: "cave",
        spawn: { col: 8, row: 2 }, stairs: "down", lock: "ironKey",
      },
    ],
    items: [
      { id: "it-armurerie-corde", kind: "rope", col: 3, row: 1 },
      { id: "it-armurerie-epee", kind: "sword", col: 11, row: 0 },
    ],
    holeTile: { col: 12, row: 1, target: "cave", spawn: { col: 12, row: 1 } },
    skeletons: [{ col: 4, row: 2 }],
    furnitures: [{ kind: "statue", col: 13, row: 2 }],
  },

  chapelle: {
    id: "chapelle",
    name: "Chapelle",
    doors: [
      { col: 8, row: 2, side: "front", target: "galerie", spawn: { col: 8, row: 2 } },
      { col: 0, row: 0, side: "left", target: "crypte", spawn: { col: 15, row: 0 }, grille: true },
    ],
    torches: [{ side: "right", lit: true }],
    items: [
      {
        id: "it-chapelle-livre", kind: "book", col: 8, row: 1, pedestal: true,
        text: "Ce que la tour garde, la cave le rend.",
      },
      { id: "it-chapelle-fiole", kind: "vial", col: 13, row: 1 },
    ],
    traps: [{ col: 5, row: 0, marked: true }],
    decors: [{ kind: "colonnes" }, { kind: "croix", col: 8 }],
  },

  crypte: {
    id: "crypte",
    name: "Crypte",
    layout: TWO_ROWS,
    // Une torche allumée : la crypte est sur le chemin de la tour, on n'y avance
    // pas à l'aveugle. L'autre reste éteinte - le format le permet, et on la
    // rallume avec une torche en main (`D`).
    torches: [{ side: "left", lit: true }, { side: "right", lit: false }],
    doors: [
      { col: 15, row: 0, side: "right", target: "chapelle", spawn: { col: 0, row: 0 }, grille: true },
      { col: 8, row: 1, side: "front", target: "tour-basse", spawn: { col: 8, row: 2 }, stairs: "up" },
    ],
    skeletons: [{ col: 3, row: 1 }, { col: 11, row: 1, flip: true }],
    chests: [{ id: "ch-crypte", col: 6, row: 0, lock: "crowbar", content: { kind: "goldKey" } }],
    // De quoi rallumer la torche murale éteinte, ou éclairer le souterrain.
    items: [{ id: "it-crypte-torche", kind: "torch", col: 1, row: 0 }],
  },

  // ── La tour ─────────────────────────────────────────────────────────────────
  "tour-basse": {
    id: "tour-basse",
    name: "Tour, premier etage",
    round: true,
    doors: [
      { col: 8, row: 2, side: "front", target: "crypte", spawn: { col: 8, row: 1 } },
    ],
    climbTile: { col: 8, row: 1, target: "tour-haute", spawn: { col: 10, row: 1 } },
    items: [
      { id: "it-tour-fiole", kind: "vial", col: 2, row: 1 },
      // Rien ne la distingue des bonnes : c'est la règle du jeu. Deux sur trois
      // sont saines - la punition existe, elle n'est plus probable.
      { id: "it-tour-poison", kind: "poison", col: 13, row: 1 },
    ],
    decors: [{ kind: "ecusson", col: 8 }],
  },

  "tour-haute": {
    id: "tour-haute",
    name: "Sommet de la tour",
    round: true,
    doors: [],
    // L'aigle d'or ne se prend qu'en lui substituant l'aigle de plomb ; le socle
    // libéré déclenche une flèche.
    items: [
      {
        id: "it-tour-aigle", kind: "eagle", col: 8, row: 1,
        pedestal: true, arrowTrap: { side: "left" },
      },
    ],
    holeTile: { col: 4, row: 1, target: "tour-basse", spawn: { col: 8, row: 1 } },
    decors: [{ kind: "colonnes" }],
  },

  // ── Sous-sol ────────────────────────────────────────────────────────────────
  cave: {
    id: "cave",
    name: "Cave voutee",
    doors: [
      { col: 8, row: 2, side: "front", target: "armurerie", spawn: { col: 8, row: 2 } },
      { col: 0, row: 0, side: "left", target: "souterrain", spawn: { col: 15, row: 0 } },
    ],
    climbTile: { col: 12, row: 1, target: "armurerie", spawn: { col: 12, row: 1 } },
    fireplaces: [
      { id: "fp-cave", col: 4, row: 2, secret: true, target: "cuisine", spawn: { col: 12, row: 2 } },
    ],
    items: [{ id: "it-cave-bague", kind: "ring", col: 2, row: 1, pedestal: true }],
    torches: [{ side: "left", lit: true }],
    decors: [{ kind: "piliers" }],
  },

  souterrain: {
    id: "souterrain",
    name: "Souterrain",
    layout: ["................", "######....######"],
    torches: [{ side: "left", lit: true }, { side: "right", lit: false }],
    doors: [
      { col: 15, row: 0, side: "right", target: "cave", spawn: { col: 0, row: 0 } },
      { col: 8, row: 1, side: "front", target: "puits", spawn: { col: 8, row: 1 } },
    ],
    // Herse d'avertissement : elle scelle les deux dernières colonnes, où il n'y a
    // rien. On apprend le mécanisme sans rien y perdre.
    herses: [
      { triggerCol: 4, triggerRow: 0, herseCol: 2, herseRow: 0, herseRows: 1, herseSide: "left", marked: true },
    ],
    chests: [{ id: "ch-souterrain", col: 12, row: 0, lock: "crowbar", content: { kind: "leadEagle" } }],
    bats: [{ row: 0, speed: 1.1 }],
  },

  puits: {
    id: "puits",
    name: "Le puits",
    layout: TWO_ROWS,
    torches: [{ side: "right", lit: true }],
    doors: [{ col: 8, row: 1, side: "front", target: "souterrain", spawn: { col: 8, row: 1 } }],
    items: [
      // Le diamant se prend sans piège : la seule flèche du château garde l'aigle.
      { id: "it-puits-diamant", kind: "diamond", col: 8, row: 0, pedestal: true },
      { id: "it-puits-bourse", kind: "purse", col: 1, row: 0, amount: 200 },
    ],
    traps: [{ col: 11, row: 0, marked: true }],
    ghosts: [{ col: 3, row: 0, side: "left" }],
    decors: [{ kind: "colonnes" }],
  },
};

/** Le château livré, prêt à jouer : celui que le jeu ouvre par défaut. */
export const RONCEVAL_CASTLE: CastleDef = {
  rooms: RONCEVAL_ROOMS,
  start: RONCEVAL_START_ROOM,
  spawn: RONCEVAL_START_SPAWN,
  oubliette: OUBLIETTE_ROOM,
};
