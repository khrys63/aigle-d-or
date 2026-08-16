import { ATTACK_DURATION, CLIMB_THROW_TIME, CLIMB_UP_TIME, COLORS, HERO_BASE_H, HERO_BASE_W, ITEM_BASE, NEAR_HALF_W, PLAY_H, VIEW_W } from "../config";
import type { Dir, ItemKind } from "../types";
import type { Renderer } from "../engine/Renderer";
import type { Player } from "../entities/Player";
import type { Guard } from "../entities/Guard";
import type { Door, DoorSide } from "../entities/Door";
import type { Chest } from "../entities/Chest";
import type { Fireplace } from "../entities/Fireplace";
import type { Bat } from "../entities/Bat";
import type { Ghost } from "../entities/Ghost";
import type { ArrowTrap } from "../entities/ArrowTrap";
import type { Room } from "../world/Room";
import { FURNITURE_W, type DecorDef, type FurnitureDef, type HerseDef, type SkeletonDef } from "../world/rooms";
import { ceilPoint, floorPoint, roomDepthPx, scaleAt, setRoomDepth, wallPoint, type Pt } from "./perspective";
import { colToX, rowToZ, xEdge, zEdge } from "../world/grid";
import { shade } from "./color";
import { INK, isLegacy, setLegacyActive } from "./legacy";

// Hauteur des portes : un peu plus que le héros (~0.57 du mur) ; la torche en main
// (flamme ~0.71 du mur) dépasse au-dessus. Sommet voûté ~0.66.
const DOOR_TOP = 0.58; // hauteur des montants (fraction de la hauteur du mur)
const DOOR_INSET = 0.18; // retrait de l'ouverture par rapport aux bords de la case
const ARCH_RISE = 0.08; // surélévation du sommet arrondi (voûte)

/**
 * Dessine la salle (de forme quelconque) en perspective, puis les entités.
 *
 * Le mode MO5 n'est armé QUE le temps de cette fonction : le HUD, la carte-parchemin
 * et les écrans de menu gardent leurs couleurs sans avoir à les traiter un par un.
 */
export function drawScene(r: Renderer, room: Room, player: Player): void {
  setLegacyActive(isLegacy());
  try {
    drawRoomAndEntities(r, room, player);
  } finally {
    setLegacyActive(false);
  }
}

function drawRoomAndEntities(r: Renderer, room: Room, player: Player): void {
  const lit = room.isLit();
  const handTorch = player.inHand === "torch" && player.handTorchLit;
  // Âtres allumés : un feu de cheminée éclaire lui aussi (halo local dans la pénombre).
  const hearths = room.fireplaces.filter((fp) => !fp.opened);
  // Salle non éclairée, ni torche en main ni âtre qui brûle : noir complet.
  if (!lit && !handTorch && hearths.length === 0) {
    r.clear(COLORS.dark);
    r.text("Il fait noir ici", VIEW_W / 2, PLAY_H / 2, COLORS.textDim, 18, "center");
    return;
  }

  r.clear(COLORS.sky);
  const { cols, rows } = room;
  setRoomDepth(rows); // perspective d'époque selon la profondeur de la salle (2 ou 3 cases)
  const xE = (i: number) => xEdge(i, cols);
  const zE = (i: number) => zEdge(i, rows);

  // Tour ronde : mur courbe (arc→plafond) puis sol (devant→arc). Pas de voûtes stepped.
  // En mode MO5, l'arc de jonction sol-mur (plus bas) suffit à dire la courbure : ni
  // remplissage, ni appareil de pierre.
  if (room.round && !isLegacy()) {
    drawRoundWallFill(r);
    drawRoundWallMasonry(r, cols);
    drawRoundFloorFill(r);
    drawRoundSideWalls(r, rows);
  }

  // Passe 1 : lit de joint par travées horizontales (salles normales uniquement).
  // Les tours rondes ont leur sol dessiné ci-dessus en un seul polygone.
  // Mode MO5 : le sol reste noir, seules les lignes de fuite le disent (voir les murs).
  if (!room.round && !isLegacy()) {
    for (const q of floorQuads(room)) r.poly(q, COLORS.floorB, COLORS.floorB, 1);
  }
  // Pavage : grandes dalles posées par-dessus, le lit de joint reparaît entre elles.
  if (!isLegacy()) drawFloorPaving(r, room);

  // Passe 2 : murs et marqueurs (fond→avant, sur le sol déjà dessiné).
  for (let row = rows - 1; row >= 0; row--) {
    for (let col = 0; col < cols; col++) {
      if (!room.isWalkable(col, row)) continue;
      const zN = zE(row);
      const zF = zE(row + 1);
      const xL = xE(col);
      const xR = xE(col + 1);

      // Mur du fond : plat en salle normale, remplacé par drawRoundVault dans une tour.
      if (!room.isWalkable(col, row + 1) && !room.round) {
        if (isLegacy()) {
          // Le MO5 ne montait pas le mur : un seul trait à son pied, et le noir au-dessus.
          const a = floorPoint(xL, zF);
          const b = floorPoint(xR, zF);
          r.line(a.x, a.y, b.x, b.y, INK, 1);
        } else {
          r.poly(wallQuad(xL, xR, zF, zF), backWallColor(zF));
          drawBackWallMasonry(r, xL, xR, zF, cols);
        }
      }
      // Dalle piégée : révélée par une chute => trou béant (visible même avec la
      // bague, il est bien réel) ; sinon ses taches - masquées par la bague maudite.
      if (room.isTrapOpen(col, row)) drawHoleMark(r, xL, xR, zN, zF);
      else if (room.trapMarked(col, row) && !player.hasRing) drawTrapMark(r, xL, xR, zN, zF);
      // Marqueur de herse : sur la dalle d'atterrissage, aligné sur la chute.
      // Masqué lui aussi par la bague maudite.
      const herse = room.herseMarkAt(col, row);
      if (herse && !player.hasRing) drawHerseMark(r, xL, xR, zN, zF, herse.herseSide);
      // Dale étoile (*) : point de grimpe vers le niveau supérieur.
      if (room.isClimbTile(col, row)) drawClimbMark(r, xL, xR, zN, zF);
      // Trou au sol : descente au niveau inférieur.
      if (room.isHoleTile(col, row)) drawHoleMark(r, xL, xR, zN, zF);
      // Murs latéraux : dans une tour ronde, ils sont tracés en un bloc par
      // drawRoundSideWalls (leur profondeur s'arrête au départ de l'arc, pas au fond).
      if (!room.round) {
        if (!room.isWalkable(col - 1, row)) drawSideWall(r, xL, zN, zF);
        if (!room.isWalkable(col + 1, row)) drawSideWall(r, xR, zN, zF);
      }
    }
  }

  // Mode MO5 : chaque angle de mur - ouvert ou fermé - porte son trait vertical.
  if (isLegacy() && !room.round) drawLegacyWallCorners(r, room);

  // Trait de jonction mur-plancher de la tour ronde, par-dessus les dalles.
  if (room.round) drawRoundFloorArc(r);

  // Squelettes : décalques plats au sol, avant les entités (ne masquent jamais le héros).
  for (const sk of room.skeletons) drawSkeleton(r, sk, cols, rows);

  for (const d of room.decors) drawDecor(r, room, d);
  for (const fp of room.fireplaces) drawFireplace(r, fp, cols, rows);
  for (const door of room.doors) drawDoor(r, door, cols, rows);
  for (const torch of room.torches) drawTorch(r, torch.side, torch.lit, rows);
  drawEntities(r, room, player);

  // Éclairée seulement par la torche en main : pénombre avec un halo autour du héros.
  if (!lit) {
    const halos = hearths.map((fp) => hearthHalo(fp, cols, rows));
    if (handTorch) halos.push(handTorchHalo(player));
    drawDim(r, halos);
  }
}

// --- Sol : pavage de grandes dalles -----------------------------------------

/**
 * Travées du sol praticable : une par suite horizontale de cases marchables.
 * Sert au remplissage comme au détourage du pavage (salles en L / en T comprises).
 */
function floorQuads(room: Room): Pt[][] {
  const { cols, rows } = room;
  const quads: Pt[][] = [];
  for (let row = rows - 1; row >= 0; row--) {
    const zN = zEdge(row, rows);
    const zF = zEdge(row + 1, rows);
    let start = -1;
    for (let col = 0; col <= cols; col++) {
      const walk = col < cols && room.isWalkable(col, row);
      if (walk && start === -1) {
        start = col;
      } else if (!walk && start !== -1) {
        const xL = xEdge(start, cols);
        const xR = xEdge(col, cols);
        quads.push([floorPoint(xL, zN), floorPoint(xR, zN), floorPoint(xR, zF), floorPoint(xL, zF)]);
        start = -1;
      }
    }
  }
  return quads;
}

// Largeur d'une dalle, en px d'époque (le sol fait 2·NEAR_HALF_W de large). Fixée en
// px et non en cases : en travers, le pavage ignore le quadrillage de jeu et le compte
// ne tombe jamais juste (≈13,2 dalles pour 16 colonnes), donc aucun joint ne se cale
// durablement sur un bord de case.
const SLAB_W_PX = 58;
const JOINT_PX  = 3;  // largeur du joint entre deux dalles
const ROUND_PX  = 5;  // rayon des angles, arrondis à la taille

/**
 * Profondeur d'une dalle : une demi-rangée, exactement. C'est la seule dimension
 * calée sur la grille, et à dessein - les murs du fond courent sur des bords de
 * rangée, donc un joint tombe pile au pied de chaque mur et aucune dalle n'y est
 * tranchée. En travers, en revanche, les dalles restent libres du quadrillage.
 */
function slabDepth(rows: number): number {
  return 1 / (2 * rows);
}

/**
 * Contour d'une dalle : rectangle à angles arrondis, décrit dans le PLAN-SOL puis
 * projeté point par point. Les rayons diffèrent en x et en z (rx/rz) parce que les
 * deux axes n'ont pas la même échelle en px : c'est ce qui rend l'angle rond dans le
 * monde, et non seulement à l'écran.
 */
function slabPoly(x0: number, x1: number, z0: number, z1: number, rx: number, rz: number): Pt[] {
  const N = 4; // segments par angle
  const pts: Pt[] = [];
  const arc = (cx: number, cz: number, a0: number): void => {
    for (let i = 0; i <= N; i++) {
      const a = a0 + (i / N) * (Math.PI / 2);
      pts.push(floorPoint(cx + rx * Math.cos(a), cz + rz * Math.sin(a)));
    }
  };
  arc(x1 - rx, z0 + rz, -Math.PI / 2); // angle avant-droit
  arc(x1 - rx, z1 - rz, 0);            // arrière-droit
  arc(x0 + rx, z1 - rz, Math.PI / 2);  // arrière-gauche
  arc(x0 + rx, z0 + rz, Math.PI);      // avant-gauche
  return pts;
}

/**
 * Pavage du sol : grandes dalles rectangulaires à angles arrondis, appareillées en
 * quinconce, sans lien avec la grille de jeu. Le tout est détouré sur le sol
 * praticable - les dalles débordent volontairement du gabarit et sont coupées net par
 * le clip, comme le seraient de vraies dalles sciées au pied des murs.
 */
function drawFloorPaving(r: Renderer, room: Room): void {
  const ctx = r.ctx;
  ctx.save();
  ctx.beginPath();
  for (const q of (room.round ? [roundFloorPoly()] : floorQuads(room))) {
    ctx.moveTo(q[0].x, q[0].y);
    for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].x, q[i].y);
    ctx.closePath();
  }
  ctx.clip();
  drawSlabField(r, room.rows);
  ctx.restore();
}

/** Champ complet de dalles (mêmes assises partout) - à dessiner sous un clip. */
function drawSlabField(r: Renderer, rows: number): void {
  const dz = roomDepthPx();
  const w  = SLAB_W_PX / NEAR_HALF_W;   // largeur de dalle en unités x
  const d  = slabDepth(rows);           // profondeur de dalle en unités z
  const jx = JOINT_PX / NEAR_HALF_W / 2;
  const jz = JOINT_PX / dz / 2;
  const rx = ROUND_PX / NEAR_HALF_W;
  const rz = ROUND_PX / dz;

  // En profondeur, les assises couvrent [0,1] pile : pas de débord à prévoir.
  const nz = 2 * rows;
  const nx = Math.ceil(2 / w) + 2;
  for (let j = 0; j < nz; j++) {
    const z0 = j * d;
    // Quinconce : une assise sur deux décalée d'une demi-dalle. Le 0.21 casse en plus
    // l'alignement du bord gauche de la salle sur un joint.
    const shift = (j % 2 ? 0.5 : 0) + 0.21;
    for (let i = -1; i < nx; i++) {
      const x0 = -1 + (i + shift) * w;
      // Teinte : trois nuances alternées sans motif lisible, pour que la pierre
      // respire sans qu'on lise une damier.
      const tone = ((i * 5 + j * 3) % 3) * 0.045;
      r.poly(
        slabPoly(x0 + jx, x0 + w - jx, z0 + jz, z0 + d - jz, rx, rz),
        shade(COLORS.floorA, tone),
      );
    }
  }
}

/**
 * Pavage prolongé sous une arche latérale : le triangle écran entre le pied des deux
 * montants (sous le trait horizontal du seuil) est repeint comme le sol - lit de
 * joint puis mêmes dalles - pour que le pavage file sous l'arche sans hypoténuse.
 */
function drawArchFloorPatch(r: Renderer, rows: number, tri: Pt[]): void {
  if (isLegacy()) return; // pas de pavage à prolonger : le sol est noir

  // Débord de quelques px sous l'hypoténuse : il recouvre le liseré anti-aliasé de
  // la jonction mur/sol (invisible par ailleurs, le motif de dalles est le même que
  // celui du sol déjà peint). Le bord haut (seuil) reste exact.
  const quad = [
    tri[0], tri[1],
    { x: tri[1].x, y: tri[1].y + 3 },
    { x: tri[2].x, y: tri[2].y + 3 },
  ];
  const ctx = r.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(quad[0].x, quad[0].y);
  for (let i = 1; i < quad.length; i++) ctx.lineTo(quad[i].x, quad[i].y);
  ctx.closePath();
  ctx.clip();
  r.poly(quad, COLORS.floorB);
  drawSlabField(r, rows);
  ctx.restore();
}

/** Trou de lumière dans la pénombre : centre écran + rayons du dégradé. */
interface DimHalo {
  x: number;
  y: number;
  inner: number;
  outer: number;
}

/** Halo de la torche en main : autour du héros, à hauteur de poitrine. */
function handTorchHalo(player: Player): DimHalo {
  const feet = floorPoint(player.x, player.z);
  return { x: feet.x, y: feet.y - 50, inner: 28, outer: 210 };
}

/** Halo d'un âtre allumé : centré sur le foyer, rayons calés sur la largeur
 *  projetée de la cheminée - la perspective le resserre donc d'elle-même. */
function hearthHalo(fp: Fireplace, cols: number, rows: number): DimHalo {
  const z = zEdge(fp.row + 1, rows);
  const xA = xEdge(Math.max(0, fp.col - 1), cols);
  const xB = xEdge(Math.min(cols, fp.col + 2), cols);
  const pL = wallPoint(xA, z, 0.15);
  const pR = wallPoint(xB, z, 0.15);
  const w = pR.x - pL.x;
  return { x: (pL.x + pR.x) / 2, y: pL.y, inner: w * 0.18, outer: w * 1.05 };
}

// Calque réutilisé d'une frame à l'autre pour composer la pénombre et ses halos.
let dimLayer: HTMLCanvasElement | null = null;

/**
 * Pénombre globale percée de halos de lumière (torche en main, âtres allumés).
 * Composée sur un calque : le voile est posé plein, puis chaque halo le TROUE
 * (destination-out) - deux dégradés superposés directement sur la scène
 * s'assombriraient l'un l'autre au lieu de s'additionner.
 */
function drawDim(r: Renderer, halos: DimHalo[]): void {
  if (!dimLayer) {
    dimLayer = document.createElement("canvas");
    dimLayer.width = VIEW_W;
    dimLayer.height = PLAY_H;
  }
  const octx = dimLayer.getContext("2d")!;
  octx.globalCompositeOperation = "source-over";
  octx.clearRect(0, 0, VIEW_W, PLAY_H);
  octx.fillStyle = "rgba(3,2,8,0.86)";
  octx.fillRect(0, 0, VIEW_W, PLAY_H);
  octx.globalCompositeOperation = "destination-out";
  for (const h of halos) {
    const g = octx.createRadialGradient(h.x, h.y, h.inner, h.x, h.y, h.outer);
    g.addColorStop(0, "rgba(0,0,0,0.86)"); // au centre il ne reste que ~0.12 de voile
    g.addColorStop(1, "rgba(0,0,0,0)");
    octx.fillStyle = g;
    octx.fillRect(0, 0, VIEW_W, PLAY_H);
  }
  r.ctx.drawImage(dimLayer, 0, 0);
}

/**
 * Position (u = travers, v = profondeur) et grosseur relative des quatre taches d'une
 * dalle piégée. Valeurs irrégulières et figées : jetées à la main pour qu'aucune
 * paire ne s'aligne, et constantes pour que les taches ne sautillent pas d'une frame
 * à l'autre (un tirage aléatoire au rendu les ferait danser).
 */
const TRAP_SPOTS = [
  { u: 0.47, v: 0.39, r: 1.2 },
  { u: 0.58, v: 0.44, r: 0.75 },
  { u: 0.55, v: 0.62, r: 0.9 },
  { u: 0.66, v: 0.57, r: 1.05 },
];

/**
 * Dalle piégée visible : quatre taches sur la dalle, comme dans le jeu d'origine
 * (cf. asset_legacy/cheminé.png, au premier plan sous le héros). Volontairement
 * discrètes - la croix rouge qu'elles remplacent criait le piège au lieu de le
 * suggérer. Elles sont projetées au sol, donc la perspective les resserre vers le
 * fond de la dalle d'elle-même.
 */
function drawTrapMark(r: Renderer, xL: number, xR: number, zN: number, zF: number): void {
  const sc = scaleAt(zN);
  for (const t of TRAP_SPOTS) {
    const p = floorPoint(xL + (xR - xL) * t.u, zN + (zF - zN) * t.v);
    r.circle(p.x, p.y, Math.max(1, Math.round(2 * sc * t.r)), COLORS.trapCrack);
  }
}

/** Torche murale au premier plan (bas-gauche ou bas-droite) avec flamme si allumée. */
function drawTorch(r: Renderer, side: "left" | "right", lit: boolean, rows: number): void {
  const x = side === "left" ? -1 : 1;
  const z = rowToZ(0, rows);
  const s = scaleAt(z);
  // Fixee au-dessus des portes (qui montent a DOOR_TOP = 0.72 de la hauteur du mur).
  const base = wallPoint(x, z, 0.78);
  const bx = base.x;
  const by = base.y + 6 * s;

  // Inclinaison du haut de la torche vers l'intérieur de la salle.
  // x = -1 (gauche) -> penche vers la droite ; x = +1 (droite) -> vers la gauche.
  const tilt = -x * 0.28;

  // Pivot au point d'ancrage au mur, puis rotation : tout est dessiné en local.
  r.ctx.save();
  r.ctx.translate(bx, by);
  r.ctx.rotate(tilt);

  // Support + manche.
  r.rect({ x: -3 * s, y: -30 * s, w: 6 * s, h: 36 * s }, COLORS.torchBracket);
  r.rect({ x: -9 * s, y: -2 * s, w: 18 * s, h: 7 * s }, COLORS.torchBracket);

  if (!lit) {
    r.ctx.restore();
    return;
  }
  const tip = -30 * s;
  const flick = 1 + 0.18 * Math.sin(Date.now() / 80 + bx);
  const fh = 28 * s * flick;
  // Halo - hors du mode MO5 : la machine ne savait pas dégrader une couleur.
  if (!isLegacy()) {
    r.ctx.fillStyle = "rgba(255,150,40,0.10)";
    r.ctx.beginPath();
    r.ctx.arc(0, tip, 70 * s, 0, Math.PI * 2);
    r.ctx.fill();
  }
  // Flamme externe puis cœur.
  r.poly([{ x: 0, y: tip - fh }, { x: 9 * s, y: tip }, { x: -9 * s, y: tip }], COLORS.flameOuter);
  r.poly([{ x: 0, y: tip - fh * 0.6 }, { x: 5 * s, y: tip }, { x: -5 * s, y: tip }], COLORS.flameInner);
  r.ctx.restore();
}

/** Quad d'un panneau de mur vertical : soit à x constant (latéral), soit à z constant (fond). */
function wallQuad(xL: number, xR: number, zL: number, zR: number): Pt[] {
  return [
    wallPoint(xL, zL, 0),
    wallPoint(xR, zR, 0),
    wallPoint(xR, zR, 1),
    wallPoint(xL, zL, 1),
  ];
}

