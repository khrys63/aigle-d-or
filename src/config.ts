/** Constantes globales : dimensions, perspective, mouvement, gameplay, couleurs. */

// --- Debug ---
/** Affiche le nom de la salle courante dans le HUD. Le jeu d'origine ne le montrait
 *  pas : gardé à false, et repassé à true le temps d'une session de mise au point. */
export const DEBUG_ROOM_NAME = false;

// --- Carte (C) ---
/** Le plan ne révèle que les salles déjà parcourues : on le complète en explorant.
 *  Passé à true, il montre TOUT le château d'emblée (les salles parcourues sont
 *  relevées dans World.visited dans les deux cas). */
export const MAP_REVEAL_ALL = false;

// --- Écran ---
export const VIEW_W = 800;
export const VIEW_H = 500;
export const HUD_H = 60;
export const PLAY_H = VIEW_H - HUD_H; // 440

// --- Perspective (point de fuite central) ---
/** Abscisse du point de fuite. */
export const VP_X = VIEW_W / 2;
/** Ordonnée du point de fuite : remonté (pas de plafond affiché, le sol domine). */
export const HORIZON_Y = 130;
/** Demi-largeur du cadre proche (z=0), soit presque toute la largeur jouable. */
export const NEAR_HALF_W = 384;
/** Haut / bas du cadre proche. */
export const NEAR_TOP = 10;
export const NEAR_BOT = PLAY_H - 10; // 430

// --- Grille de déplacement (le sol est une matrice de positions) ---
/** Dimensions de référence de L'Aigle d'Or : 16 dalles de large, 2 à 3 de profondeur. */
export const DEFAULT_COLS = 16;
export const DEFAULT_ROWS = 3;
/** Durée d'animation d'un pas, d'un saut directionnel, d'un saut sur place (s). */
export const STEP_TIME = 0.1;
export const LEAP_TIME = 0.22;
export const JUMP_TIME = 0.3;
/** Délai après une rotation avant de commencer à marcher (un tap ne fait que pivoter). */
export const TURN_GRACE = 0.16;
/** Déplacement d'un saut directionnel : on franchit 3 cases, donc on atterrit 4 plus loin. */
export const LEAP_STEPS = 4;
/** Saut directionnel décomposé : élan accroupi → vol → réception accroupie → relève (s). */
export const LEAP_CROUCH_TIME = 0.08;
export const LEAP_LAND_TIME = 0.1;
export const LEAP_RISE_TIME = 0.09;
/** Porte du mur du fond : toujours a 2 sauts du mur de gauche (= colonne 8). */
export const BACK_DOOR_COL = 2 * LEAP_STEPS;

// --- Gameplay ---
export const MAX_HEALTH = 100;
export const GUARD_DAMAGE = 16;
export const GHOST_DAMAGE = 11;
export const GUARD_HIT_COOLDOWN = 0.9;
/** Hémorragie : perte de vie par seconde une fois touché, jusqu'à boire une fiole. */
export const BLEED_RATE = 3;
/** Drain temporel : les minutes qui s'égrènent coûtent 1 % de forces à cet intervalle (s). */
export const TIME_DRAIN_INTERVAL = 45;
/** Durée (s) pendant laquelle une torche allumée brûle avant de se consumer. */
export const TORCH_DURATION = 30;
/** Grimpe à la corde : durée du lancer de grappin, puis de la montée (s). */
export const CLIMB_THROW_TIME = 0.5;
export const CLIMB_UP_TIME = 1.1;
export const ATTACK_DURATION = 0.22;
export const ATTACK_COOLDOWN = 0.4;
/** Portée du coup d'épée, en COLONNES (le combat est latéral uniquement). */
export const ATTACK_COLS = 2.2;
/** Distance de contact garde -> joueur. */
export const TOUCH_DX = 0.14;
export const TOUCH_DZ = 0.16;

// --- Tailles de base des sprites (à scale=1) ---
export const HERO_BASE_H = 208;
export const HERO_BASE_W = 68;
export const ITEM_BASE = 56;

// --- Couleurs (placeholder) ---
export const COLORS = {
  sky: "#0b0814",
  ceiling: "#241c33",
  ceilingFar: "#160f24",
  floorA: "#4a3d5e",
  floorB: "#372c49",
  wall: "#322746",
  wallSeam: "#241a35",
  backWall: "#2a2038",
  frameStone: "#9a9aa0",
  // Cheminée en pierre de taille (gris légèrement froid, assorti à frameStone).
  fireStone: "#83838f",      // colonnes
  fireStoneLight: "#9a9aa6", // linteau (arête qui capte la lumière)
  fireStoneCrest: "#b6b6c2", // écu du blason (en saillie, capte plus la lumière)
  fireStoneDark: "#5f5f6b",  // fond d'âtre / arrière du gabarit
  fireSeam: "#3a3a45",       // joints et cannelures
  fireHole: "#2b2b33",       // trous des colonnes (serrure à gauche)
  doorway: "#0d0814",
  doorFrame: "#6a4a2a",
  doorWood: "#6b3f23",
  doorWoodFrame: "#3f2412",
  grilleBar: "#8a93a0",
  grilleBack: "#15151c",
  doorExit: "#2c8a4e",
  torchBracket: "#4a3a28",
  flameOuter: "#ff7a1a",
  flameInner: "#ffe06a",
  trapMark: "#8a2740",
  trapCrack: "#0e0814",
  banner: "#ffd24a",
  bannerBg: "rgba(20,6,10,0.85)",
  dark: "#040208",
  hero: "#ffd24a",
  heroDark: "#caa02f",
  heroHair: "#ffd24a",
  heroSkin: "#e8b890",
  heroTunic: "#2f4fd8",
  heroBelt: "#ff8a1a",
  heroPants: "#36b24a",
  heroBoots: "#d33030",
  guard: "#d2492f",
  guardDark: "#9a3522",
  guardDead: "#4a342e",
  key: "#7fd2ff",
  treasure: "#ffaa33",
  eagle: "#ffe96b",
  hudBg: "#0c0816",
  text: "#f0e8ff",
  textDim: "#9a8fb0",
  healthBack: "#3a2030",
  healthFront: "#e0405a",
  rope: "#b8895a",
  grapple: "#8a93a0",
  // Plan du château (C) : un parchemin, à l'encre - le seul écran clair du jeu.
  mapPaper: "#e8dcae",
  mapPaperEdge: "#cdbf8a",
  mapInk: "#3a2a18",
  mapInkDim: "#9a8a5e",
  mapRoom: "#f5edd4",
  /** Salle noire (aucune torche allumée au départ) : case grisée sur le plan. */
  mapRoomDark: "#c9b992",
  mapRoomEdge: "#5a4630",
  mapHere: "#c0332f",
  mapDoorWood: "#8a5a2a",
  mapGrille: "#4a6a86",
  mapExit: "#2c7a46",
} as const;