/**
 * Couleur du mur latéral : une seule teinte (COLORS.wall) qui s'assombrit
 * linéairement avec la profondeur z (0 = front de scène, 1 = mur du fond).
 */
function sideWallColor(z: number): string {
  const t = Math.max(0, Math.min(1, z));
  return shade(COLORS.wall, t * 0.55);
}

// --- Appareil de pierre ----------------------------------------------------

/** Rangées de pierres sur la hauteur d'un mur (identique sur tous les murs). */
const MASONRY_ROWS = 5;

/** Teinte d'un mur du fond à la profondeur z (brouillard). */
function backWallColor(z: number): string {
  return shade(COLORS.backWall, 0.35 + z * 0.4);
}

/**
 * Joint d'un mur du fond : plus CLAIR que la pierre, à l'inverse des murs latéraux.
 * Le mur du fond est volontairement très assombri par le brouillard (~25 % de la
 * luminosité au fond) : un joint plus sombre n'aurait plus de marge pour se détacher
 * et virerait au noir. On éclaircit donc d'un cran constant, ce qui garde le même
 * contraste à toute profondeur.
 */
function backWallMortar(z: number): string {
  return shade(COLORS.backWall, Math.max(0, 0.35 + z * 0.4 - 0.35));
}

/**
 * Appareil de pierre sur un mur du fond (plan à z constant), en perspective :
 *  - rangées HORIZONTALES = lignes à hauteur h constante, tracées de xL à xR ;
 *  - joints VERTICAUX = lignes à x constant, du sol au plafond ;
 *  - joints décalés (running bond) une rangée sur deux, positionnés sur la grille
 *    ABSOLUE de la salle -> ils se raccordent d'une case à l'autre, quel que soit
 *    le z du mur (salles en L : le fond n'est pas à la même profondeur partout).
 * Le bord xL est tracé mais pas xR : chaque jonction entre cases n'est dessinée qu'une fois.
 */
function drawBackWallMasonry(r: Renderer, xL: number, xR: number, z: number, cols: number): void {
  const w = 2 / cols; // largeur de pierre = 1 case
  const mortar = backWallMortar(z);

  for (let i = 1; i < MASONRY_ROWS; i++) {
    const h = i / MASONRY_ROWS;
    const a = wallPoint(xL, z, h);
    const b = wallPoint(xR, z, h);
    r.line(a.x, a.y, b.x, b.y, mortar, 1);
  }

  for (let band = 0; band < MASONRY_ROWS; band++) {
    const hLo = band / MASONRY_ROWS;
    const hHi = (band + 1) / MASONRY_ROWS;
    const offset = band % 2 ? 0.5 : 0; // running bond
    const k0 = Math.ceil((xL + 1) / w - offset - 1e-6);
    for (let k = k0; ; k++) {
      const x = -1 + (k + offset) * w;
      if (x >= xR - 1e-6) break;
      const lo = wallPoint(x, z, hLo);
      const hi = wallPoint(x, z, hHi);
      r.line(lo.x, lo.y, hi.x, hi.y, mortar, 1);
    }
  }
}

function drawSideWall(r: Renderer, x: number, zN: number, zF: number): void {
  const nb = wallPoint(x, zN, 0); // près, bas
  const fb = wallPoint(x, zF, 0); // loin, bas
  const ft = wallPoint(x, zF, 1); // loin, haut
  const nt = wallPoint(x, zN, 1); // près, haut

  // Mode MO5 : le mur latéral se réduit à sa ligne de fuite au sol - la diagonale
  // qui, avec le trait du mur du fond, dessinait toute la salle à l'époque.
  if (isLegacy()) {
    r.line(nb.x, nb.y, fb.x, fb.y, INK, 1);
    return;
  }

  // Dégradé GLOBAL au mur entier (front z=0 -> fond z=1), identique pour toutes les
  // cellules : on remplit chaque cellule avec le MÊME dégradé en coordonnées écran.
  // -> aucune discontinuité aux jonctions de cellules, donc plus de "rows" visibles.
  // (Un dégradé par cellule créait des cassures car, en perspective, le coin haut ne
  //  se projette pas comme le coin bas sur l'axe local du dégradé.)
  const front = wallPoint(x, 0, 0);
  const back = wallPoint(x, 1, 0);
  const grad = r.ctx.createLinearGradient(front.x, front.y, back.x, back.y);
  grad.addColorStop(0, sideWallColor(0));
  grad.addColorStop(1, sideWallColor(1));

  const ctx = r.ctx;
  ctx.beginPath();
  ctx.moveTo(nb.x, nb.y);
  ctx.lineTo(fb.x, fb.y);
  ctx.lineTo(ft.x, ft.y);
  ctx.lineTo(nt.x, nt.y);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  drawSideWallMasonry(r, x, zN, zF);
}

/**
 * Appareil de pierre sur un mur latéral, en perspective :
 *  - rangées HORIZONTALES = lignes à hauteur h constante tracées de zN à zF (via wallPoint)
 *    -> elles fuient naturellement vers le point de fuite ;
 *  - joints VERTICAUX = lignes à profondeur z constante (du sol au plafond) -> restent verticaux ;
 *  - joints décalés (running bond) une rangée sur deux, et continus d'une case à l'autre
 *    (aucun joint sur les bords zN/zF -> pas de couture par "row").
 */
function drawSideWallMasonry(r: Renderer, x: number, zN: number, zF: number): void {
  const NH = MASONRY_ROWS; // nombre de rangées sur la hauteur du mur
  const NZ = 2; // pierres en profondeur par case (largeur de pierre = 1/2 case)
  const zMid = (zN + zF) / 2;
  const mortar = shade(COLORS.wall, zMid * 0.55 + 0.26); // joint un peu plus sombre que le mur

  // Rangées horizontales (convergent vers le point de fuite).
  for (let i = 1; i < NH; i++) {
    const h = i / NH;
    const a = wallPoint(x, zN, h);
    const b = wallPoint(x, zF, h);
    r.line(a.x, a.y, b.x, b.y, mortar, 1);
  }

  // Joints verticaux par rangée, décalés d'une demi-pierre une rangée sur deux.
  for (let band = 0; band < NH; band++) {
    const hLo = band / NH;
    const hHi = (band + 1) / NH;
    const offset = band % 2 ? 0.5 : 0; // running bond
    for (let k = 0; k < NZ; k++) {
      const f = (k + offset) / NZ;
      // On dessine le bord proche (f=0) mais pas le lointain (f=1) : chaque jonction
      // entre cases n'est tracée qu'une fois, et seulement sur une rangée sur deux
      // (appareil décalé) -> pas de couture verticale continue sur toute la hauteur.
      if (f >= 1) continue;
      const z = zN + (zF - zN) * f;
      const lo = wallPoint(x, z, hLo);
      const hi = wallPoint(x, z, hHi);
      r.line(lo.x, lo.y, hi.x, hi.y, mortar, 1);
    }
  }
}

/**
 * Angles des murs, mode MO5 : un trait vertical du sol au haut du mur, à chaque
 * endroit où le fond change de profondeur (cf. `asset_legacy/grille piege ouverte.png`,
 * quatre traits : les deux bouts du fond et les deux montants de l'alcôve).
 *
 * On les déduit des **travées** de mur du fond - une suite de cases praticables ayant
 * du vide derrière elles. Les deux bouts d'une travée SONT les angles, qu'ils soient
 * fermés (deux murs qui se rejoignent) ou ouverts (un mur qui s'arrête). Une salle
 * rectangulaire n'en a donc que deux ; une salle en T ou en escalier en a un par
 * décrochement, à la profondeur de son décrochement.
 */
function drawLegacyWallCorners(r: Renderer, room: Room): void {
  const { cols, rows } = room;
  for (let row = 0; row < rows; row++) {
    const z = zEdge(row + 1, rows);
    let start = -1;
    for (let col = 0; col <= cols; col++) {
      const wall = col < cols && room.isWalkable(col, row) && !room.isWalkable(col, row + 1);
      if (wall) {
        if (start === -1) start = col;
      } else if (start !== -1) {
        legacyCorner(r, xEdge(start, cols), z);
        legacyCorner(r, xEdge(col, cols), z);
        start = -1;
      }
    }
  }
}

/** Un angle : le montant vertical, du pied du mur à son sommet. */
function legacyCorner(r: Renderer, x: number, z: number): void {
  const lo = wallPoint(x, z, 0);
  const hi = wallPoint(x, z, 1);
  r.line(lo.x, lo.y, hi.x, hi.y, INK, 1);
}

// --- Tour ronde ------------------------------------------------------------

/**
 * Arc cylindrique de la tour ronde. x ∈ [-1, +1].
 * Démarre au coin arrière-extérieur des dalles de mur de row 1 : (±1, 2/3).
 * Culmine à (0, 1) - mur du fond.
 * z(x) = (1/3)*(1-x²)^1.5 + 2/3 - courbe lisse, pas de portion plate.
 */
function roundTowerArcZ(x: number): number {
  return (1 / 3) * Math.pow(1 - x * x, 1.5) + 2 / 3;
}

/**
 * Murs droits d'une tour ronde : panneaux à x=±1 allant du front de scène (z=0)
 * jusqu'au départ de l'arc (z=2/3), où la voûte cylindrique prend le relais.
 * Même appareil de pierre que dans une salle normale : on découpe par rangée pour
 * garder la même largeur de pierre en profondeur, et la dernière est tronquée à l'arc.
 */
function drawRoundSideWalls(r: Renderer, rows: number): void {
  const zArc = roundTowerArcZ(1); // 2/3 : raccord mur droit / voûte
  for (const x of [-1, 1]) {
    for (let row = 0; row < rows; row++) {
      const zN = zEdge(row, rows);
      if (zN >= zArc - 1e-6) break;
      drawSideWall(r, x, zN, Math.min(zEdge(row + 1, rows), zArc));
    }
  }
}

/** Contour du sol d'une tour ronde : dôme curviligne x∈[-1,+1], fermé vers l'avant. */
function roundFloorPoly(): Pt[] {
  const N = 64;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -1 + 2 * (i / N);
    pts.push(floorPoint(x, roundTowerArcZ(x)));
  }
  // Fermer le polygone vers l'avant de la scène (z=0) pour couvrir tout le sol.
  pts.push(floorPoint(+1, 0));
  pts.push(floorPoint(-1, 0));
  return pts;
}

/** Sol de la tour ronde : lit de joint, le pavage vient ensuite par-dessus. */
function drawRoundFloorFill(r: Renderer): void {
  r.poly(roundFloorPoly(), COLORS.floorB, COLORS.floorB, 1);
}

/** Mur courbe de la tour ronde : bande arc-sol → arc-plafond, x∈[-1,+1]. */
function drawRoundWallFill(r: Renderer): void {
  const N = 64;
  const pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const x = -1 + 2 * (i / N);
    pts.push(floorPoint(x, roundTowerArcZ(x)));
  }
  for (let i = N; i >= 0; i--) {
    const x = -1 + 2 * (i / N);
    pts.push(ceilPoint(x, roundTowerArcZ(x)));
  }
  r.poly(pts, COLORS.backWall);
}

/**
 * Échantillonne l'arc de la tour et mesure sa longueur cumulée en px d'époque.
 * x et z n'ont pas la même échelle (x∈[-1,1] = 2·NEAR_HALF_W de large, z∈[0,1] =
 * roomDepthPx() de profond) : sans cette conversion, l'abscisse curviligne serait faussée.
 */
function roundTowerArcSamples(N: number): { x: number; z: number; s: number }[] {
  const dz = roomDepthPx();
  const out: { x: number; z: number; s: number }[] = [];
  let s = 0;
  let prev: Pt | null = null;
  for (let i = 0; i <= N; i++) {
    const x = -1 + 2 * (i / N);
    const z = roundTowerArcZ(x);
    const p = { x: x * NEAR_HALF_W, y: z * dz };
    if (prev) s += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    out.push({ x, z, s });
  }
  return out;
}

/** x de l'arc à l'abscisse curviligne `s` (interpolation linéaire entre échantillons). */
function roundTowerXAt(samples: { x: number; s: number }[], s: number): number {
  let i = 1;
  while (i < samples.length - 1 && samples[i].s < s) i++;
  const a = samples[i - 1];
  const b = samples[i];
  const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  return a.x + (b.x - a.x) * t;
}

/**
 * Appareil de pierre sur le mur courbe d'une tour, en perspective :
 *  - rangées HORIZONTALES = polylignes à hauteur h constante suivant l'arc
 *    (elles remontent vers le point de fuite au centre, où le mur est le plus loin) ;
 *  - joints VERTICAUX = lignes à x constant (donc à z constant sur l'arc) -> verticaux
 *    à l'écran, répartis à pas d'ARC constant pour que les pierres gardent la même
 *    largeur réelle sur tout le pourtour ;
 *  - joints décalés (running bond) une rangée sur deux.
 */
function drawRoundWallMasonry(r: Renderer, cols: number): void {
  const N = 64;
  const samples = roundTowerArcSamples(N);
  const len = samples[N].s;
  const mortar = shade(COLORS.backWall, 0.3);

  // Même largeur de pierre que sur un mur du fond : 1 case.
  const stonePx = (2 * NEAR_HALF_W) / cols;
  const stones = Math.max(1, Math.round(len / stonePx));
  const step = len / stones;

  for (let i = 1; i < MASONRY_ROWS; i++) {
    const h = i / MASONRY_ROWS;
    let prev: Pt | null = null;
    for (const sm of samples) {
      const p = wallPoint(sm.x, sm.z, h);
      if (prev) r.line(prev.x, prev.y, p.x, p.y, mortar, 1);
      prev = p;
    }
  }

  for (let band = 0; band < MASONRY_ROWS; band++) {
    const hLo = band / MASONRY_ROWS;
    const hHi = (band + 1) / MASONRY_ROWS;
    const offset = band % 2 ? 0.5 : 0; // running bond
    for (let k = 0; k + offset < stones; k++) {
      const x = roundTowerXAt(samples, (k + offset) * step);
      const z = roundTowerArcZ(x);
      const lo = wallPoint(x, z, hLo);
      const hi = wallPoint(x, z, hHi);
      r.line(lo.x, lo.y, hi.x, hi.y, mortar, 1);
    }
  }
}

/** Trait de jonction sol–mur de la tour ronde, x∈[-1,+1]. */
function drawRoundFloorArc(r: Renderer): void {
  const N = 64;
  let prev: Pt | null = null;
  for (let i = 0; i <= N; i++) {
    const x = -1 + 2 * (i / N);
    const z = roundTowerArcZ(x);
    const pt = floorPoint(x, z);
    if (prev) r.line(prev.x, prev.y, pt.x, pt.y, shade(COLORS.wallSeam, z * 0.4), 1);
    prev = pt;
  }
}

// --- Herse -----------------------------------------------------------------

/** Trou rond dans le plan du sol : N points projetés avec floorPoint → perspective correcte. */
function drawHoleMark(r: Renderer, xL: number, xR: number, zN: number, zF: number): void {
  const cx = (xL + xR) / 2;
  const mz = zN + (zF - zN) * 0.5;
  const rx = (xR - xL) * 0.38;
  const rz = (zF - zN) * 0.38;
  const N = 20;
  // En regardant dans le trou, on voit l'ÉPAISSEUR de la dalle au second plan :
  // la tranche, sous l'arc arrière de l'ouverture, descend dans le noir.
  const depth = Math.max(3, 7 * scaleAt(mz)); // épaisseur visible de la dalle (px écran)
  const ring: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const θ = (2 * Math.PI * i) / N;
    ring.push(floorPoint(cx + rx * Math.cos(θ), mz + rz * Math.sin(θ)));
  }
  const ctx = r.ctx;
  // Le vide du trou.
  r.poly(ring, "#030106");
  // Tranche de la dalle : bande sous l'arc arrière (moitié du fond), bornée au trou.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ring[0].x, ring[0].y);
  for (let i = 1; i < N; i++) ctx.lineTo(ring[i].x, ring[i].y);
  ctx.closePath();
  ctx.clip();
  const back: Pt[] = [];
  for (let i = 0; i <= N / 2; i++) {
    const θ = (Math.PI * i) / (N / 2);
    back.push(floorPoint(cx + rx * Math.cos(θ), mz + rz * Math.sin(θ)));
  }
  const slice = [...back, ...back.slice().reverse().map((p) => ({ x: p.x, y: p.y + depth }))];
  r.poly(slice, "#4a3c62", "#241a35", 1);
  ctx.restore();
  // Bordure pierre de l'ouverture, par-dessus.
  r.poly(ring, "transparent", "#3a2e50", 2);
}

/**
 * Squelette allongé au sol sur 3 cases (redessin procédural de squelette.png) :
 * crâne de profil, bras replié devant, colonne, cage thoracique, bassin et jambes.
 * Tout est décrit en coordonnées locales (u, v) ∈ [0,1]² du gabarit - u en travers
 * des 3 dalles, v en profondeur de la rangée - puis projeté point par point, comme
 * les dalles du pavage.
 */
function drawSkeleton(r: Renderer, sk: SkeletonDef, cols: number, rows: number): void {
  const x0 = xEdge(sk.col - 1, cols);
  const x1 = xEdge(sk.col + 2, cols);
  const z0 = zEdge(sk.row, rows);
  const z1 = zEdge(sk.row + 1, rows);
  // Miroir vertical (v → 1-v) : le squelette est décrit tête vers l'avant, on le
  // couche tête vers le fond, ce qui lit mieux en perspective.
  const P = (u: number, v: number): Pt =>
    floorPoint(x0 + (sk.flip ? 1 - u : u) * (x1 - x0), z0 + (1 - v) * (z1 - z0));

  const sc = scaleAt(z0 + (z1 - z0) * 0.5);
  const lw = Math.max(1, Math.round(1.4 * sc));
  const ctx = r.ctx;

  // Polyligne ouverte, en points déjà projetés.
  const strokePts = (pts: Pt[], color: string, width: number): void => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  // Polyligne du plan-sol (u, v), projetée puis tracée.
  const stroke = (uv: [number, number][], color: string, width: number): void =>
    strokePts(uv.map(([u, v]) => P(u, v)), color, width);
  // Ellipse du plan-sol (rayons en fractions du gabarit), échantillonnée puis projetée.
  const ellipse = (cu: number, cv: number, ru: number, rv: number, a0 = 0, a1 = 2 * Math.PI): Pt[] => {
    const N = 16;
    const pts: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + ((a1 - a0) * i) / N;
      pts.push(P(cu + ru * Math.cos(a), cv + rv * Math.sin(a)));
    }
    return pts;
  };
  /**
   * Une passe de dessin complète, paramétrée : `mono` remplace toutes les teintes
   * (mode silhouette). Le relief tient à deux artifices :
   *  1. la passe est d'abord rejouée en silhouette sombre, décalée de quelques px
   *     vers le bas-droit de l'écran - ombre portée qui décolle les os du sol ;
   *  2. dans la passe réelle, chaque os porte un liseré sombre sous son bord bas
   *     (et la calotte un reflet clair) - modelé cylindrique des fûts.
   */
  const paint = (mono: string | null): void => {
    const BONE = mono ?? "#ddd6c1";
    const UNDER = mono ?? "#9c8f75"; // dessous des os, dans l'ombre
    const EDGE = mono ?? "#241b33";
    const dy = Math.max(1, Math.round(1.4 * sc)); // débord du liseré bas, en px écran

    // Os long : liseré bas sombre, puis fût clair à têtes rondes par-dessus.
    const bone = (u1: number, v1: number, u2: number, v2: number): void => {
      const a = P(u1, v1);
      const b = P(u2, v2);
      r.line(a.x, a.y + dy, b.x, b.y + dy, UNDER, lw + 1);
      r.circle(a.x, a.y + dy, lw, UNDER);
      r.circle(b.x, b.y + dy, lw, UNDER);
      r.line(a.x, a.y, b.x, b.y, BONE, lw + 1);
      r.circle(a.x, a.y, lw, BONE);
      r.circle(b.x, b.y, lw, BONE);
    };
    // Arc modelé : même doublage liseré + trait clair.
    const arcBone = (pts: Pt[]): void => {
      strokePts(pts.map((p) => ({ x: p.x, y: p.y + dy })), UNDER, lw);
      strokePts(pts, BONE, lw);
    };
    // Surface pleine modelée : assise sombre décalée sous la silhouette claire.
    const slab = (pts: Pt[]): void => {
      r.poly(pts.map((p) => ({ x: p.x, y: p.y + dy })), UNDER, UNDER, 1);
      r.poly(pts, BONE, EDGE, 1);
    };

    // Bras : part de l'épaule (naissance de la colonne) et s'étend devant le corps,
    // bien sous le menton - phalanges groupées au bout.
    bone(0.23, 0.54, 0.13, 0.72);
    for (const [u, v] of [[0.10, 0.74], [0.115, 0.78], [0.085, 0.77]] as const) {
      const p = P(u, v);
      r.circle(p.x, p.y, Math.max(1, lw - 1), BONE);
    }

    // Crâne de FACE, comme sur l'original : dôme de calotte, tempes, joues en
    // retrait puis mâchoire plate ; deux orbites, nez et dents sombres.
    // NB : à l'écran, une fraction de v pèse ~3× plus de px qu'une fraction de u -
    // les rayons rv sont donc volontairement bien plus petits que les ru.
    const skullSide: [number, number][] = [
      [0.195, 0.44], // tempe droite
      [0.19, 0.52],  // joue
      [0.165, 0.54], // retrait vers la mâchoire
      [0.16, 0.60],
      [0.10, 0.60],  // menton plat
      [0.095, 0.54],
      [0.07, 0.52],  // joue gauche
      [0.065, 0.44], // tempe gauche
    ];
    const dome = ellipse(0.13, 0.44, 0.065, 0.16, Math.PI, 2 * Math.PI);
    slab([...dome, ...skullSide.map(([u, v]) => P(u, v))]);
    if (!mono) {
      // Reflet clair sur le haut de la calotte.
      strokePts(ellipse(0.13, 0.445, 0.048, 0.115, Math.PI * 1.12, Math.PI * 1.88), "#f4eedd", 1);
      for (const eu of [0.107, 0.153]) {
        const e = P(eu, 0.46);
        r.circle(e.x, e.y, Math.max(1, Math.round(2.2 * sc)), EDGE); // orbites
      }
      const nose = P(0.13, 0.52);
      r.circle(nose.x, nose.y, Math.max(1, Math.round(1.2 * sc)), EDGE);
      for (const tu of [0.112, 0.13, 0.148]) stroke([[tu, 0.55], [tu, 0.595]], EDGE, 1); // dents
    }

    // Colonne vertébrale, du crâne au bassin.
    arcBone([[0.20, 0.46], [0.40, 0.50], [0.61, 0.50]].map(([u, v]) => P(u, v)));

    // Cage thoracique : «())» - un arc gauche et deux arcs droits décalés,
    // ouverts en haut et en bas, traversés par la colonne.
    arcBone(ellipse(0.41, 0.48, 0.09, 0.28, Math.PI * 0.62, Math.PI * 1.38)); // «(»
    arcBone(ellipse(0.41, 0.48, 0.09, 0.28, -Math.PI * 0.38, Math.PI * 0.38)); // «)»
    arcBone(ellipse(0.465, 0.48, 0.09, 0.28, -Math.PI * 0.38, Math.PI * 0.38)); // «)»

    // Bassin.
    slab(ellipse(0.655, 0.50, 0.045, 0.13));

    // Jambes écartées, genoux pliés - fémur puis tibia, en os à têtes rondes.
    bone(0.69, 0.44, 0.80, 0.32);
    bone(0.80, 0.32, 0.93, 0.40);
    bone(0.69, 0.56, 0.82, 0.64);
    bone(0.82, 0.64, 0.96, 0.56);

    // Quelques débris épars (trop petits pour un liseré).
    for (const [u, v] of [[0.57, 0.28], [0.73, 0.74], [0.45, 0.72]] as const) {
      const p = P(u, v);
      r.circle(p.x, p.y, Math.max(1, lw - 1), BONE);
    }
  };

  // Ombre portée : la silhouette entière, en sombre opaque proche du sol à
  // l'ombre, décalée vers le bas-droit - puis les os par-dessus.
  ctx.save();
  ctx.translate(Math.round(2 * sc), Math.round(3 * sc));
  paint("#2b2140");
  ctx.restore();
  paint(null);
}

/** Étoile (*) discrète au sol : petit astérisque centré sur la dale (G + corde → donjon). */
function drawClimbMark(r: Renderer, xL: number, xR: number, zN: number, zF: number): void {
  const cx = (xL + xR) / 2;
  const mz = zN + (zF - zN) * 0.5;
  const dx = (xR - xL) * 0.14;
  const dz = (zF - zN) * 0.18;
  const o  = floorPoint(cx, mz);
  const n  = floorPoint(cx, mz - dz);
  const s  = floorPoint(cx, mz + dz);
  const ne = floorPoint(cx + dx, mz - dz * 0.5);
  const sw = floorPoint(cx - dx, mz + dz * 0.5);
  const nw = floorPoint(cx - dx, mz - dz * 0.5);
  const se = floorPoint(cx + dx, mz + dz * 0.5);
  // Même encre que les indices de pièges (trapCrack) : le bleu-violet se perdait
  // dans les dalles.
  r.line(n.x, n.y, s.x, s.y, COLORS.trapCrack, 1);
  r.line(ne.x, ne.y, sw.x, sw.y, COLORS.trapCrack, 1);
  r.line(nw.x, nw.y, se.x, se.y, COLORS.trapCrack, 1);
  r.circle(o.x, o.y, 2, COLORS.trapCrack);
}

/**
 * Avertissement d'herse : trois points au sol sur la dalle où la grille tombe,
 * ALIGNÉS le long de sa ligne de chute - en profondeur pour une herse latérale
 * ("left"/"right"), en travers pour une herse frontale ("front"/"back") - posés
 * SUR le bord exact qu'elle vient barrer (à l'aplomb de la grille). Même discrétion
 * que les taches des dalles piégées : c'est l'alignement qui distingue les deux alertes.
 */
function drawHerseMark(
  r: Renderer, xL: number, xR: number, zN: number, zF: number, side: DoorSide,
): void {
  const rad = Math.max(1, Math.round(2 * scaleAt(zN)));
  const lateral = side === "left" || side === "right";

  // 5 points, aux mêmes fractions que les barreaux de la herse : une fois tombée,
  // chaque pointe se plante pile sur son point d'alerte.
  for (let b = 1; b <= 5; b++) {
    const f = b / 6;
    const p = lateral
      ? floorPoint(side === "left" ? xL : xR, zN + (zF - zN) * f)
      : floorPoint(xL + (xR - xL) * f, side === "back" ? zN : zF);
    r.circle(p.x, p.y, rad, COLORS.trapCrack);
  }
}

/** Profondeur d'une herse tombée pour le tri des entités : son bord le plus proche. */
function droppedHerseZ(herse: HerseDef, rows: number): number {
  const { herseRow: hRow, herseSide: side } = herse;
  if (side === "left" || side === "right") {
    return herse.herseRows === undefined ? 0 : zEdge(hRow, rows);
  }
  return side === "front" ? zEdge(hRow + 1, rows) : zEdge(hRow, rows);
}

/** Dessine une herse tombée.
 *  - Herse frontale ("front"/"back") : grille sur un mur horizontal (comme une porte grille).
 *  - Herse latérale ("left"/"right") : grille courant en profondeur sur un mur vertical
 *    (parallèle à la direction de profondeur), visible comme un mur latéral barreaudé.
 */
function drawDroppedHerse(r: Renderer, herse: HerseDef, cols: number, rows: number): void {
    const { herseCol: col, herseRow: hRow, herseSide: side } = herse;

    // Bas des barreaux : ils s'arrêtent à SPIKE_H et se terminent en pointe au sol.
    const SPIKE_H = 0.05;

    if (side === "left" || side === "right") {
      // Herse latérale : grille AJOURÉE courant sur la profondeur - toute la salle
      // par défaut, ou seulement `herseRows` rangées à partir de herseRow.
      const x = side === "right" ? xEdge(col + 1, cols) : xEdge(col, cols);
      const z0 = herse.herseRows === undefined ? 0 : zEdge(hRow, rows);
      const z1 = herse.herseRows === undefined ? 1 : zEdge(hRow + herse.herseRows, rows);
      // Traverse haute seule (ni bas ni montants) : on voit le décor à travers.
      const top0 = wallPoint(x, z0, 1);
      const top1 = wallPoint(x, z1, 1);
      r.line(top0.x, top0.y, top1.x, top1.y, COLORS.grilleBar, 2);
      // 5 barreaux terminés en pointe posée au sol.
      const dz = (z1 - z0) * 0.045;
      for (let b = 1; b <= 5; b++) {
        const zb = z0 + ((z1 - z0) * b) / 6;
        const lo = wallPoint(x, zb, SPIKE_H);
        const hi = wallPoint(x, zb, 1);
        r.line(lo.x, lo.y, hi.x, hi.y, COLORS.grilleBar, 2);
        r.poly(
          [wallPoint(x, zb - dz, SPIKE_H), wallPoint(x, zb + dz, SPIKE_H), wallPoint(x, zb, 0)],
          COLORS.grilleBar,
        );
      }
      // Traverses (horizontales de profondeur), à hauteurs h fixes.
      for (const frac of [0.3, 0.65]) {
        const near = wallPoint(x, z0, frac);
        const far  = wallPoint(x, z1, frac);
        r.line(near.x, near.y, far.x, far.y, COLORS.grilleBar, 2);
      }
    } else {
      // Herse frontale ("front"/"back") : grille ajourée sur un mur transversal.
      const xL = xEdge(col, cols);
      const xR = xEdge(col + 1, cols);
      const z = side === "front" ? zEdge(hRow + 1, rows) : zEdge(hRow, rows);
      // Traverse haute seule (ni bas ni montants).
      const topL = wallPoint(xL, z, 1);
      const topR = wallPoint(xR, z, 1);
      r.line(topL.x, topL.y, topR.x, topR.y, COLORS.grilleBar, 2);
      // 5 barreaux terminés en pointe posée au sol.
      const dx = (xR - xL) * 0.045;
      for (let b = 1; b <= 5; b++) {
        const xW = xL + ((xR - xL) * b) / 6;
        const lo = wallPoint(xW, z, SPIKE_H);
        r.line(lo.x, lo.y, wallPoint(xW, z, 1).x, wallPoint(xW, z, 1).y, COLORS.grilleBar, 2);
        r.poly(
          [wallPoint(xW - dx, z, SPIKE_H), wallPoint(xW + dx, z, SPIKE_H), wallPoint(xW, z, 0)],
          COLORS.grilleBar,
        );
      }
      for (const frac of [0.33, 0.67]) {
        const a = wallPoint(xL, z, frac);
        const b = wallPoint(xR, z, frac);
        r.line(a.x, a.y, b.x, b.y, COLORS.grilleBar, 2);
      }
    }
}

// --- Décors muraux (d'après les salles du jeu d'origine) --------------------

/** Dessine un décor de salle (purement visuel). */
function drawDecor(r: Renderer, room: Room, d: DecorDef): void {
  switch (d.kind) {
    case "toile":    drawSpiderWeb(r, room, d.side === "right" ? "right" : "left"); return;
    case "colonnes": drawCornerColumns(r, room); return;
    case "piliers":  drawThinPillars(r, room); return;
    default:         drawWallDecor(r, room, d);
  }
}

/**
 * Mapping (t,h) du panneau mural d'un décor, comme pour les portes.
 * `widthCells` : largeur du panneau en cases, centré sur la colonne `col`.
 * La profondeur du mur porteur est déduite du layout : face de la première
 * case bloquée de la colonne (aile), sinon mur du fond de la salle.
 */
function decorAt(room: Room, d: DecorDef, widthCells: number): (t: number, h: number) => Pt {
  const { cols, rows } = room;
  const col = d.col ?? Math.floor(cols / 2);
  if (d.side === "left" || d.side === "right") {
    const row = d.row ?? rows - 1;
    const x = d.side === "left" ? xEdge(col, cols) : xEdge(col + 1, cols);
    const zC = (zEdge(row, rows) + zEdge(row + 1, rows)) / 2;
    const halfD = ((zEdge(row + 1, rows) - zEdge(row, rows)) * widthCells) / 2;
    return (t, h) => wallPoint(x, zC - halfD + 2 * halfD * t, h);
  }
  const xC = (xEdge(col, cols) + xEdge(col + 1, cols)) / 2;
  const halfW = ((xEdge(col + 1, cols) - xEdge(col, cols)) * widthCells) / 2;
  let wallRow = rows;
  for (let rr = 0; rr < rows; rr++) {
    if (!room.isWalkable(col, rr)) { wallRow = rr; break; }
  }
  const z = zEdge(wallRow, rows);
  return (t, h) => wallPoint(xC - halfW + 2 * halfW * t, z, h);
}

/** Largeur des décors muraux, en cases. */
const DECOR_WIDTH: Record<string, number> = {
  boulet: 1, aigleNoir: 2, ecusson: 2, portrait: 2, croix: 3,
};

/** Décors muraux : boulets, écussons, cadre à croix, portrait. */
function drawWallDecor(r: Renderer, room: Room, d: DecorDef): void {
  const at = decorAt(room, d, DECOR_WIDTH[d.kind] ?? 1);
  // Unité d'échelle : hauteur écran de 0,1 de mur, au droit du décor.
  const unit = Math.abs(at(0.5, 0.5).y - at(0.5, 0.6).y);
  const ctx = r.ctx;

  switch (d.kind) {
    case "boulet": {
      // Deux chaînes de 5 maillons scellées au mur, un boulet au bout de chacune.
      for (const tc of [0.32, 0.68]) {
        ctx.strokeStyle = "#8a93a0";
        ctx.lineWidth = Math.max(1, unit * 0.065);
        for (let i = 0; i < 5; i++) {
          const h = 0.52 - 0.032 * i;
          const p = at(tc, h);
          const off = (i % 2 ? 1 : -1) * unit * 0.05; // maillons en quinconce
          ctx.beginPath();
          ctx.arc(p.x + off, p.y, Math.max(1.5, unit * 0.1), 0, Math.PI * 2);
          ctx.stroke();
        }
        const bp = at(tc, 0.34);
        const rad = Math.max(2.5, unit * 0.3);
        r.circle(bp.x, bp.y, rad, "#6a7280");
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, rad, 0, Math.PI * 2);
        ctx.strokeStyle = "#3a3f48";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      return;
    }
    case "aigleNoir": {
      // Écusson clair frappé d'un aigle noir (borné à l'écu, contour par-dessus).
      const pts = shieldPts(at, 0.08, 0.92, 0.28, 0.56);
      r.poly(pts, COLORS.fireStoneCrest);
      clipPoly(ctx, pts);
      const c = at(0.5, 0.45);
      const w = at(0.92, 0.45).x - at(0.08, 0.45).x;
      drawEagle(r, c.x, c.y, Math.abs(w) * 0.42, "#221a2c", "#0e0a16");
      ctx.restore();
      strokePoly(ctx, pts, "#2a2038", 2);
      // Bordure : un second tour concentrique, en retrait à l'intérieur de l'écu.
      strokePoly(ctx, shieldPts(at, 0.14, 0.86, 0.305, 0.535), "#2a2038", 1);
      return;
    }
    case "ecusson": {
      // Armoirie : chef hachuré + bande diagonale, bornés à l'écu, contour par-dessus.
      const pts = shieldPts(at, 0.1, 0.9, 0.28, 0.56);
      r.poly(pts, COLORS.fireStoneCrest);
      clipPoly(ctx, pts);
      for (let t = 0.12; t < 0.86; t += 0.07) {
        const a = at(t, 0.5);
        const b = at(t + 0.05, 0.548);
        r.line(a.x, a.y, b.x, b.y, "#2a2038", 1);
      }
      const l = at(0.1, 0.5);
      const rr = at(0.9, 0.5);
      r.line(l.x, l.y, rr.x, rr.y, "#2a2038", 1.5); // trait du chef
      r.poly([at(0.24, 0.5), at(0.4, 0.5), at(0.76, 0.31), at(0.6, 0.31)], "#3a2e50"); // bande
      const loz = at(0.68, 0.45);
      r.circle(loz.x, loz.y, Math.max(1.5, unit * 0.12), "#3a2e50"); // meuble
      ctx.restore();
      strokePoly(ctx, pts, "#2a2038", 2);
      return;
    }
    case "croix": {
      // Cadre sombre, croix dorée.
      r.poly([at(0.04, 0.28), at(0.96, 0.28), at(0.96, 0.64), at(0.04, 0.64)], "#1c1428", "#8a86a0", 2);
      r.poly([at(0.46, 0.325), at(0.54, 0.325), at(0.54, 0.6), at(0.46, 0.6)], "#d9b24a", "#8a6c20", 1);
      r.poly([at(0.32, 0.485), at(0.68, 0.485), at(0.68, 0.535), at(0.32, 0.535)], "#d9b24a", "#8a6c20", 1);
      return;
    }
    case "portrait": {
      // Portrait de famille : cadre doré, buste sur fond sombre.
      r.poly([at(0.08, 0.28), at(0.92, 0.28), at(0.92, 0.56), at(0.08, 0.56)], "#241b30", "#b8923a", 2);
      const hc = at(0.5, 0.46);
      // épaules
      r.poly([at(0.3, 0.29), at(0.7, 0.29), at(0.62, 0.39), at(0.38, 0.39)], "#2f3f78");
      // tête + chevelure
      ctx.beginPath();
      ctx.ellipse(hc.x, hc.y, Math.max(2, unit * 0.28), Math.max(3, unit * 0.34), 0, 0, Math.PI * 2);
      ctx.fillStyle = "#d8ac86";
      ctx.fill();
      const hairY = at(0.5, 0.49).y;
      ctx.beginPath();
      ctx.ellipse(hc.x, hairY, Math.max(2, unit * 0.3), Math.max(2, unit * 0.17), 0, 0, Math.PI * 2);
      ctx.fillStyle = "#4a3220";
      ctx.fill();
      return;
    }
  }
}

/** save() + clip sur un polygone (à refermer par ctx.restore()). */
function clipPoly(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();
}

/** Contour d'un polygone fermé. */
function strokePoly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string, width: number): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Contour d'écusson : épaules droites, flancs qui rentrent, pointe en bas. */
function shieldPts(at: (t: number, h: number) => Pt, t0: number, t1: number, h0: number, h1: number): Pt[] {
  const mid = (t0 + t1) / 2;
  return [
    at(t0, h1), at(t1, h1),
    at(t1, h0 + (h1 - h0) * 0.42),
    at(mid + (t1 - mid) * 0.55, h0 + (h1 - h0) * 0.14),
    at(mid, h0),
    at(mid - (mid - t0) * 0.55, h0 + (h1 - h0) * 0.14),
    at(t0, h0 + (h1 - h0) * 0.42),
  ];
}

/** Toile d'araignée dans l'angle du plafond au premier plan (si l'angle est libre). */
function drawSpiderWeb(r: Renderer, room: Room, side: "left" | "right"): void {
  if (room.torches.some((t) => t.side === side)) return; // la torche occupe l'angle
  const ctx = r.ctx;
  const sx = side === "left" ? 0 : VIEW_W;
  const dir = side === "left" ? 1 : -1;
  const R = 95;
  // Ancres de la toile : les deux bords perpendiculaires de l'écran (haut et côté)
  // servent d'attaches aux fils en travers, mais ne sont PAS tracés - seuls les
  // rayons intermédiaires de l'éventail le sont.
  const spokes: [number, number][] = [[R, 0], [R * 0.82, R * 0.45], [R * 0.45, R * 0.82], [0, R]];
  ctx.strokeStyle = "#8f8aa0";
  ctx.lineWidth = 1;
  for (const [dx, dy] of spokes.slice(1, -1)) {
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx + dir * dx, dy);
    ctx.stroke();
  }
  for (const f of [0.45, 0.78]) {
    ctx.beginPath();
    spokes.forEach(([dx, dy], i) => {
      // léger ventre entre deux rayons : le fil pend
      const px = sx + dir * dx * f;
      const py = dy * f;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.quadraticCurveTo(sx + dir * (dx + 14) * f, (dy + 14) * f, px, py);
    });
    ctx.stroke();
  }
}

/**
 * Deux grosses colonnes cannelées aux angles du mur du fond : 2 cases de large,
 * le bord extérieur du FÛT posé exactement sur l'angle des deux murs. Les éléments
 * plus larges (socle, chapiteau) débordent symétriquement - y compris au-delà de
 * l'angle : la perspective s'en charge.
 */
function drawCornerColumns(r: Renderer, room: Room): void {
  const { cols, rows } = room;
  const z = zEdge(rows, rows);
  const W = (xEdge(1, cols) - xEdge(0, cols)) * 2; // largeur du fût : 2 cases
  for (const [x0, dir] of [[xEdge(0, cols), 1], [xEdge(cols, cols), -1]] as [number, number][]) {
    const cx = x0 + (dir * W) / 2; // axe : le fût (f=1) touche l'angle en x0
    const quad = (f: number, h0: number, h1: number, fill: string): void =>
      r.poly(
        [wallPoint(cx - (W * f) / 2, z, h0), wallPoint(cx + (W * f) / 2, z, h0),
         wallPoint(cx + (W * f) / 2, z, h1), wallPoint(cx - (W * f) / 2, z, h1)],
        fill, COLORS.fireSeam, 1,
      );
    quad(1.15, 0, 0.04, COLORS.fireStoneLight);    // socle
    quad(1.05, 0.04, 0.08, COLORS.fireStone);
    quad(1.0, 0.08, 0.87, COLORS.fireStone);       // fût
    for (const f of [-0.25, 0, 0.25]) {            // cannelures
      const a = wallPoint(cx + W * f, z, 0.08);
      const b = wallPoint(cx + W * f, z, 0.87);
      r.line(a.x, a.y, b.x, b.y, COLORS.fireSeam, 1);
    }
    quad(1.05, 0.87, 0.91, COLORS.fireStone);      // gorgerin
    quad(1.12, 0.91, 0.96, COLORS.fireStoneLight); // échine
    quad(1.2, 0.96, 1, COLORS.fireStoneCrest);     // abaque
  }
}

/** Six piliers fins régulièrement espacés sur le mur du fond (cases 1, 4, 7, 10, 13, 16). */
function drawThinPillars(r: Renderer, room: Room): void {
  const { cols, rows } = room;
  const z = zEdge(rows, rows);
  for (const c of [0, 3, 6, 9, 12, 15]) {
    if (c >= cols) continue;
    const cx = (xEdge(c, cols) + xEdge(c + 1, cols)) / 2;
    // Fût large d'une case entière - comme une pierre du mur du fond ou une dalle.
    const halfW = (xEdge(c + 1, cols) - xEdge(c, cols)) * 0.5;
    const quad = (f: number, h0: number, h1: number, fill: string): void =>
      r.poly(
        [wallPoint(cx - halfW * f, z, h0), wallPoint(cx + halfW * f, z, h0),
         wallPoint(cx + halfW * f, z, h1), wallPoint(cx - halfW * f, z, h1)],
        fill, COLORS.fireSeam, 1,
      );
    quad(1.15, 0, 0.035, COLORS.fireStoneLight);  // socle
    quad(1.0, 0.035, 0.945, COLORS.fireStone);    // fût
    quad(1.15, 0.945, 0.98, COLORS.fireStoneLight); // chapiteau
    quad(1.25, 0.98, 1, COLORS.fireStoneCrest);   // abaque
  }
}

// --- Portes ----------------------------------------------------------------

/** Hauteur du sommet voûté pour un travers t∈[0,1], paramétrée par la base et la surélévation. */
function archHeight(t: number, top: number, rise: number): number {
  return Math.min(1, top + rise * Math.sin(Math.PI * t));
}

/** Polygone d'une ouverture à sommet arrondi (voûte), paramétrable. `at(t,h)` : t∈[0,1] travers, h∈[0,1] hauteur. */
function archedOpeningParams(at: (t: number, h: number) => Pt, top: number, rise: number): Pt[] {
  const pts: Pt[] = [at(0, 0), at(1, 0)]; // base
  const N = 7;
  for (let i = 0; i <= N; i++) {
    const t = 1 - i / N;
    pts.push(at(t, archHeight(t, top, rise)));
  }
  return pts;
}

/** Polygone d'une ouverture à sommet arrondi (voûte). `at(t,h)` : t∈[0,1] travers, h∈[0,1] hauteur. */
function archedOpening(at: (t: number, h: number) => Pt): Pt[] {
  return archedOpeningParams(at, DOOR_TOP, ARCH_RISE);
}

// --- Encadrement en pierres apparentes (modèle de l'arche d'origine) --------

/** Épaisseur des pierres de l'encadrement : en travers (fraction de la largeur de la
 *  porte) et en hauteur (fraction de la hauteur du mur). */
const STONE_T = 0.16;
const STONE_H = 0.065;

/**
 * Encadrement d'ouverture en pierres apparentes, d'après l'arche d'origine (MO5) :
 * 6 pierres superposées par montant, 3 voussoirs de chaque côté et une clé de voûte
 * plus large et plus claire, le tout légèrement piqueté. Décrit dans le plan de la
 * porte via `at(t,h)` - la perspective suit pour les portes latérales.
 */
function drawStoneSurround(r: Renderer, at: (t: number, h: number) => Pt): void {
  let idx = 0;
  // Une pierre : quad + 3 grains de piquetage déterministes (stables d'une frame à l'autre).
  const stone = (p: Pt[], t0: number, t1: number, h0: number, h1: number, fill: string): void => {
    r.poly(p, fill, COLORS.fireSeam, 1);
    const k = idx++;
    for (let d = 0; d < 3; d++) {
      const u = 0.2 + 0.6 * (((k * 37 + d * 61) % 89) / 89);
      const v = 0.2 + 0.6 * (((k * 53 + d * 29) % 97) / 97);
      const g = at(t0 + u * (t1 - t0), h0 + v * (h1 - h0));
      r.circle(g.x, g.y, 1, COLORS.fireSeam);
    }
  };

  // Montants : 6 pierres de chaque côté, plaquées à l'extérieur de l'ouverture.
  for (const [tIn, tOut] of [[0, -STONE_T], [1, 1 + STONE_T]] as [number, number][]) {
    for (let i = 0; i < 6; i++) {
      const h0 = (i * DOOR_TOP) / 6;
      const h1 = ((i + 1) * DOOR_TOP) / 6;
      stone(
        [at(tIn, h0), at(tOut, h0), at(tOut, h1), at(tIn, h1)],
        Math.min(tIn, tOut), Math.max(tIn, tOut), h0, h1, COLORS.fireStone,
      );
    }
  }

  // Voûte : 3 voussoirs de chaque côté posés sur la courbe, puis la clé au centre.
  const hIn = (t: number): number => archHeight(Math.min(1, Math.max(0, t)), DOOR_TOP, ARCH_RISE);
  const KEY = 0.11; // demi-largeur de la clé de voûte
  for (let i = 0; i < 3; i++) {
    const t0 = -STONE_T + (i * (0.5 - KEY + STONE_T)) / 3;
    const t1 = -STONE_T + ((i + 1) * (0.5 - KEY + STONE_T)) / 3;
    for (const [a0, a1] of [[t0, t1], [1 - t1, 1 - t0]] as [number, number][]) {
      stone(
        [at(a0, hIn(a0)), at(a1, hIn(a1)), at(a1, hIn(a1) + STONE_H), at(a0, hIn(a0) + STONE_H)],
        a0, a1, hIn((a0 + a1) / 2), hIn((a0 + a1) / 2) + STONE_H, COLORS.fireStone,
      );
    }
  }
  // Clé de voûte : plus large, à sommet plat, en pierre claire (comme l'original).
  const kTop = hIn(0.5) + STONE_H * 1.5;
  stone(
    [at(0.5 - KEY, hIn(0.5 - KEY)), at(0.5 + KEY, hIn(0.5 + KEY)), at(0.5 + KEY, kTop), at(0.5 - KEY, kTop)],
    0.5 - KEY, 0.5 + KEY, hIn(0.5), kTop, COLORS.fireStoneLight,
  );
}

/**
 * Vantail en bois : 4 planches verticales (joints jusqu'à la courbe de la voûte)
 * et deux veines discrètes par planche, légèrement galbées, décalées en hauteur
 * une planche sur deux pour casser la répétition.
 */
function drawWoodPlanks(r: Renderer, at: (t: number, h: number) => Pt): void {
  for (const t of [0.25, 0.5, 0.75]) {
    const lo = at(t, 0);
    const hi = at(t, archHeight(t, DOOR_TOP, ARCH_RISE));
    r.line(lo.x, lo.y, hi.x, hi.y, COLORS.doorWoodFrame, 2);
  }
  if (isLegacy()) return; // les veinures sont une fioriture : quatre planches suffisent
  const ctx = r.ctx;
  ctx.strokeStyle = "#59331b"; // nervures : brun à peine plus sombre que la planche
  ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    const off = (k % 2) * 0.07;
    for (const [dt, h0, h1] of [[0.08, 0.07, 0.22], [0.16, 0.32, 0.47]] as [number, number, number][]) {
      const t = k * 0.25 + dt;
      const a = at(t, h0 + off);
      const m = at(t + 0.025, (h0 + h1) / 2 + off); // la veine s'écarte au milieu
      const b = at(t, h1 + off);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
      ctx.stroke();
    }
  }
}

/**
 * Feu de bois dans le foyer : bûches, braises et langues de flamme.
 * Dessiné en coordonnées écran (les flammes ne suivent pas la grille du mur), mais
 * borné au rectangle du foyer par un clip pour ne déborder ni sur les colonnes ni
 * sous le linteau.
 */
function drawHearthFire(
  r: Renderer, at: (t: number, h: number) => Pt,
  tL: number, tR: number, hTop: number, z: number,
): void {
  const bl = at(tL, 0);
  const br = at(tR, 0);
  const tl = at(tL, hTop);
  const w  = br.x - bl.x;
  const h  = bl.y - tl.y;
  const s  = scaleAt(z);
  const cx = (bl.x + br.x) / 2;
  const by = bl.y;

  const ctx = r.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bl.x, tl.y, w, h);
  ctx.clip();

  // Lueur qui remonte du foyer et éclaire le fond de l'âtre.
  const g = ctx.createRadialGradient(cx, by, 0, cx, by, w * 1.1);
  g.addColorStop(0, "rgba(255,170,60,0.60)");
  g.addColorStop(1, "rgba(255,110,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(bl.x, tl.y, w, h);

  // Bûches empilées, puis lit de braises par-dessus.
  const logH = Math.max(2, Math.round(4 * s));
  r.rect({ x: bl.x + w * 0.08, y: by - logH, w: w * 0.84, h: logH }, COLORS.doorWoodFrame);
  r.rect({ x: bl.x + w * 0.20, y: by - logH * 2, w: w * 0.60, h: logH }, COLORS.doorWood);
  r.rect({ x: bl.x + w * 0.16, y: by - logH * 2.5, w: w * 0.68, h: Math.max(1, logH * 0.5) }, COLORS.flameOuter);

  // Trois langues de flamme, d'amplitude et de phase différentes : la centrale
  // est la plus haute, les latérales vacillent en décalé. Volontairement larges et
  // basses - le foyer est étroit et haut, des flammes élancées y feraient des pics.
  const now  = Date.now() / 90;
  const foot = by - logH * 2;
  for (let i = 0; i < 3; i++) {
    const fx    = cx + (i - 1) * w * 0.20;
    const flick = 1 + 0.22 * Math.sin(now + i * 2.1);
    const fh    = h * (i === 1 ? 0.40 : 0.27) * flick;
    const hw    = w * (i === 1 ? 0.26 : 0.20);
    r.poly(
      [{ x: fx, y: foot - fh }, { x: fx + hw, y: foot }, { x: fx - hw, y: foot }],
      COLORS.flameOuter,
    );
    r.poly(
      [{ x: fx, y: foot - fh * 0.55 }, { x: fx + hw * 0.5, y: foot }, { x: fx - hw * 0.5, y: foot }],
      COLORS.flameInner,
    );
  }
  ctx.restore();
}

/**
 * Passage derrière une cheminée ouverte : le sol d'un couloir qui s'enfonce, tracé
 * comme dans le jeu d'origine (cf. asset_legacy/cheminé.png) - deux traits partant
 * des angles bas du foyer, fuyant vers l'horizon, fermés par le bord lointain.
 *
 * La fuite est prise sur l'AXE DU FOYER et non sur le point de fuite global de la
 * salle : dans l'original la cheminée est centrée à l'écran, les deux revenant alors
 * au même. Nos cheminées sont excentrées ; viser le point de fuite global y couche le
 * couloir de biais et le fait sortir de l'ouverture aussitôt (on ne verrait qu'un
 * trait). Le motif symétrique reste lisible où que soit la cheminée.
 */
function drawHearthPassage(
  r: Renderer, at: (t: number, h: number) => Pt, tL: number, tR: number, hTop: number,
): void {
  // L'original resserre de 15 % par côté sur 30 % de hauteur - mais son foyer est
  // presque carré, alors que le nôtre est étroit et haut : à proportions égales les
  // traits y tombent à ~9° de la verticale, quand le sol des murs latéraux fuit à
  // ~50°. On ouvre donc l'angle (resserrement plus fort, couloir plus court) pour
  // raccorder la fuite du couloir à celle de la salle.
  const RISE  = 0.22;
  const INSET = 0.30;
  const w   = tR - tL;
  const col = shade(COLORS.frameStone, 0.35);

  const bl = at(tL, 0);
  const br = at(tR, 0);
  const fl = at(tL + w * INSET, hTop * RISE);
  const fr = at(tR - w * INSET, hTop * RISE);

  r.line(bl.x, bl.y, fl.x, fl.y, col, 1); // bord gauche du couloir
  r.line(br.x, br.y, fr.x, fr.y, col, 1); // bord droit
  r.line(fl.x, fl.y, fr.x, fr.y, col, 1); // pied du fond, où le sol disparaît
}

/**
 * Blason à l'aigle, à cheval sur le linteau et le mur du fond : écu de pierre à
 * l'antique - sommet plat, flancs droits, puis pointe arrondie vers le bas - et
 * aigle doré au centre. Reprend le drawEagle des statues/objets pour que ce soit le
 * même oiseau partout dans le jeu.
 *
 * Le contour est décrit en coordonnées locales (u en travers, v du bas vers le haut)
 * puis projeté par `at` : l'écu est un panneau plat à z constant, la projection y est
 * affine, donc la forme se conserve.
 */
function drawFireplaceCrest(
  r: Renderer, at: (t: number, h: number) => Pt, hLo: number, hHi: number,
  stone: string, seam: string,
): void {
  const T_LO = 0.37, T_HI = 0.63; // écu centré, un peu moins large qu'une case
  const SHOULDER = 0.42;          // hauteur où les flancs cèdent la place à la pointe
  const N = 10;

  const pt = (u: number, v: number): Pt => at(T_LO + (T_HI - T_LO) * u, hLo + (hHi - hLo) * v);
  const pts: Pt[] = [pt(0, 1), pt(1, 1), pt(1, SHOULDER)];
  // Quart d'ellipse de (1, SHOULDER) à la pointe (0.5, 0), puis miroir à gauche.
  for (let i = 1; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2);
    pts.push(pt(0.5 + 0.5 * Math.cos(a), SHOULDER * (1 - Math.sin(a))));
  }
  for (let i = N - 1; i >= 0; i--) {
    const a = (i / N) * (Math.PI / 2);
    pts.push(pt(0.5 - 0.5 * Math.cos(a), SHOULDER * (1 - Math.sin(a))));
  }
  r.poly(pts, stone, seam, 1);

  // Aigle dans le champ de l'écu, au-dessus de la pointe.
  const c  = pt(0.5, 0.56);
  const sw = pt(1, 1).x - pt(0, 1).x;
  // 0.86 : les ailes de drawEagle s'étendent à ±0.55·s, elles frôlent alors les
  // flancs de l'écu sans les déborder.
  drawEagle(r, c.x, c.y, sw * 0.86, COLORS.eagle, "#a8861f");
}

/** Cheminée sur le mur du fond : 3 cases (col-1, col, col+1).
 *  Architecture en pierre de taille : 2 colonnes cannelées encadrant le foyer,
 *  le tout coiffé d'un linteau monolithique qui couvre TOUTE la largeur.
 *  La pierre n'est que peu assombrie par la profondeur : comme l'encadrement des
 *  portes, la cheminée doit se détacher du mur du fond (très sombre).
 *  Secret : montant gauche = cercle plein doré. Ouvert : foyer lumineux. */
function drawFireplace(r: Renderer, fp: Fireplace, cols: number, rows: number): void {
  const z    = zEdge(fp.row + 1, rows);
  const xA   = xEdge(Math.max(0, fp.col - 1), cols);
  const xB   = xEdge(Math.min(cols, fp.col + 2), cols);
  const W    = xB - xA;
  const at   = (t: number, h: number): Pt => wallPoint(xA + W * t, z, h);
  const T    = 1 / 3;   // chaque tiers = 1 case

  // Gabarit : jambages et foyer h=0→LINTEL_BOT, linteau pleine largeur au-dessus.
  const LINTEL_BOT = 0.34;
  const LINTEL_TOP = 0.44;

  const fog     = z * 0.35;
  const S_JAMB  = shade(COLORS.fireStone, fog);
  const S_BACK  = shade(COLORS.fireStoneDark, fog);
  const S_LINT  = shade(COLORS.fireStoneLight, fog);
  const S_CREST = shade(COLORS.fireStoneCrest, fog);
  const S_SEAM  = shade(COLORS.fireSeam, fog);
  const S_HOLE  = shade(COLORS.fireHole, fog);
  // Ouvert : l'âtre est un couloir qui s'enfonce, à peine plus clair que le noir du
  // foyer éteint pour que les traits de fuite s'y détachent.
  const HEARTH  = fp.opened ? "#0d0a12" : "#040208";

  // 1. Fond pierre limité au gabarit (sol → sous le linteau)
  r.poly([at(0, 0), at(1, 0), at(1, LINTEL_BOT), at(0, LINTEL_BOT)], S_BACK, S_SEAM, 1);

  // 2. Colonnes gauche et droite (sol → sous le linteau) : fût lisse, cannelé de
  //    traits fins qui courent sur toute la hauteur - pas d'assises, c'est un
  //    monolithe et non un mur appareillé.
  const FLUTES = 2;
  for (const [tLo, tHi] of [[0, T], [2 * T, 1]]) {
    r.poly([at(tLo, 0), at(tHi, 0), at(tHi, LINTEL_BOT), at(tLo, LINTEL_BOT)], S_JAMB, S_SEAM, 1);
    for (let i = 1; i <= FLUTES; i++) {
      const t = tLo + ((tHi - tLo) * i) / (FLUTES + 1);
      const lo = at(t, 0);
      const hi = at(t, LINTEL_BOT);
      r.line(lo.x, lo.y, hi.x, hi.y, S_SEAM, 1);
    }
  }

  // 3. Foyer (ouverture centrale, sol → sous le linteau)
  const ftL = T + 0.02;
  const ftR = 2 * T - 0.02;
  r.poly([at(ftL, 0), at(ftR, 0), at(ftR, LINTEL_BOT), at(ftL, LINTEL_BOT)], HEARTH, S_SEAM, 1);

  // 3 bis. Le feu brûle tant que le passage secret n'a pas été ouvert à la clé en or
  // (openFireplace pose fp.opened) : une fois la cheminée entrouverte, l'âtre est
  // froid et dégagé, et le foyer devient le passage.
  if (!fp.opened) drawHearthFire(r, at, ftL, ftR, LINTEL_BOT, z);

  // 4. Linteau : une seule pierre en travers de toute la cheminée (pas de joint
  //    vertical), posée sur les deux jambages et franchissant le foyer.
  r.poly(
    [at(0, LINTEL_BOT), at(1, LINTEL_BOT), at(1, LINTEL_TOP), at(0, LINTEL_TOP)],
    S_LINT, S_SEAM, 1,
  );

  // 5. Trou creusé dans chaque colonne, en gris foncé - celui de gauche est la
  //    serrure : plein si la cheminée cache un passage secret.
  const sc  = scaleAt(z);
  const rad = Math.max(2, Math.round(sc * 9));
  for (const [tC, filled] of [[T / 2, fp.secret], [1 - T / 2, false]] as [number, boolean][]) {
    const cp = at(tC, 0.17);
    r.circle(cp.x, cp.y, rad, S_HOLE);
    if (!filled) r.circle(cp.x, cp.y, Math.max(1, rad - 2), S_JAMB);
  }

  // 6. Blason à l'aigle (cf. la cheminée d'origine) : sa pointe mord sur le linteau,
  //    son champ déborde au-dessus, sur le mur du fond.
  drawFireplaceCrest(r, at, LINTEL_TOP - 0.045, LINTEL_TOP + 0.10, S_CREST, S_SEAM);

  // 7. Ouvert : le passage se révèle au sol du foyer.
  if (fp.opened) drawHearthPassage(r, at, ftL, ftR, LINTEL_BOT);
}

function drawDoor(r: Renderer, door: Door, cols: number, rows: number): void {
  const xL = xEdge(door.col, cols);
  const xR = xEdge(door.col + 1, cols);
  const zN = zEdge(door.row, rows);
  const zF = zEdge(door.row + 1, rows);

  if (door.side === "back") {
    const a = floorPoint(xL + (xR - xL) * 0.25, zN);
    const b = floorPoint(xR - (xR - xL) * 0.25, zN);
    r.line(a.x, a.y, b.x, b.y, COLORS.doorWoodFrame, 3);
    return;
  }

  // Mapping (t, h) de l'ouverture sur le bon mur.
  let at: (t: number, h: number) => Pt;
  if (door.side === "front") {
    // Porte du mur du fond : 3 cases de large, centrée (effet visuel ; on ne la passe
    // qu'au centre). Bornée à la salle.
    const xA = xEdge(Math.max(0, door.col - 1), cols);
    const xB = xEdge(Math.min(cols, door.col + 2), cols);
    const ins = (xB - xA) * 0.06;
    at = (t, h) => wallPoint(xA + ins + (xB - xA - 2 * ins) * t, zF, h);
  } else {
    const x = door.side === "left" ? xL : xR;
    const a = zN + (zF - zN) * DOOR_INSET;
    const b = zF - (zF - zN) * DOOR_INSET;
    at = (t, h) => wallPoint(x, a + (b - a) * t, h);
  }
  const pts = archedOpening(at);

  if (door.arch) {
    // Arche : ouverture remplie de noir, encadrement en pierres apparentes.
    if (door.side === "left" || door.side === "right") {
      // Perspective du passage : le noir s'arrête au seuil horizontal (pied du montant
      // du fond, le plus haut à l'écran) ; le triangle en dessous, jusqu'au pied du
      // montant du premier plan, est pavé comme le sol (pas d'hypoténuse).
      const nearFoot = at(0, 0);
      const farFoot = at(1, 0);
      drawArchFloorPatch(r, rows, [{ x: nearFoot.x, y: farFoot.y }, farFoot, nearFoot]);
      const opening = [{ x: nearFoot.x, y: farFoot.y }, farFoot, ...pts.slice(2)];
      r.poly(opening, "#000000");
      r.line(nearFoot.x, farFoot.y, farFoot.x, farFoot.y, COLORS.fireSeam, 2); // seuil
    } else {
      // Mur du fond : pas de trait au sol, le pavage bute directement sur le noir.
      r.poly(pts, "#000000");
    }
    drawStoneSurround(r, at);
    return;
  }
  if (door.exit) {
    // Porte principale : mêmes planches veinées que les portes en bois, mais avec
    // son caractère d'entrée - cadre doré (par-dessus les planches) et clous dorés.
    r.poly(pts, COLORS.doorWood);
    drawWoodPlanks(r, at);
    // Clous dorés : au centre des deux planches du milieu (pas sur les joints).
    for (const t of [0.375, 0.625]) {
      for (const h of [0.16, 0.34, 0.5]) {
        const p = at(t, h);
        r.circle(p.x, p.y, Math.max(1.5, (zF < 0.5 ? 3 : 2)), "#d9b24a");
      }
    }
    // Encadrement en pierres, puis liseré doré par-dessus l'about des planches :
    // la porte d'entrée garde son caractère (or + clous) sous l'appareillage commun.
    // Le liseré suit montants et voûte, sans trait au sol.
    drawStoneSurround(r, at);
    const ctx = r.ctx;
    ctx.beginPath();
    ctx.moveTo(pts[1].x, pts[1].y); // pied du montant droit
    for (const p of pts.slice(2)) ctx.lineTo(p.x, p.y); // montant droit, voûte
    ctx.lineTo(pts[0].x, pts[0].y); // montant gauche jusqu'au sol
    ctx.strokeStyle = "#b8923a";
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }
  if (door.grille) {
    // Grille d'acier : fond sombre + barreaux verticaux, encadrement en pierres.
    // Même perspective que les arches : le dallage se voit à travers, sous le seuil.
    if (door.side === "left" || door.side === "right") {
      const nearFoot = at(0, 0);
      const farFoot = at(1, 0);
      drawArchFloorPatch(r, rows, [{ x: nearFoot.x, y: farFoot.y }, farFoot, nearFoot]);
      const opening = [{ x: nearFoot.x, y: farFoot.y }, farFoot, ...pts.slice(2)];
      r.poly(opening, COLORS.grilleBack);
      r.line(nearFoot.x, farFoot.y, farFoot.x, farFoot.y, COLORS.fireSeam, 2); // seuil
    } else {
      // Mur du fond : pas de trait au sol.
      r.poly(pts, COLORS.grilleBack);
    }
    drawStoneSurround(r, at);
    // Barreaux : du sol (dans le plan du mur) à la voûte, devant le dallage.
    const N = 6;
    // Traverses : deux barres horizontales sur toute la largeur de la porte, à 1/3 et
    // 2/3 de hauteur - tracées dans le plan de la grille, elles suivent le point de fuite.
    for (const f of [1 / 3, 2 / 3]) {
      const a = at(0.1, DOOR_TOP * f);
      const b = at(0.9, DOOR_TOP * f);
      r.line(a.x, a.y, b.x, b.y, COLORS.grilleBar, 2);
    }
    for (let i = 1; i < N; i++) {
      const t = i / N;
      const lo = at(t, 0);
      // Le barreau monte jusqu'à la courbe de l'arche (et non plus à plat à DOOR_TOP).
      const hi = at(t, archHeight(t, DOOR_TOP, ARCH_RISE));
      r.line(lo.x, lo.y, hi.x, hi.y, COLORS.grilleBar, 2);
      // Point d'ancrage au pied de chaque barreau.
      r.circle(lo.x, lo.y, zF < 0.5 ? 3 : 2, COLORS.grilleBar);
    }
  } else {
    // Porte en bois : 4 planches verticales veinées, gonds et poignée,
    // encadrement en pierres apparentes.
    r.poly(pts, COLORS.doorWood, COLORS.doorWoodFrame, 1);
    drawWoodPlanks(r, at);
    drawStoneSurround(r, at);
    // Gonds en fer sombre à gauche.
    const iron = "#3a2a22";
    for (const h of [0.16, 0.43]) {
      const gpts = [at(0.04, h - 0.045), at(0.19, h - 0.045), at(0.19, h + 0.045), at(0.04, h + 0.045)];
      r.poly(gpts, iron, "#1e1210", 1);
    }
    // Poignée ronde à droite.
    const hc = at(0.8, 0.30);
    const hr = zF < 0.5 ? 5 : 3;
    r.circle(hc.x, hc.y, hr, "#1e100c");
  }
}

// --- Chauve-souris ---------------------------------------------------------

/** Silhouette de chauve-souris au plafond, ailes battantes. */
function drawBat(r: Renderer, bat: Bat): void {
  const pos = wallPoint(bat.x, bat.z, bat.heightFrac);
  const s = scaleAt(bat.z);
  const bx = pos.x;
  const by = pos.y;
  const flapAngle = Math.abs(Math.sin(Date.now() / 80));
  const w = 44 * s;
  const h = 18 * s;
  const fill   = "#7a2818";
  const edge   = "#c06040";
  const tipY = by - h * (0.25 + flapAngle * 0.65);

  // Aile gauche
  r.poly([
    { x: bx, y: by },
    { x: bx - w, y: tipY },
    { x: bx - w * 0.55, y: by + h * 0.22 },
  ], fill, edge, 1);
  // Aile droite
  r.poly([
    { x: bx, y: by },
    { x: bx + w, y: tipY },
    { x: bx + w * 0.55, y: by + h * 0.22 },
  ], fill, edge, 1);
  // Corps
  r.ctx.fillStyle = fill;
  r.ctx.strokeStyle = edge;
  r.ctx.lineWidth = 1;
  r.ctx.beginPath();
  r.ctx.ellipse(bx, by, Math.max(2, h * 0.30), Math.max(2, h * 0.50), 0, 0, Math.PI * 2);
  r.ctx.fill();
  r.ctx.stroke();
}

// --- Fantôme ---------------------------------------------------------------

/** Corps spectral flottant, yeux rouges, queue en trois pointes. */
function drawGhost(r: Renderer, ghost: Ghost): void {
  const s     = scaleAt(ghost.z);
  const feet  = floorPoint(ghost.x, ghost.z);
  const bx    = feet.x;
  const float = Math.sin(ghost.floatT * 1.8) * 8 * s;
  const bH    = HERO_BASE_H * s;
  const w     = HERO_BASE_W * s * 1.15;   // plus large

  // Plus haut au-dessus du sol
  const bodyBottom = feet.y - bH * 0.38 + float;
  const bodyTop    = bodyBottom - bH * 0.70;  // plus grand
  const headCy     = bodyTop + bH * 0.10;

  const pale = "#c8dcff";
  const core = "#8ab0e8";

  // Aura semi-transparente
  r.ctx.fillStyle = "rgba(140,180,255,0.10)";
  r.ctx.beginPath();
  r.ctx.ellipse(bx, (bodyTop + bodyBottom) / 2, w * 1.6, bH * 0.50, 0, 0, Math.PI * 2);
  r.ctx.fill();

  // Corps (trapèze, plus large en bas)
  r.poly([
    { x: bx - w * 0.18, y: bodyTop    + bH * 0.16 },
    { x: bx + w * 0.18, y: bodyTop    + bH * 0.16 },
    { x: bx + w * 0.36, y: bodyBottom - bH * 0.10 },
    { x: bx - w * 0.36, y: bodyBottom - bH * 0.10 },
  ], pale, core, 1);

  // Trois pointes en bas (queue de fantôme)
  const tailY = bodyBottom - bH * 0.10;
  for (const dx of [-w * 0.28, 0, w * 0.28]) {
    r.poly([
      { x: bx + dx - w * 0.10, y: tailY },
      { x: bx + dx + w * 0.10, y: tailY },
      { x: bx + dx,            y: tailY + bH * 0.16 },
    ], pale, core, 1);
  }

  // Tête
  r.circle(bx, headCy, w * 0.22, pale);
  // Yeux rouges brillants
  const eyeR = Math.max(2, w * 0.07);
  r.circle(bx - w * 0.08, headCy, eyeR, "#e03030");
  r.circle(bx + w * 0.08, headCy, eyeR, "#e03030");
}

const BOLT_H_FRAC = 0.50;  // hauteur du faisceau (fraction du mur)

/** Éclair lancé par le fantôme : rouge (normal) ou jaune (renvoyé).
 *  Faisceau depuis le fantôme + tête en forme de Z. */
function drawGhostBolt(r: Renderer, ghost: Ghost): void {
  const s       = scaleAt(ghost.z);
  const headPos = wallPoint(ghost.boltX, ghost.z, BOLT_H_FRAC);
  const bx      = headPos.x;
  const by      = headPos.y;
  const color   = ghost.boltDeflected ? "#ffd060" : "#e02020";
  const glow    = ghost.boltDeflected ? "rgba(255,220,60,0.35)" : "rgba(220,40,40,0.35)";
  const bw      = 12 * s;
  const bh      = 16 * s;

  // Halo autour de la tête
  r.ctx.fillStyle = glow;
  r.ctx.beginPath();
  r.ctx.ellipse(bx, by, bw * 1.6, bw * 1.6, 0, 0, Math.PI * 2);
  r.ctx.fill();

  // Tête en Z (éclair)
  r.ctx.strokeStyle = color;
  r.ctx.lineWidth   = Math.max(1.5, 2.5 * s);
  r.ctx.lineCap     = "round";
  r.ctx.beginPath();
  r.ctx.moveTo(bx - bw * 0.5, by - bh * 0.5);
  r.ctx.lineTo(bx + bw * 0.3, by - bh * 0.5);
  r.ctx.lineTo(bx - bw * 0.3, by + bh * 0.5);
  r.ctx.lineTo(bx + bw * 0.5, by + bh * 0.5);
  r.ctx.stroke();
  r.ctx.lineCap = "butt";
}

// --- Piège à flèche --------------------------------------------------------

const ARROW_H_FRAC = 0.50; // même hauteur que l'éclair du fantôme

/** Petit trou discret dans le mur latéral d'où sortira la flèche.
 *  Rendu : ombre douce autour, creux réellement sombre, fin liseré de pierre
 *  éclairée sous le bord - teintes calées sur l'assombrissement du mur à cette
 *  profondeur, pour rester discret quel que soit z. */
function drawArrowHole(r: Renderer, at: ArrowTrap): void {
  const sideX = at.side === "left" ? -1.0 : 1.0;
  const pos = wallPoint(sideX, at.z, ARROW_H_FRAC);
  const s = scaleAt(at.z);
  const rad = Math.max(2.5, 4.2 * s);
  const ctx = r.ctx;
  const tWall = Math.max(0, Math.min(1, at.z)) * 0.55; // ton local du mur (cf. sideWallColor)
  // Ombre douce autour de l'ouverture
  ctx.fillStyle = shade(COLORS.wall, Math.min(1, tWall + 0.2));
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, rad * 1.8, rad * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Le creux : nettement plus sombre que le mur, c'est lui qui fait « trou »
  ctx.fillStyle = shade(COLORS.wall, Math.min(1, tWall + 0.55));
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, rad * 0.85, rad * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Liseré de pierre qui accroche la lumière sous le bord inférieur
  ctx.strokeStyle = shade("#4c3f66", tWall);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 0.5, rad * 1.05, rad * 0.62, 0, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
}

/** Flèche volante : fût + pointe triangulaire + empennage. */
function drawArrowProjectile(r: Renderer, at: ArrowTrap): void {
  const s = scaleAt(at.z);
  const pos = wallPoint(at.arrowX, at.z, ARROW_H_FRAC);
  const dir = at.arrowDir; // 1 = va vers la droite, -1 = vers la gauche
  const shaftLen = 42 * s;
  const headLen = 11 * s;
  const headH = 5 * s;
  const tipX = pos.x;
  const tipY = pos.y;
  const tailX = tipX - dir * shaftLen;
  // Fût
  r.line(tailX, tipY, tipX - dir * headLen, tipY, "#7a5a18", Math.max(1.5, 2 * s));
  // Pointe
  r.poly(
    [
      { x: tipX, y: tipY },
      { x: tipX - dir * headLen, y: tipY - headH },
      { x: tipX - dir * headLen, y: tipY + headH },
    ],
    "#c8a020",
    "#e0d060",
    1,
  );
  // Empennage (deux plumes qui s'ouvrent vers l'arrière de la flèche)
  r.poly(
    [
      { x: tailX, y: tipY },
      { x: tailX - dir * headLen * 0.65, y: tipY - headH * 0.85 },
      { x: tailX - dir * headLen * 0.3, y: tipY },
    ],
    "#c8a020",
  );
  r.poly(
    [
      { x: tailX, y: tipY },
      { x: tailX - dir * headLen * 0.65, y: tipY + headH * 0.85 },
      { x: tailX - dir * headLen * 0.3, y: tipY },
    ],
    "#c8a020",
  );
}

// --- Entités (tri par profondeur, du plus loin au plus proche) -------------

interface Drawable {
  z: number;
  draw: () => void;
}

function drawEntities(r: Renderer, room: Room, player: Player): void {
  const { cols, rows } = room;
  const list: Drawable[] = [];

  // Coffres d'abord : leur butin (même case) se dessinera par-dessus, comme posé dedans.
  for (const chest of room.chests) {
    const z = rowToZ(chest.row, rows);
    list.push({ z, draw: () => drawChest(r, chest, cols, rows) });
  }
  for (const item of room.items) {
    const x = colToX(item.col, cols);
    const z = rowToZ(item.row, rows);
    if (item.pedestal) {
      // z + ε : dessiné avant l'objet pour que l'ombre passe par-dessus le socle.
      list.push({ z: z + 0.001, draw: () => drawPedestal(r, x, z) });
    }
    if (!item.collected) {
      list.push({ z, draw: () => drawItem(r, item.kind, x, z, item.pedestal) });
    }
  }
  for (const f of room.furnitures) {
    list.push({ z: rowToZ(f.row, rows), draw: () => drawFurniture(r, f, cols, rows) });
  }
  for (const guard of room.guards) {
    list.push({ z: guard.z, draw: () => drawGuardKnight(r, guard, cols, rows) });
  }
  for (const bat of room.bats) {
    if (!bat.alive) continue;
    list.push({ z: bat.z, draw: () => drawBat(r, bat) });
  }
  for (const ghost of room.ghosts) {
    if (!ghost.alive) continue;
    list.push({ z: ghost.z, draw: () => drawGhost(r, ghost) });
    if (ghost.boltActive) {
      list.push({ z: ghost.z, draw: () => drawGhostBolt(r, ghost) });
    }
  }
  for (const at of room.arrowTraps) {
    // Le trou de flèche (indice du piège) est masqué par la bague maudite ;
    // la flèche elle-même reste visible quand elle part.
    if (!player.hasRing) {
      list.push({ z: at.z, draw: () => drawArrowHole(r, at) });
    }
    if (at.arrowActive) {
      list.push({ z: at.z, draw: () => drawArrowProjectile(r, at) });
    }
  }

  // Herses tombées : triées avec les entités - une herse plus proche que le héros
  // passe DEVANT lui (il est enfermé derrière les barreaux).
  room.herses.forEach((herse, idx) => {
    if (!room.herseDropped[idx]) return;
    list.push({
      z: droppedHerseZ(herse, rows),
      draw: () => drawDroppedHerse(r, herse, cols, rows),
    });
  });

  const blink = player.invuln > 0 && Math.floor(player.invuln * 20) % 2 === 0;
  list.push({
    z: player.z,
    draw: () => {
      if (player.climbStage !== "none") {
        drawClimbingHero(r, player);
        return;
      }
      if (!blink) {
        // De dos, le bras/objet est DEVANT le héros (côté opposé à la caméra) :
        // on le dessine avant le corps pour qu'il soit en partie masqué par le torse
        // - sauf pendant un coup d'épée, où le geste doit rester visible.
        if (player.facing === "back" && !player.isAttacking) {
          drawHeldItem(r, player);
          drawHero(r, player);
        } else {
          drawHero(r, player);
          drawHeldItem(r, player);
        }
      }
    },
  });

  list.sort((a, b) => b.z - a.z);
  for (const d of list) d.draw();
}

/** Palette d'une figurine (héros ou garde) : les mêmes traits, d'autres teintes. */
interface FigurePalette {
  hair: string;   // cheveux (héros) ou casque (garde)
  hairHi: string; // reflet clair dessus
  skin: string;
  tunic: string;  // tunique ou cuirasse
  belt: string;
  pants: string;  // pantalon ou jambières
  boots: string;
}

const HERO_PAL: FigurePalette = {
  hair: COLORS.heroHair, hairHi: "#ffe79a", skin: COLORS.heroSkin,
  tunic: COLORS.heroTunic, belt: COLORS.heroBelt, pants: COLORS.heroPants, boots: COLORS.heroBoots,
};

/** Garde en armure : nuances de gris (casque, cuirasse, jambières), teintes des
 *  ferronneries déjà présentes dans le jeu (chaînes, boulets). */
const GUARD_PAL: FigurePalette = {
  hair: "#9aa3b0", hairHi: "#cdd3dc", skin: COLORS.heroSkin,
  tunic: "#8a93a0", belt: "#4a4f58", pants: "#6a7280", boots: "#3a3f48",
};

/** Champs du Player réellement lus par drawHero/drawHeldItem : permet de dessiner
 *  les gardes avec exactement le même code de figurine. */
interface FigurePose {
  x: number; z: number; facing: Dir;
  crouching: boolean; hop: number; hopArc: boolean;
  animating: boolean; animT: number;
  leapStage: Player["leapStage"];
  inHand: Player["inHand"];
  handTorchLit: boolean;
  /** Coup d'épée en cours (s restantes) : abaisse l'arme tenue. */
  attackTimer: number;
}

/** Garde : la figurine du héros en armure grise, épée au poing.
 *  Cycle de marche calé sur la colonne (une enjambée par case), sans horloge. */
function drawGuardKnight(r: Renderer, g: Guard, cols: number, rows: number): void {
  if (!g.alive) {
    // Mort : un squelette couché là où il est tombé (même décalque que les
    // squelettes-obstacles, purement visuel - il ne bloque pas le passage).
    // Le crâne part du côté où le garde regardait.
    drawSkeleton(r, { col: g.col, row: g.row, flip: g.facing === 1 }, cols, rows);
    return;
  }
  const pose: FigurePose = {
    x: g.x, z: g.z, facing: g.facing === 1 ? "right" : "left",
    crouching: false, hop: 0, hopArc: false,
    animating: true, animT: g.col - Math.floor(g.col),
    leapStage: "none", inHand: "sword", handTorchLit: false, attackTimer: 0,
  };
  drawHero(r, pose, 0, GUARD_PAL);
  drawHeldItem(r, pose, GUARD_PAL);
}

/**
 * Héros à la "L'Aigle d'Or" : cheveux blonds, tunique bleue, ceinture orange,
 * pantalon vert, bottes rouges. Rendu en primitives vectorielles, ancré comme
 * drawHumanoid (floorPoint/scaleAt + brouillard shade), avec cycle de marche.
 */
/**
 * Grimpe à la corde : le grappin monte à la verticale en déroulant une corde
 * marron, puis le héros se hisse et disparaît par le plafond.
 */
function drawClimbingHero(r: Renderer, p: Player): void {
  const feet = floorPoint(p.x, p.z);
  const ceil = ceilPoint(p.x, p.z);
  const s = scaleAt(p.z);
  const h = HERO_BASE_H * s;
  const ropeW = Math.max(1.5, s * 2.5);
  const gSize = 13 * s; // envergure du grappin

  // Grappin : hampe + deux crochets recourbés, pointes vers le bas.
  const drawGrapple = (gx: number, gy: number): void => {
    r.ctx.strokeStyle = COLORS.grapple;
    r.ctx.lineWidth = Math.max(1.5, s * 2);
    r.line(gx, gy, gx, gy + gSize * 0.7, COLORS.grapple, Math.max(1.5, s * 2));
    r.ctx.beginPath();
    r.ctx.arc(gx - gSize * 0.45, gy + gSize * 0.25, gSize * 0.45, -Math.PI * 0.5, Math.PI * 0.35);
    r.ctx.stroke();
    r.ctx.beginPath();
    r.ctx.arc(gx + gSize * 0.45, gy + gSize * 0.25, gSize * 0.45, Math.PI * 0.65, Math.PI * 1.5);
    r.ctx.stroke();
  };

  if (p.climbStage === "throw") {
    // Le grappin part de la main levée et file vers le plafond, corde derrière lui.
    const k = Math.min(1, p.climbT / CLIMB_THROW_TIME);
    const handY = feet.y - h * 0.82;
    const gy = handY + (ceil.y - handY) * k;
    r.line(feet.x, gy, feet.x, handY, COLORS.rope, ropeW);
    drawGrapple(feet.x, gy);
    drawHero(r, p);
    return;
  }

  // Montée : corde tendue du plafond au sol, le héros se hisse et sort par le plafond.
  const k = Math.min(1, p.climbT / CLIMB_UP_TIME);
  r.line(feet.x, ceil.y, feet.x, feet.y, COLORS.rope, ropeW);
  drawGrapple(feet.x, ceil.y);
  const lift = k * (feet.y - ceil.y + h * 0.1);
  r.ctx.save();
  r.ctx.beginPath();
  r.ctx.rect(0, ceil.y, VIEW_W, PLAY_H - ceil.y);
  r.ctx.clip();
  drawHero(r, p, lift);
  r.ctx.restore();
}

function drawHero(r: Renderer, p: FigurePose, liftPx = 0, pal: FigurePalette = HERO_PAL): void {
  const x = p.x;
  const z = p.z;
  const look = p.facing;
  const crouch = p.crouching ? 1 : 0;
  const hop = p.hop;

  const s = scaleAt(z);
  const feet = floorPoint(x, z);
  const w = HERO_BASE_W * s;
  const h = HERO_BASE_H * s; // taille constante : s'accroupir ne rétrécit pas le corps
  const fog = z * 0.4;

  // Palette teintée par la profondeur.
  const hair = shade(pal.hair, fog);
  const skin = shade(pal.skin, fog);
  const tunic = shade(pal.tunic, fog);
  const tunicDark = shade(pal.tunic, fog + 0.22);
  const belt = shade(pal.belt, fog);
  const pants = shade(pal.pants, fog);
  const pantsDark = shade(pal.pants, fog + 0.22);
  const boots = shade(pal.boots, fog);
  const eye = "#1a1018";

  // Balancement des jambes pendant un pas (pas pendant un saut/bond).
  const walk = p.animating && !p.hopArc ? Math.sin(p.animT * Math.PI) : 0;

  // Ombre portée (rétrécit en plein saut, s'estompe quand on se hisse à la corde).
  const shadowFade = Math.max(0, 1 - liftPx / (h * 0.8));
  r.ctx.fillStyle = `rgba(0,0,0,${0.35 * shadowFade})`;
  r.ctx.beginPath();
  r.ctx.ellipse(feet.x, feet.y, w * 0.45 * (1 - hop * 0.4), w * 0.16 * (1 - hop * 0.4), 0, 0, Math.PI * 2);
  r.ctx.fill();

  const cx = feet.x;
  const feetY = feet.y - hop * HERO_BASE_H * s * 0.3 - liftPx;

  // Contour sombre + teintes d'ombrage : c'est ce qui détache le héros du décor
  // et lui donne du volume (au lieu d'aplats flottants).
  const outline = "#1a1018";
  const lw = Math.max(1, s * 1.1);
  const skinShade = shade(pal.skin, fog + 0.12); // cou / ombre sous le menton
  const hairHi = shade(pal.hairHi, fog);         // reflet clair sur les cheveux / le casque
  const bootSole = shade(pal.boots, fog + 0.3);  // semelle
  const buckle = shade(pal.belt, fog + 0.35);    // boucle de ceinture (sombre)

  // Petite ellipse pleine (tête/visage), avec contour optionnel.
  const oval = (ox: number, oy: number, rx: number, ry: number, fill: string, stroke?: string): void => {
    r.ctx.beginPath();
    r.ctx.ellipse(ox, oy, rx, ry, 0, 0, Math.PI * 2);
    r.ctx.fillStyle = fill;
    r.ctx.fill();
    if (stroke) { r.ctx.strokeStyle = stroke; r.ctx.lineWidth = lw; r.ctx.stroke(); }
  };

  // S'accroupir = descendre le buste (sans le rétrécir) en pliant les genoux.
  // Tête/torse/ceinture gardent leur taille ; seul le bas du corps se comprime.
  const drop = crouch ? h * 0.17 : 0;

  // Proportions adultes (~7 têtes) : la tête ne fait que ~1/7 de la hauteur.
  const profile = look === "left" || look === "right";
  const headHW = w * (profile ? 0.16 : 0.18); // demi-largeur tête
  const headHH = h * 0.075;                    // demi-hauteur tête (ovale)
  const headCY = feetY - h * 0.88 + drop;
  const shoulderY = feetY - h * 0.76 + drop;
  const beltY = feetY - h * 0.48 + drop;
  const beltH = h * 0.04;
  // Le bas de la tunique descend un peu sous la ceinture (hipY) -> liseré bleu.
  const hipY = feetY - h * 0.44 + drop;
  const bootH = h * 0.13;
  const bootTop = feetY - bootH;

  // Silhouette en V : épaules plus larges que la taille (héros un peu plus large).
  const shoulderHalf = profile ? w * 0.26 : w * 0.40;
  const waistHalf = profile ? w * 0.21 : w * 0.31;
  const beltT = (beltY - shoulderY) / (hipY - shoulderY);
  const beltHalf = (shoulderHalf + (waistHalf - shoulderHalf) * beltT) * 1.05;
  const legW = w * 0.20;  // largeur d'une jambe
  const armW = w * 0.13;  // largeur d'un bras

  // Tête + cheveux (casque) + visage, centrés sur (hcx, hcy). Réutilisé par la pose de saut.
  const drawHead = (hcx: number, hcy: number): void => {
    oval(hcx, hcy, headHW, headHH, skin, outline);
    const hairCY = hcy - headHH * 0.2;
    if (look === "back") {
      // Vu de dos : toute la tête couverte, sans visage.
      oval(hcx, hcy, headHW * 1.02, headHH * 1.02, hair, outline);
      oval(hcx - headHW * 0.25, hairCY - headHH * 0.25, headHW * 0.4, headHH * 0.35, hairHi);
    } else {
      // Calotte couvrant le haut + les côtés, le visage reste dégagé en bas.
      oval(hcx, hairCY, headHW * 1.04, headHH * 1.04, hair, outline);
      const faceDX = look === "right" ? headHW * 0.18 : look === "left" ? -headHW * 0.18 : 0;
      oval(hcx + faceDX, hcy + headHH * 0.22, headHW * 0.82, headHH * 0.78, skin);
      oval(hcx - headHW * 0.22, hairCY - headHH * 0.35, headHW * 0.38, headHH * 0.3, hairHi);
    }
    const eyeR = Math.max(1, h * 0.012);
    const mouthCol = "#7a2a2a";
    const fY = hcy + headHH * 0.22;
    const eyeY = fY - headHH * 0.05;
    const mouthY = fY + headHH * 0.55;
    const mouthH = Math.max(1, h * 0.011);
    if (look === "front") {
      r.circle(hcx - headHW * 0.34, eyeY, eyeR, eye);
      r.circle(hcx + headHW * 0.34, eyeY, eyeR, eye);
      r.rect({ x: hcx - headHW * 0.22, y: mouthY, w: headHW * 0.44, h: mouthH }, mouthCol);
    } else if (look === "right") {
      r.circle(hcx + headHW * 0.4, eyeY, eyeR, eye);
      r.rect({ x: hcx + headHW * 0.3, y: mouthY, w: headHW * 0.34, h: mouthH }, mouthCol);
    } else if (look === "left") {
      r.circle(hcx - headHW * 0.4, eyeY, eyeR, eye);
      r.rect({ x: hcx - headHW * 0.64, y: mouthY, w: headHW * 0.34, h: mouthH }, mouthCol);
    }
  };

  // Segment épais (membre) entre deux points, avec contour - utilisé par la pose de saut.
  const limb = (x0: number, y0: number, x1: number, y1: number, thick: number, col: string): void => {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * thick / 2, ny = (dx / len) * thick / 2;
    r.poly([{ x: x0 + nx, y: y0 + ny }, { x: x1 + nx, y: y1 + ny }, { x: x1 - nx, y: y1 - ny }, { x: x0 - nx, y: y0 - ny }], col, outline, lw);
  };

  // --- Pose de saut en vol (phase "air" du saut directionnel) : plongeon dynamique. ---
  if (p.leapStage === "air") {
    const handR = w * 0.06;
    if (profile) {
      // Corps incliné vers l'avant ; UNE jambe tendue vers l'avant, UN bras le long du corps.
      const dir = look === "right" ? 1 : -1;
      const a = dir * 0.7;
      const ca = Math.cos(a), sa = Math.sin(a);
      const pivotX = cx, pivotY = feetY - h * 0.5;
      // Rotation d'un point autour du pivot (repère écran, y vers le bas).
      const rot = (px: number, py: number) => ({
        x: pivotX + (px - pivotX) * ca - (py - pivotY) * sa,
        y: pivotY + (px - pivotX) * sa + (py - pivotY) * ca,
      });
      // Jambes en repère écran, attachées à la hanche inclinée.
      const hipS = rot(cx, hipY);
      // Jambe ARRIÈRE (traîne derrière, plus sombre, légèrement pliée) - dessinée d'abord.
      const bKnee = { x: hipS.x - dir * w * 0.42, y: hipS.y + h * 0.20 };
      const bFoot = { x: bKnee.x - dir * w * 0.12, y: bKnee.y + h * 0.16 };
      limb(hipS.x, hipS.y, bKnee.x, bKnee.y, legW, pantsDark);
      limb(bKnee.x, bKnee.y, bFoot.x, bFoot.y, legW * 0.95, pantsDark);
      limb(bFoot.x, bFoot.y, bFoot.x - dir * w * 0.12, bFoot.y + h * 0.012, legW * 0.9, boots);
      // Torse + bras + tête : inclinés ensemble.
      r.ctx.save();
      r.ctx.translate(pivotX, pivotY);
      r.ctx.rotate(a);
      r.ctx.translate(-pivotX, -pivotY);
      r.poly([
        { x: cx - shoulderHalf, y: shoulderY }, { x: cx + shoulderHalf, y: shoulderY },
        { x: cx + waistHalf, y: hipY }, { x: cx - waistHalf, y: hipY },
      ], tunic, outline, lw);
      r.rect({ x: cx - beltHalf, y: beltY, w: beltHalf * 2, h: beltH }, belt);
      // Bras unique le long du corps (côté direction) + main en bas.
      const ax = cx + dir * waistHalf * 0.4;
      limb(ax, shoulderY + h * 0.02, ax, hipY + h * 0.02, armW, tunicDark);
      r.circle(ax, hipY + h * 0.04, handR, skin);
      drawHead(cx, headCY);
      r.ctx.restore();
      // Jambe AVANT tendue vers l'avant - dessinée par-dessus le corps (au premier plan).
      const footS = { x: hipS.x + dir * w * 0.95, y: hipS.y + h * 0.16 };
      limb(hipS.x, hipS.y, footS.x, footS.y, legW, pants);
      limb(footS.x, footS.y, footS.x + dir * w * 0.18, footS.y + h * 0.015, legW * 0.95, boots);
    } else {
      // De face/dos : saut groupé, genoux repliés vers l'extérieur, bras levés.
      limb(cx - waistHalf * 0.5, hipY, cx - waistHalf - w * 0.06, hipY + h * 0.10, legW, pants);
      limb(cx - waistHalf - w * 0.06, hipY + h * 0.10, cx - waistHalf * 0.7, hipY + h * 0.03, legW, pants);
      limb(cx + waistHalf * 0.5, hipY, cx + waistHalf + w * 0.06, hipY + h * 0.10, legW, pantsDark);
      limb(cx + waistHalf + w * 0.06, hipY + h * 0.10, cx + waistHalf * 0.7, hipY + h * 0.03, legW, pantsDark);
      r.circle(cx - waistHalf * 0.7, hipY + h * 0.03, legW * 0.5, boots);
      r.circle(cx + waistHalf * 0.7, hipY + h * 0.03, legW * 0.5, boots);
      r.poly([
        { x: cx - shoulderHalf, y: shoulderY }, { x: cx + shoulderHalf, y: shoulderY },
        { x: cx + waistHalf, y: hipY }, { x: cx - waistHalf, y: hipY },
      ], tunic, outline, lw);
      if (look !== "back") {
        r.poly([{ x: cx, y: shoulderY }, { x: cx + shoulderHalf, y: shoulderY }, { x: cx + waistHalf, y: hipY }, { x: cx, y: hipY }], tunicDark);
      }
      r.rect({ x: cx - beltHalf, y: beltY, w: beltHalf * 2, h: beltH }, belt);
      limb(cx - shoulderHalf * 0.7, shoulderY + h * 0.01, cx - shoulderHalf - w * 0.12, shoulderY - h * 0.07, armW, tunicDark);
      r.circle(cx - shoulderHalf - w * 0.12, shoulderY - h * 0.07, handR, skin);
      limb(cx + shoulderHalf * 0.7, shoulderY + h * 0.01, cx + shoulderHalf + w * 0.12, shoulderY - h * 0.07, armW, tunicDark);
      r.circle(cx + shoulderHalf + w * 0.12, shoulderY - h * 0.07, handR, skin);
      drawHead(cx, headCY);
    }
    return;
  }

  // --- Jambes (pantalon vert) + bottes (rouge). ---
  // Marche : les jambes restent pleines, seules les bottes glissent en ciseaux
  // (une devant, une derrière), sans aucun rebond vertical -> pas qui ne "danse" pas.
  const legGap = profile ? w * 0.03 : w * 0.08;
  const legLX = cx - legGap - legW;
  const legRX = cx + legGap;
  // Botte : corps rouge + semelle plus sombre + contour.
  const drawBoot = (bx: number): void => {
    r.rect({ x: bx, y: bootTop, w: legW, h: bootH }, boots);
    r.rect({ x: bx, y: bootTop + bootH * 0.7, w: legW, h: bootH * 0.3 }, bootSole);
    r.strokeRect({ x: bx, y: bootTop, w: legW, h: bootH }, outline, lw);
  };
  if (crouch) {
    // Squat : cuisses puis tibias dessinés en deux segments pliés au genou.
    const hw = legW / 2;
    const kneeY = hipY + (bootTop - hipY) * 0.5;
    const thigh = (x0: number, x1: number, col: string) =>
      r.poly([{ x: x0 - hw, y: hipY }, { x: x0 + hw, y: hipY }, { x: x1 + hw, y: kneeY }, { x: x1 - hw, y: kneeY }], col, outline, lw);
    const shin = (x0: number, x1: number, col: string) =>
      r.poly([{ x: x0 - hw, y: kneeY }, { x: x0 + hw, y: kneeY }, { x: x1 + hw, y: bootTop }, { x: x1 - hw, y: bootTop }], col, outline, lw);
    if (profile) {
      // De profil : UNE seule jambe visible, pliée vers l'avant (sens du regard).
      const dir = look === "right" ? 1 : -1;
      const kneeF = w * 0.22; // genou en avant
      const footF = w * 0.12; // pied en avant de la hanche
      thigh(cx, cx + dir * kneeF, pants);
      shin(cx + dir * kneeF, cx + dir * footF, pants);
      drawBoot(cx + dir * footF - hw);
    } else {
      // De face/dos : genoux écartés symétriquement, bottes sous le corps.
      const hipLC = legLX + hw;
      const hipRC = legRX + hw;
      const kneeOut = w * 0.16;
      const ankLC = cx - legW * 0.55;
      const ankRC = cx + legW * 0.55;
      thigh(hipLC, hipLC - kneeOut, pants);
      shin(hipLC - kneeOut, ankLC, pants);
      thigh(hipRC, hipRC + kneeOut, pantsDark);
      shin(hipRC + kneeOut, ankRC, pantsDark);
      drawBoot(ankLC - hw);
      drawBoot(ankRC - hw);
    }
  } else if (profile) {
    // De profil : UNE seule jambe (les deux se superposent), léger pas avant/arrière.
    const dir = look === "right" ? 1 : -1;
    const stride = walk * w * 0.12 * dir;
    const lx = cx - legW / 2;
    r.poly([{ x: lx, y: hipY }, { x: lx + legW, y: hipY }, { x: lx + legW, y: bootTop }, { x: lx, y: bootTop }], pants, outline, lw);
    drawBoot(lx + stride);
  } else {
    const stride = walk * w * 0.08; // amplitude horizontale du pas
    r.poly([{ x: legLX, y: hipY }, { x: legLX + legW, y: hipY }, { x: legLX + legW, y: bootTop }, { x: legLX, y: bootTop }], pants, outline, lw);
    r.poly([{ x: legRX, y: hipY }, { x: legRX + legW, y: hipY }, { x: legRX + legW, y: bootTop }, { x: legRX, y: bootTop }], pantsDark, outline, lw);
    // Bottes en opposition (ciseaux).
    drawBoot(legLX + stride);
    drawBoot(legRX - stride);
  }

  // --- Cou (peau, légèrement ombré) sous la tête, par-dessus le haut du torse. ---
  const neckW = w * 0.15;
  r.rect({ x: cx - neckW / 2, y: headCY + headHH * 0.45, w: neckW, h: (shoulderY + h * 0.01) - (headCY + headHH * 0.45) }, skinShade);

  // --- Tunique bleue : torse trapézoïdal (épaules > taille) + bas sous la ceinture. ---
  r.poly([
    { x: cx - shoulderHalf, y: shoulderY },
    { x: cx + shoulderHalf, y: shoulderY },
    { x: cx + waistHalf, y: hipY },
    { x: cx - waistHalf, y: hipY },
  ], tunic, outline, lw);
  // Bande d'ombre sur la moitié droite (volume), sauf de profil (torse fin).
  if (!profile) {
    r.poly([
      { x: cx, y: shoulderY },
      { x: cx + shoulderHalf, y: shoulderY },
      { x: cx + waistHalf, y: hipY },
      { x: cx, y: hipY },
    ], tunicDark);
  }

  // --- Ceinture orange (par-dessus la tunique) + boucle. ---
  r.rect({ x: cx - beltHalf, y: beltY, w: beltHalf * 2, h: beltH }, belt);
  r.rect({ x: cx - w * 0.04, y: beltY, w: w * 0.08, h: beltH }, buckle);

  // --- Bras fuselés (manches tunique) + mains (peau), le long du corps. ---
  // Dessinés APRÈS la ceinture pour rester visibles ; la main dépasse sous la ceinture.
  const armTopY = shoulderY + h * 0.012;
  const armBotY = hipY + h * 0.005;
  const handR = w * 0.055;
  const drawArm = (topX: number, botX: number): void => {
    r.poly([
      { x: topX, y: armTopY },
      { x: topX + armW, y: armTopY },
      { x: botX + armW, y: armBotY },
      { x: botX, y: armBotY },
    ], tunicDark, outline, lw);
    r.circle(botX + armW / 2, armBotY + handR * 0.5, handR, skin);
  };
  // Quand on tient un objet (torche, épée, pied-de-biche, clés), le bras correspondant
  // part du corps pour le porter (dessiné par drawHeldItem) : on ne le dessine donc pas
  // pendant le long du corps de ce côté.
  const torchInHand = p.inHand === "torch";
  const toolInHand = p.inHand === "sword" || p.inHand === "crowbar" || p.inHand === "ironKey" || p.inHand === "goldKey" || p.inHand === "vial" || p.inHand === "crucifix";
  const armedHand = torchInHand || toolInHand;
  // Côté du bras porteur (doit correspondre au placement dans drawHeldItem).
  const heldSide = torchInHand
    ? (look === "front" || look === "right" ? 1 : -1)
    : (look === "left" ? -1 : 1); // épée/pied-de-biche/clés : devant soi, côté droit de face/dos
  if (profile) {
    if (!armedHand) {
      // Un seul bras visible, du côté de la direction regardée (droite->bras droit), le long du corps.
      const dir = look === "right" ? 1 : -1;
      const ax = cx + dir * waistHalf * 0.45 - armW / 2;
      drawArm(ax, ax);
    }
  } else {
    if (!(armedHand && heldSide < 0)) drawArm(cx - shoulderHalf - armW * 0.05, cx - waistHalf - armW * 0.7);
    if (!(armedHand && heldSide > 0)) drawArm(cx + shoulderHalf - armW * 0.95, cx + waistHalf - armW * 0.3);
  }

  // --- Tête + cheveux + visage. ---
  drawHead(cx, headCY);
}

// --- Meubles au sol ---------------------------------------------------------

/**
 * Meuble du jeu d'origine (chaise, porte-manteau, statue, table) : silhouette
 * vectorielle posée sur son gabarit de dalles (col .. col+largeur-1, une rangée).
 * Les hauteurs sont en px d'époque, à l'échelle de la profondeur - l'obstacle
 * physique correspondant est géré par Room.isFurnitureAt.
 */
function drawFurniture(r: Renderer, f: FurnitureDef, cols: number, rows: number): void {
  const zN = zEdge(f.row, rows);
  const zF = zEdge(f.row + 1, rows);
  const zC = (zN + zF) / 2;
  const s = scaleAt(zC);
  const fog = zC * 0.4;
  const outline = "#1a1018";
  const lw = Math.max(1, s * 1.1);
  const cell = xEdge(f.col + 1, cols) - xEdge(f.col, cols);
  const x0 = xEdge(f.col, cols) + cell * 0.1;
  const x1 = xEdge(f.col + FURNITURE_W[f.kind], cols) - cell * 0.1;
  const xC = (x0 + x1) / 2;
  const legT = Math.max(2, 5 * s);

  /** Point du plan-sol (x, z), élevé de `h` px d'époque. */
  const P = (x: number, z: number, h = 0): Pt => {
    const p = floorPoint(x, z);
    return { x: p.x, y: p.y - h * s };
  };
  /** Plateau horizontal à hauteur h, sur l'empreinte (xa..xb, za..zb). */
  const slab = (xa: number, xb: number, za: number, zb: number, h: number, fill: string): void =>
    r.poly([P(xa, za, h), P(xb, za, h), P(xb, zb, h), P(xa, zb, h)], fill, outline, lw);
  /** Montant épais entre deux points projetés (pied, bras, fût). */
  const bar = (a: Pt, b: Pt, thick: number, fill: string): void => {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * thick / 2, ny = (dx / len) * thick / 2;
    r.poly(
      [{ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
       { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny }],
      fill, outline, lw,
    );
  };

  // Ombre portée sur l'empreinte.
  const sh = floorPoint(xC, zC);
  const shw = (P(x1, zC).x - P(x0, zC).x) / 2;
  r.ctx.fillStyle = "rgba(0,0,0,0.3)";
  r.ctx.beginPath();
  r.ctx.ellipse(sh.x, sh.y, shw, shw * 0.28, 0, 0, Math.PI * 2);
  r.ctx.fill();

  const wood = shade(COLORS.doorWood, fog);
  const woodDark = shade(COLORS.doorWoodFrame, fog);
  const ctx = r.ctx;

  /** Plateau en planches : une bande par planche (le contour fait le joint),
   *  deux nuances alternées, veines ondulées dans le fil et un nœud par planche. */
  const planks = (xa: number, xb: number, za: number, zb: number, h: number, n: number): void => {
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const pza = za + ((zb - za) * i) / n;
      const pzb = za + ((zb - za) * (i + 1)) / n;
      slab(xa, xb, pza, pzb, h, shade(COLORS.doorFrame, fog + (i % 2 ? 0.07 : 0)));
      ctx.strokeStyle = woodDark;
      for (let v = 0; v < 2; v++) {
        const zv = pza + (pzb - pza) * (0.32 + 0.38 * v);
        const wob = (pzb - pza) * 0.16 * ((i + v) % 2 ? 1 : -1); // ondulation de la veine
        const u0 = 0.06 + ((i * 2 + v) % 3) * 0.05;
        const a = P(xa + (xb - xa) * u0, zv, h);
        const m = P(xa + (xb - xa) * (u0 + 0.44), zv + wob, h);
        const b = P(xa + (xb - xa) * 0.94, zv, h);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
        ctx.stroke();
      }
      const k = P(xa + (xb - xa) * (0.25 + 0.25 * i), pza + (pzb - pza) * 0.5, h);
      ctx.beginPath();
      ctx.ellipse(k.x, k.y, Math.max(1.5, 2.5 * s), Math.max(1, 1.2 * s), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  switch (f.kind) {
    case "table": {
      // Grande table : quatre pieds droits, un à chaque angle du plateau.
      const H = 86, T = 10;
      for (const [lx, lz] of [
        [x0 + cell * 0.2, zN], [x1 - cell * 0.2, zN],
        [x0 + cell * 0.2, zF], [x1 - cell * 0.2, zF],
      ] as [number, number][]) {
        bar(P(lx, lz, H - T), P(lx, lz, 0), legT, woodDark);
      }
      // Épaisseur du plateau (bande avant), puis les planches par-dessus.
      r.poly([P(x0, zN, H - T), P(x1, zN, H - T), P(x1, zN, H), P(x0, zN, H)], wood, outline, lw);
      planks(x0, x1, zN, zF, H, 3);
      return;
    }
    case "chaise": {
      // Chaise à haut dossier droit : empreinte réduite (elle n'occupe pas
      // toute la surface de ses deux dalles), 4 pieds, assise, dossier au fond.
      const cx0 = x0 + cell * 0.28, cx1 = x1 - cell * 0.28;
      const czN = zN + (zF - zN) * 0.24, czF = zF - (zF - zN) * 0.1;
      const SEAT = 58, BACK = 148;
      for (const [lx, lz] of [
        [cx0 + cell * 0.06, czN], [cx1 - cell * 0.06, czN],
        [cx0 + cell * 0.06, czF], [cx1 - cell * 0.06, czF],
      ] as [number, number][]) {
        bar(P(lx, lz, SEAT - 4), P(lx, lz, 0), legT, woodDark);
      }
      r.poly([P(cx0, czN, SEAT - 7), P(cx1, czN, SEAT - 7), P(cx1, czN, SEAT), P(cx0, czN, SEAT)], wood, outline, lw);
      planks(cx0, cx1, czN, czF, SEAT, 2);
      // Dossier + panneau intérieur en retrait.
      r.poly([P(cx0, czF, SEAT), P(cx1, czF, SEAT), P(cx1, czF, BACK), P(cx0, czF, BACK)], wood, outline, lw);
      r.poly(
        [P(cx0 + cell * 0.14, czF, SEAT + 14), P(cx1 - cell * 0.14, czF, SEAT + 14),
         P(cx1 - cell * 0.14, czF, BACK - 12), P(cx0 + cell * 0.14, czF, BACK - 12)],
        woodDark,
      );
      return;
    }
    case "statue": {
      // Statue : deux marches de socle pleine largeur, puis la silhouette drapée
      // d'un seul tenant - ourlet, taille, épaules, cou - directement sur le socle.
      const stone = shade(COLORS.fireStone, fog);
      const stoneL = shade(COLORS.fireStoneLight, fog);
      const stoneD = shade(COLORS.fireStoneDark, fog);
      // Face latérale d'une marche : celle tournée vers le centre de l'écran
      // (x=0 = point de fuite) - l'autre est cachée par la perspective.
      const boxSide = (bx0: number, bx1: number, bzN: number, bzF: number, h0: number, h1: number): void => {
        const bx = bx0 > 0 ? bx0 : bx1 < 0 ? bx1 : null;
        if (bx === null) return;
        r.poly([P(bx, bzN, h0), P(bx, bzF, h0), P(bx, bzF, h1), P(bx, bzN, h1)],
          shade(COLORS.fireStoneDark, fog + 0.12), outline, lw);
      };
      // Socle réduit : 60 % de l'empreinte, centré, deux marches basses (7 et 14).
      const bw = (x1 - x0) * 0.3;
      const bx0 = xC - bw, bx1 = xC + bw;
      const bzN = zC - (zF - zN) * 0.3, bzF = zC + (zF - zN) * 0.3;
      boxSide(bx0, bx1, bzN, bzF, 0, 7);
      r.poly([P(bx0, bzN, 0), P(bx1, bzN, 0), P(bx1, bzN, 7), P(bx0, bzN, 7)], stoneD, outline, lw);
      slab(bx0, bx1, bzN, bzF, 7, stone);
      const sx0 = bx0 + cell * 0.1, sx1 = bx1 - cell * 0.1;
      const szN = bzN + (bzF - bzN) * 0.14, szF = bzF - (bzF - bzN) * 0.14;
      boxSide(sx0, sx1, szN, szF, 7, 14);
      r.poly([P(sx0, szN, 7), P(sx1, szN, 7), P(sx1, szN, 14), P(sx0, szN, 14)], stone, outline, lw);
      slab(sx0, sx1, szN, szF, 14, stoneL);
      // Silhouette drapée, symétrique autour de l'axe.
      const p = (dx: number, h: number): Pt => P(xC + cell * dx, zC, h);
      r.poly(
        [p(-0.3, 14), p(-0.26, 58), p(-0.14, 100), p(-0.21, 116), p(-0.07, 126),
         p(0.07, 126), p(0.21, 116), p(0.14, 100), p(0.26, 58), p(0.3, 14)],
        stone, outline, lw,
      );
      // Plis du drapé, resserrés vers la taille.
      for (const dxp of [-0.12, 0, 0.12]) {
        const a = p(dxp * 1.5, 28);
        const b = p(dxp * 0.7, 96);
        r.line(a.x, a.y, b.x, b.y, stoneD, 1);
      }
      // Marques de taille de pierre : quelques courts coups de ciseau obliques,
      // à peine visibles, semés déterministiquement sur le drapé.
      for (let i = 0; i < 6; i++) {
        const u = -0.16 + 0.32 * ((i * 0.618) % 1);
        const h = 34 + 74 * ((i * 0.377) % 1);
        const a = p(u, h);
        const b = p(u + 0.045, h + 3.5);
        r.line(a.x, a.y, b.x, b.y, stoneD, 0.6);
      }
      // Tête, posée sur le cou (les ellipses se chevauchent : pas de jour entre les deux).
      const head = p(0, 134);
      ctx.beginPath();
      ctx.ellipse(head.x, head.y, Math.max(2, 8 * s), Math.max(2.5, 10 * s), 0, 0, Math.PI * 2);
      ctx.fillStyle = stoneL;
      ctx.fill();
      ctx.strokeStyle = outline;
      ctx.lineWidth = lw;
      ctx.stroke();
      return;
    }
    case "porteManteau": {
      // Porte-manteau : socle cylindrique en bois, fût central qui démarre au
      // sommet du socle, pointe et crochets recourbés.
      const H = 158, SOCLE = 6;
      const rx = cell * 0.3;
      const rz = (zF - zN) * 0.22;
      const N = 20;
      /** Arc d'ellipse du socle à hauteur h, de l'angle a0 à a1 (sin<0 = avant). */
      const ring = (h: number, a0: number, a1: number): Pt[] => {
        const pts: Pt[] = [];
        for (let i = 0; i <= N; i++) {
          const t = a0 + ((a1 - a0) * i) / N;
          pts.push(P(xC + rx * Math.cos(t), zC + rz * Math.sin(t), h));
        }
        return pts;
      };
      // Flanc du cylindre (demi-ellipse avant, bas puis haut en retour), puis dessus.
      r.poly([...ring(0, Math.PI, 2 * Math.PI), ...ring(SOCLE, 2 * Math.PI, Math.PI)], wood, outline, lw);
      r.poly(ring(SOCLE, 0, 2 * Math.PI), shade(COLORS.doorFrame, fog), outline, lw);
      bar(P(xC, zC, SOCLE), P(xC, zC, H - 14), Math.max(2, 6 * s), wood);
      const top = P(xC, zC, H - 14);
      ctx.strokeStyle = wood;
      ctx.lineWidth = Math.max(1.5, 3.5 * s);
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(top.x, top.y + 16 * s);
        ctx.quadraticCurveTo(top.x + d * 17 * s, top.y + 14 * s, top.x + d * 15 * s, top.y - 8 * s);
        ctx.stroke();
      }
      r.line(top.x, top.y + 8 * s, top.x, top.y - 14 * s, wood, Math.max(1.5, 3.5 * s));
      return;
    }
  }
}

function drawPedestal(r: Renderer, x: number, z: number): void {
  const s = scaleAt(z);
  const feet = floorPoint(x, z);
  const size = ITEM_BASE * s;
  const lift = size * 1.7;
  const X = feet.x;
  // Ombre au sol d'abord, puis le socle par-dessus.
  r.ctx.fillStyle = "rgba(0,0,0,0.3)";
  r.ctx.beginPath();
  r.ctx.ellipse(X, feet.y, size * 0.4, size * 0.14, 0, 0, Math.PI * 2);
  r.ctx.fill();
  const stone = "#8a8070";
  const stoneDark = "#5e5648";
  r.rect({ x: X - size * 0.44, y: feet.y - lift * 0.20, w: size * 0.88, h: lift * 0.20 }, stoneDark);
  r.rect({ x: X - size * 0.17, y: feet.y - lift * 0.85, w: size * 0.34, h: lift * 0.65 }, stone);
  r.rect({ x: X - size * 0.35, y: feet.y - lift,        w: size * 0.70, h: lift * 0.18 }, stoneDark);
}

function drawItem(r: Renderer, kind: ItemKind, x: number, z: number, pedestal = false): void {
  const s = scaleAt(z);
  const feet = floorPoint(x, z);
  const size = ITEM_BASE * s;
  const lift = pedestal ? size * 1.7 : 0;
  const cy = feet.y - size * 0.5 - lift;
  const X = feet.x;

  // Ombre portée au sol (le piédestal la dessine lui-même si applicable).
  if (!pedestal) {
    r.ctx.fillStyle = "rgba(0,0,0,0.3)";
    r.ctx.beginPath();
    r.ctx.ellipse(feet.x, feet.y, size * 0.4, size * 0.14, 0, 0, Math.PI * 2);
    r.ctx.fill();
  }
  switch (kind) {
    case "ironKey":
      drawKey(r, X, cy, size, "#9aa3ad");
      break;
    case "goldKey":
      drawKey(r, X, cy, size, COLORS.treasure);
      break;
    case "torch":
      r.rect({ x: X - size * 0.06, y: cy - size * 0.1, w: size * 0.12, h: size * 0.55 }, COLORS.torchBracket);
      r.poly([{ x: X, y: cy - size * 0.5 }, { x: X + size * 0.18, y: cy - size * 0.1 }, { x: X - size * 0.18, y: cy - size * 0.1 }], COLORS.flameOuter);
      r.poly([{ x: X, y: cy - size * 0.36 }, { x: X + size * 0.1, y: cy - size * 0.12 }, { x: X - size * 0.1, y: cy - size * 0.12 }], COLORS.flameInner);
      break;
    case "crucifix": {
      const c = "#e6e0c8";
      r.rect({ x: X - size * 0.06, y: cy - size * 0.45, w: size * 0.12, h: size * 0.9 }, c);
      r.rect({ x: X - size * 0.24, y: cy - size * 0.22, w: size * 0.48, h: size * 0.12 }, c);
      break;
    }
    case "crowbar": {
      const c = "#8a9099";
      r.rect({ x: X - size * 0.05, y: cy - size * 0.45, w: size * 0.1, h: size * 0.85 }, c);
      r.rect({ x: X - size * 0.22, y: cy - size * 0.45, w: size * 0.22, h: size * 0.12 }, c);
      break;
    }
    case "vial":
      // Corps ovale vert, col puis bouchon rouge.
      r.ctx.fillStyle = "#3fce6e";
      r.ctx.beginPath();
      r.ctx.ellipse(X, cy + size * 0.12, size * 0.26, size * 0.34, 0, 0, Math.PI * 2);
      r.ctx.fill();
      r.rect({ x: X - size * 0.1, y: cy - size * 0.32, w: size * 0.2, h: size * 0.2 }, "#3fce6e");
      r.rect({ x: X - size * 0.12, y: cy - size * 0.46, w: size * 0.24, h: size * 0.16 }, "#d23b3b");
      break;
    case "rope": {
      // Corde enroulée : deux anneaux entrelacés.
      const c = "#b8895a";
      r.ctx.strokeStyle = c;
      r.ctx.lineWidth = Math.max(2, size * 0.08);
      r.ctx.beginPath();
      r.ctx.arc(X - size * 0.15, cy + size * 0.08, size * 0.22, 0, Math.PI * 2);
      r.ctx.stroke();
      r.ctx.beginPath();
      r.ctx.arc(X + size * 0.15, cy + size * 0.08, size * 0.22, 0, Math.PI * 2);
      r.ctx.stroke();
      break;
    }
    case "sword": {
      const steel = "#c8d0d8";
      const gold = "#caa02f";
      // Lame + pointe.
      r.rect({ x: X - size * 0.05, y: cy - size * 0.45, w: size * 0.1, h: size * 0.6 }, steel);
      r.poly(
        [
          { x: X - size * 0.05, y: cy - size * 0.45 },
          { x: X + size * 0.05, y: cy - size * 0.45 },
          { x: X, y: cy - size * 0.58 },
        ],
        steel,
      );
      // Garde, poignée, pommeau.
      r.rect({ x: X - size * 0.22, y: cy + size * 0.13, w: size * 0.44, h: size * 0.08 }, gold);
      r.rect({ x: X - size * 0.04, y: cy + size * 0.21, w: size * 0.08, h: size * 0.18 }, "#6a4a2a");
      r.circle(X, cy + size * 0.42, size * 0.07, gold);
      break;
    }
    case "treasure":
      r.poly(
        [
          { x: X, y: cy - size * 0.4 },
          { x: X + size * 0.4, y: cy },
          { x: X, y: cy + size * 0.4 },
          { x: X - size * 0.4, y: cy },
        ],
        COLORS.treasure,
        "#7a4a10",
        2,
      );
      break;
    case "eagle":
      drawEagle(r, X, cy, size, COLORS.eagle, "#a8861f");
      break;
    case "diamond":
      r.poly(
        [
          { x: X, y: cy - size * 0.42 },
          { x: X + size * 0.34, y: cy - size * 0.05 },
          { x: X, y: cy + size * 0.42 },
          { x: X - size * 0.34, y: cy - size * 0.05 },
        ],
        "#4aa3ff",
        "#dfefff",
        2,
      );
      break;
    case "book":
      r.rect({ x: X - size * 0.3, y: cy - size * 0.32, w: size * 0.6, h: size * 0.64 }, "#7a3b2a");
      r.rect({ x: X - size * 0.3, y: cy - size * 0.32, w: size * 0.1, h: size * 0.64 }, "#5a2a1e");
      r.rect({ x: X + size * 0.0, y: cy - size * 0.18, w: size * 0.06, h: size * 0.36 }, "#e6c84a");
      r.rect({ x: X - size * 0.07, y: cy - size * 0.05, w: size * 0.2, h: size * 0.06 }, "#e6c84a");
      break;
    case "purse": {
      const bag = "#9a6b3a";
      const tie = "#6e4a24";
      const gold = "#e6c84a";
      const by = cy + size * 0.42; // fond plat (le sac est posé)
      const bw = size * 0.3;
      // Corps : fond plat, flancs rebondis, col resserré.
      r.ctx.fillStyle = bag;
      r.ctx.beginPath();
      r.ctx.moveTo(X - bw, by);
      r.ctx.lineTo(X + bw, by); // fond plat
      r.ctx.quadraticCurveTo(X + bw * 1.15, by - size * 0.32, X + size * 0.1, cy - size * 0.04);
      r.ctx.lineTo(X - size * 0.1, cy - size * 0.04);
      r.ctx.quadraticCurveTo(X - bw * 1.15, by - size * 0.32, X - bw, by);
      r.ctx.closePath();
      r.ctx.fill();
      // Tissu évasé au-dessus du col (trapèze inversé).
      r.poly(
        [
          { x: X - size * 0.1, y: cy - size * 0.04 },
          { x: X + size * 0.1, y: cy - size * 0.04 },
          { x: X + size * 0.22, y: cy - size * 0.3 },
          { x: X - size * 0.22, y: cy - size * 0.3 },
        ],
        bag,
      );
      // Col pincé par un cordon.
      r.rect({ x: X - size * 0.11, y: cy - size * 0.08, w: size * 0.22, h: size * 0.1 }, tie);
      // Pièce dorée sur le corps.
      r.circle(X, cy + size * 0.16, size * 0.1, gold);
      break;
    }
    case "leadEagle":
      drawEagle(r, X, cy, size, "#9aa0a8", "#5a606a");
      break;
    case "ring": {
      r.ctx.strokeStyle = "#caa02f"; // anneau doré
      r.ctx.lineWidth = Math.max(2, size * 0.1);
      r.ctx.beginPath();
      r.ctx.arc(X, cy + size * 0.14, size * 0.22, 0, Math.PI * 2);
      r.ctx.stroke();
      r.poly(
        [
          { x: X, y: cy - size * 0.36 },
          { x: X + size * 0.15, y: cy - size * 0.16 },
          { x: X, y: cy + size * 0.04 },
          { x: X - size * 0.15, y: cy - size * 0.16 },
        ],
        "#2ec26a", // émeraude verte
        "#0f7a3e",
        1,
      );
      break;
    }
    case "poison":
      r.ctx.fillStyle = "#d23b3b"; // flacon rouge
      r.ctx.beginPath();
      r.ctx.ellipse(X, cy + size * 0.12, size * 0.26, size * 0.34, 0, 0, Math.PI * 2);
      r.ctx.fill();
      r.rect({ x: X - size * 0.1, y: cy - size * 0.32, w: size * 0.2, h: size * 0.2 }, "#d23b3b");
      r.rect({ x: X - size * 0.12, y: cy - size * 0.46, w: size * 0.24, h: size * 0.16 }, "#3fce6e"); // bouchon vert
      break;
    case "map": {
      // Plan plié en quatre : feuille claire, plis marqués, croix à l'encre rouge.
      const py = cy + size * 0.14;
      const w = size * 0.62;
      const h = size * 0.46;
      r.rect({ x: X - w / 2, y: py - h / 2, w, h }, "#efe3b8");
      r.strokeRect({ x: X - w / 2, y: py - h / 2, w, h }, "#8a7a4a", 1);
      r.line(X - w / 6, py - h / 2, X - w / 6, py + h / 2, "#c9b986", 1);
      r.line(X + w / 6, py - h / 2, X + w / 6, py + h / 2, "#c9b986", 1);
      r.line(X - w / 2, py, X + w / 2, py, "#c9b986", 1);
      const k = size * 0.07;
      r.line(X + w * 0.22 - k, py - k, X + w * 0.22 + k, py + k, "#b03028", 1.5);
      r.line(X + w * 0.22 - k, py + k, X + w * 0.22 + k, py - k, "#b03028", 1.5);
      break;
    }
    case "parchment": {
      // Posé plus bas que les autres objets : presque au ras du sol.
      const py = cy + size * 0.16;
      r.rect({ x: X - size * 0.28, y: py - size * 0.26, w: size * 0.56, h: size * 0.52 }, "#e8dcae");
      r.rect({ x: X - size * 0.3, y: py - size * 0.32, w: size * 0.6, h: size * 0.1 }, "#cdbf8a");
      r.rect({ x: X - size * 0.3, y: py + size * 0.22, w: size * 0.6, h: size * 0.1 }, "#cdbf8a");
      r.line(X - size * 0.16, py - size * 0.04, X + size * 0.16, py - size * 0.04, "#8a7a4a", 1);
      r.line(X - size * 0.16, py + size * 0.08, X + size * 0.16, py + size * 0.08, "#8a7a4a", 1);
      break;
    }
  }
}

/** Aigle héraldique aux ailes déployées (doré ou de plomb). */
function drawEagle(r: Renderer, X: number, cy: number, s: number, fill: string, outline: string): void {
  const wing = (dir: number): Pt[] => [
    { x: X - dir * s * 0.05, y: cy - s * 0.05 },
    { x: X - dir * s * 0.55, y: cy - s * 0.3 },
    { x: X - dir * s * 0.5, y: cy + s * 0.02 },
    { x: X - dir * s * 0.1, y: cy + s * 0.12 },
  ];
  r.poly(wing(1), fill, outline, 1);
  r.poly(wing(-1), fill, outline, 1);
  // Corps + queue.
  r.rect({ x: X - s * 0.09, y: cy - s * 0.12, w: s * 0.18, h: s * 0.42 }, fill);
  r.poly([{ x: X - s * 0.12, y: cy + s * 0.26 }, { x: X + s * 0.12, y: cy + s * 0.26 }, { x: X, y: cy + s * 0.48 }], fill, outline, 1);
  // Tête + bec.
  r.circle(X, cy - s * 0.22, s * 0.1, fill);
  r.poly([{ x: X + s * 0.07, y: cy - s * 0.24 }, { x: X + s * 0.18, y: cy - s * 0.22 }, { x: X + s * 0.07, y: cy - s * 0.18 }], outline);
}

/**
 * Coffre en bois cerclé de métal. Il occupe 3 cases (centré sur chest.col, comme la porte
 * du mur du fond) et s'ouvre depuis sa case centrale. Ouvert : couvercle relevé, intérieur sombre.
 */
/**
 * Coffre en perspective (comme les meubles) : caisse-boîte posée sur le plan-sol
 * - face avant en planches, face latérale tournée vers le point de fuite,
 * couvercle bombé dont le dôme file vers le fond. Étendu sur 3 cases en largeur.
 */
function drawChest(r: Renderer, chest: Chest, cols: number, rows: number): void {
  const xA = xEdge(Math.max(0, chest.col - 1), cols);
  const xB = xEdge(Math.min(cols, chest.col + 2), cols);
  const xC = (xA + xB) / 2;
  // Décalé vers le fond de sa rangée : le héros qui marche devant le recouvre mieux.
  const zMid = rowToZ(chest.row, rows) + 0.12 / rows;
  const zN = zMid - (0.175 / rows); // empreinte : 35 % de la profondeur de la rangée
  const zF = zMid + (0.175 / rows);
  const s = scaleAt(zMid);
  const fog = zMid * 0.4;
  const wood = shade(COLORS.doorWood, fog);
  const woodDark = shade(COLORS.doorWoodFrame, fog);
  const woodTop = shade(COLORS.doorFrame, fog);
  const metal = shade("#8a9099", fog);
  const outline = "#1a1018";
  const lw = Math.max(1, s * 1.1);
  const BH = 40, LID = 18; // hauteur de la caisse, flèche du dôme (px d'époque)
  const ctx = r.ctx;
  const P = (x: number, z: number, h = 0): Pt => {
    const p = floorPoint(x, z);
    return { x: p.x, y: p.y - h * s };
  };
  /** Voûte du couvercle à la profondeur z : arc de gauche à droite, à partir de BH. */
  const arc = (z: number, sag: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = (Math.PI * i) / 14;
      pts.push(P(xC - ((xB - xA) / 2) * Math.cos(t), z, BH + sag * Math.sin(t)));
    }
    return pts;
  };

  // Ombre portée.
  const sh = floorPoint(xC, zMid);
  const shw = (P(xB, zMid).x - P(xA, zMid).x) / 2;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(sh.x, sh.y, shw * 1.02, shw * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face latérale de la caisse, côté point de fuite (cachée si le coffre est centré).
  const bx = xA > 0 ? xA : xB < 0 ? xB : null;
  if (bx !== null) {
    r.poly([P(bx, zN, 0), P(bx, zF, 0), P(bx, zF, BH), P(bx, zN, BH)],
      shade(COLORS.doorWoodFrame, fog + 0.08), outline, lw);
  }

  // Face avant : deux planches (teintes alternées, joint, veines discrètes).
  r.poly([P(xA, zN, 0), P(xB, zN, 0), P(xB, zN, BH), P(xA, zN, BH)], wood, outline, lw);
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 2; i++) {
    const h0 = (BH * i) / 2;
    if (i % 2) r.poly([P(xA, zN, h0), P(xB, zN, h0), P(xB, zN, h0 + BH / 2), P(xA, zN, h0 + BH / 2)], shade(COLORS.doorWood, fog + 0.06));
    if (i > 0) {
      const a = P(xA, zN, h0);
      const b = P(xB, zN, h0);
      r.line(a.x, a.y, b.x, b.y, woodDark, 1);
    }
    const vh = h0 + BH / 4;
    const wob = BH * 0.09 * (i % 2 ? 1 : -1);
    const a = P(xA + (xB - xA) * 0.08, zN, vh);
    const m = P(xC, zN, vh + wob);
    const b = P(xB - (xB - xA) * 0.08, zN, vh);
    ctx.strokeStyle = shade(COLORS.doorWood, fog + 0.14);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
    ctx.stroke();
  }
  // Bandes métalliques verticales (bords + centre).
  for (const t of [0.05, 0.5, 0.95]) {
    const xm = xA + (xB - xA) * t;
    const bw = (xB - xA) * 0.018;
    r.poly([P(xm - bw, zN, 0), P(xm + bw, zN, 0), P(xm + bw, zN, BH), P(xm - bw, zN, BH)], metal);
  }

  if (chest.opened) {
    // Intérieur sombre (le dessus de la caisse, en perspective) + couvercle
    // relevé contre le fond : on voit son DESSOUS, un rectangle - les lattes du
    // dôme deviennent des bandes verticales, aux mêmes positions que fermé.
    r.poly([P(xA, zN, BH), P(xB, zN, BH), P(xB, zF, BH), P(xA, zF, BH)], "#1a120c", outline, lw);
    const LH2 = 22; // profondeur du couvercle devenue hauteur, une fois relevé
    const xk = (k: number): number => xC - ((xB - xA) / 2) * Math.cos((Math.PI * k) / 5);
    r.poly([P(xA, zF, BH), P(xB, zF, BH), P(xB, zF, BH + LH2), P(xA, zF, BH + LH2)], wood, woodDark, 1);
    for (let k = 0; k < 5; k++) {
      if (k % 2) {
        r.poly(
          [P(xk(k), zF, BH), P(xk(k + 1), zF, BH),
           P(xk(k + 1), zF, BH + LH2), P(xk(k), zF, BH + LH2)],
          shade(COLORS.doorWood, fog + 0.06),
        );
      }
      if (k > 0) {
        const a = P(xk(k), zF, BH);
        const b = P(xk(k), zF, BH + LH2);
        r.line(a.x, a.y, b.x, b.y, woodDark, 1);
      }
    }
    return;
  }

  // Couvercle bombé : bande de dôme vers le fond, débitée en planches qui
  // courent dans la profondeur (teintes alternées + joints), voûte avant par-dessus.
  r.poly([...arc(zN, LID), ...arc(zF, LID).reverse()], woodTop, outline, lw);
  const domePt = (z: number, t: number): Pt =>
    P(xC - ((xB - xA) / 2) * Math.cos(t), z, BH + LID * Math.sin(t));
  const NB = 5;
  for (let k = 0; k < NB; k++) {
    const t0 = (Math.PI * k) / NB;
    const t1 = (Math.PI * (k + 1)) / NB;
    if (k % 2) {
      const pts: Pt[] = [];
      for (let i = 0; i <= 3; i++) pts.push(domePt(zN, t0 + ((t1 - t0) * i) / 3));
      for (let i = 3; i >= 0; i--) pts.push(domePt(zF, t0 + ((t1 - t0) * i) / 3));
      r.poly(pts, shade(COLORS.doorFrame, fog + 0.06));
    }
    if (k > 0) {
      const a = domePt(zN, t0);
      const b = domePt(zF, t0);
      r.line(a.x, a.y, b.x, b.y, woodDark, 1);
    }
  }
  r.poly(arc(zN, LID), wood, woodDark, 1);
  // Trait de jonction entre la caisse et le couvercle.
  const jA = P(xA, zN, BH);
  const jB = P(xB, zN, BH);
  r.line(jA.x, jA.y, jB.x, jB.y, woodDark, lw);
  // Moraillon + trou de serrure.
  const hw = (xB - xA) * 0.03;
  r.poly([P(xC - hw, zN, BH * 0.5), P(xC + hw, zN, BH * 0.5), P(xC + hw, zN, BH + 2), P(xC - hw, zN, BH + 2)], metal);
  const kh = P(xC, zN, BH * 0.66);
  r.circle(kh.x, kh.y, Math.max(1, (P(xC + hw, zN).x - P(xC - hw, zN).x) * 0.3), "#1a120c");
}

function drawKey(r: Renderer, x: number, cy: number, size: number, color: string): void {
  r.circle(x, cy - size * 0.15, size * 0.22, color);
  r.rect({ x: x - size * 0.05, y: cy - size * 0.05, w: size * 0.1, h: size * 0.5 }, color);
  r.rect({ x: x, y: cy + size * 0.3, w: size * 0.18, h: size * 0.08 }, color);
}

/** Objet tenu en main, dessiné sur la figurine : torche à bout de bras (haute), le reste incliné devant soi. */
function drawHeldItem(r: Renderer, p: FigurePose, pal: FigurePalette = HERO_PAL): void {
  if (!p.inHand) return;
  const s = scaleAt(p.z);
  const feet = floorPoint(p.x, p.z);
  const h = HERO_BASE_H * s; // taille constante (cohérent avec drawHero)
  const w = HERO_BASE_W * s;
  // S'accroupir descend la main du même montant que le buste (cf. drawHero).
  const feetY = feet.y - p.hop * HERO_BASE_H * s * 0.3 + (p.crouching ? h * 0.17 : 0);
  const sign = p.facing === "right" ? 1 : p.facing === "left" ? -1 : 0;

  // --- Bras qui part de l'épaule jusqu'à un point de prise (grip), réutilisé par tous les objets tenus. ---
  const fog = p.z * 0.4;
  const sleeve = shade(pal.tunic, fog + 0.22);
  const skin = shade(pal.skin, fog);
  const outline = "#1a1018";
  const lw = Math.max(1, s * 1.1);
  const armW = w * 0.13;
  const limb = (x0: number, y0: number, x1: number, y1: number, thick: number, col: string): void => {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * thick / 2, ny = (dx / len) * thick / 2;
    r.poly([{ x: x0 + nx, y: y0 + ny }, { x: x1 + nx, y: y1 + ny }, { x: x1 - nx, y: y1 - ny }, { x: x0 - nx, y: y0 - ny }], col, outline, lw);
  };
  const drawHoldArm = (gripX: number, gripY: number, side: number): void => {
    const shoulderY = feetY - h * 0.68; // un peu sous la ligne d'épaule : le bras part bien du corps
    const shoulderHalf = sign !== 0 ? w * 0.26 : w * 0.40;
    const shX = feet.x + side * shoulderHalf * (sign !== 0 ? 0.5 : 0.85);
    // De face le coude part dans l'autre sens (vue miroir) ; dos/profil inchangés.
    const elbowOut = p.facing === "front" ? 1 : -1;
    const elbowX = (shX + gripX) / 2 + elbowOut * side * w * 0.06;
    const elbowY = (shoulderY + gripY) / 2 + h * 0.02;
    limb(shX, shoulderY, elbowX, elbowY, armW, sleeve);    // bras (manche de tunique)
    limb(elbowX, elbowY, gripX, gripY, armW * 0.82, skin); // avant-bras (peau)
  };

  if (p.inHand === "torch") {
    // Brandie en l'air, au-dessus de la tête (bras levé) : la flamme éclaire de haut.
    const torchY = feetY - h * 1.02;
    let tx: number;
    let ty: number;
    if (sign !== 0) {
      tx = feet.x + sign * w * 0.6;
      ty = torchY;
    } else if (p.facing === "front") {
      tx = feet.x + w * 0.2;
      ty = torchY + h * 0.1;
    } else {
      tx = feet.x - w * 0.2;
      ty = torchY - h * 0.05;
    }
    // Bras (épaule -> bas de la torche), dans les 4 directions.
    const side = sign !== 0 ? sign : p.facing === "front" ? 1 : -1;
    const gripX = tx, gripY = ty + h * 0.15;
    drawHoldArm(gripX, gripY, side);

    r.rect({ x: tx - w * 0.04, y: ty - h * 0.02, w: w * 0.08, h: h * 0.3 }, COLORS.torchBracket);
    r.circle(gripX, gripY, w * 0.07, skin);                   // main agrippant la torche
    const tip = ty - h * 0.02;
    if (p.handTorchLit) {
      r.ctx.fillStyle = "rgba(255,150,40,0.12)";
      r.ctx.beginPath();
      r.ctx.arc(tx, tip, w * 0.9, 0, Math.PI * 2);
      r.ctx.fill();
      r.poly([{ x: tx, y: tip - h * 0.2 }, { x: tx + w * 0.14, y: tip }, { x: tx - w * 0.14, y: tip }], COLORS.flameOuter);
      r.poly([{ x: tx, y: tip - h * 0.12 }, { x: tx + w * 0.07, y: tip }, { x: tx - w * 0.07, y: tip }], COLORS.flameInner);
    }
    return;
  }

  if (p.inHand === "crucifix") {
    // Brandi VERTICAL devant le visage, tenu par le bas, dans les 4 directions.
    const c = "#e6e0c8";
    const side = sign !== 0 ? sign : 1;
    const cxPos = sign !== 0 ? feet.x + sign * w * 0.3 : feet.x;
    const gy = feetY - h * 0.66; // bas de la croix = point de prise
    drawHoldArm(cxPos, gy, side);
    const postW = w * 0.035, postTop = gy - h * 0.27; // hauteur /2
    r.rect({ x: cxPos - postW / 2, y: postTop, w: postW, h: gy - postTop }, c);
    const barW = w * 0.18, barH = h * 0.035, barY = gy - h * 0.2;
    r.rect({ x: cxPos - barW / 2, y: barY, w: barW, h: barH }, c);
    r.circle(cxPos, gy, w * 0.06, skin); // main au bas de la croix
    return;
  }

  // Le long du corps mais INCLINÉ ("en italique"), comme tenu devant soi pour s'en servir.
  const ctx = r.ctx;
  const side = sign || 1;
  const ox = feet.x + side * w * 0.3, oy = feetY - h * 0.42;
  // Coup d'épée : l'arme s'abaisse en arc vers l'avant puis remonte, le temps du
  // coup ; la main suit la prise, donc le bras accompagne le geste tout seul.
  const swing = p.inHand === "sword" && p.attackTimer > 0
    ? Math.sin((1 - p.attackTimer / ATTACK_DURATION) * Math.PI)
    : 0;
  const a = side * (0.32 + 1.1 * swing);
  // Épée / pied-de-biche / clés : bras qui part du corps, main au BAS DU MANCHE.
  let lyGrip: number | null = null;
  if (p.inHand === "sword") lyGrip = h * 0.07;
  else if (p.inHand === "crowbar") lyGrip = h * 0.02;
  else if (p.inHand === "ironKey" || p.inHand === "goldKey") lyGrip = -h * 0.04;
  else if (p.inHand === "vial") lyGrip = 0; // prise au goulot (origine de l'objet)
  const gripX = ox - (lyGrip ?? 0) * Math.sin(a);
  const gripY = oy + (lyGrip ?? 0) * Math.cos(a);
  if (lyGrip !== null) drawHoldArm(gripX, gripY, side); // bras dessiné AVANT l'objet (objet au premier plan)
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(a);
  switch (p.inHand) {
    case "sword":
      bar(ctx, -w * 0.03, -h * 0.44, w * 0.06, h * 0.54, "#c8d0d8");
      bar(ctx, -w * 0.1, -h * 0.02, w * 0.2, Math.max(2, w * 0.06), "#caa02f");
      break;
    case "crowbar":
      bar(ctx, -w * 0.03, -h * 0.42, w * 0.06, h * 0.44, "#8a9099");
      bar(ctx, -w * 0.11, -h * 0.42, w * 0.11, Math.max(2, w * 0.06), "#8a9099");
      break;
    case "ironKey":
    case "goldKey": {
      const c = p.inHand === "goldKey" ? COLORS.treasure : "#9aa3ad";
      ctx.fillStyle = c;
      // Anneau (rond) côté corps, près de la main.
      ctx.beginPath();
      ctx.arc(0, -h * 0.04, w * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Tige vers l'extérieur (longueur divisée par 2).
      bar(ctx, -w * 0.025, -h * 0.21, w * 0.05, h * 0.19, c);
      // Deux dents au bout, orientées vers l'extérieur (selon la direction regardée).
      bar(ctx, side > 0 ? 0 : -w * 0.09, -h * 0.21, w * 0.09, Math.max(2, w * 0.04), c);
      bar(ctx, side > 0 ? 0 : -w * 0.06, -h * 0.16, w * 0.06, Math.max(2, w * 0.035), c);
      break;
    }
    case "vial":
      // Petite fiole tenue par le goulot (~3-4x plus petite) : corps sous la main,
      // col (goulot) à l'origine = point de prise, bouchon rouge au-dessus.
      ctx.fillStyle = "#3fce6e";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.054, w * 0.054, h * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      bar(ctx, -w * 0.0216, -h * 0.006, w * 0.0432, h * 0.054, "#3fce6e"); // goulot
      bar(ctx, -w * 0.0264, -h * 0.048, w * 0.0528, h * 0.042, "#d23b3b"); // bouchon
      break;
    default:
      break;
  }
  ctx.restore();
  if (lyGrip !== null) r.circle(gripX, gripY, w * 0.07, skin); // main au bas du manche, par-dessus l'objet
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, bw: number, bh: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, bw, bh);
}

