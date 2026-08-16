import type { RoomId } from "../types";
import { COLORS, VIEW_H, VIEW_W } from "../config";
import type { Renderer } from "../engine/Renderer";
import type { CastleMap, MapDoor, MapRoom, PlanDir } from "../world/mapLayout";
import { DELTA, levelLabel } from "../world/mapLayout";

/**
 * LE PLAN (touche C) : un niveau à la fois, dessiné à partir du plan déduit dans
 * `mapLayout.ts`. Une salle = une case ; les portes s'ouvrent sur le mur mitoyen
 * quand les deux salles le sont, sinon un trait relie les deux cases.
 *
 * Aucune coordonnée n'est écrite ici : la mise en page se déduit de l'étendue de
 * la grille, donc un château plus grand ou plus petit s'affiche sans rien changer.
 */

/** Cadre réservé au plan lui-même (le reste : titre, légende, aide). */
const AREA = { x: 26, y: 76, w: VIEW_W - 52, h: 334 };

const cx = VIEW_W / 2;

export function drawCastleMapScreen(
  r: Renderer,
  map: CastleMap,
  level: number,
  currentRoom: RoomId,
  visited: ReadonlySet<RoomId>,
  revealAll: boolean,
): void {
  // Parchemin plein écran.
  r.rect({ x: 0, y: 0, w: VIEW_W, h: VIEW_H }, COLORS.mapPaper);
  r.strokeRect({ x: 6, y: 6, w: VIEW_W - 12, h: VIEW_H - 12 }, COLORS.mapPaperEdge, 3);

  const rooms = map.rooms.filter((m) => m.level === level && (revealAll || visited.has(m.id)));

  r.text("PLAN DU CHATEAU", cx, 40, COLORS.mapInk, 26, "center");
  r.text(levelLabel(map, level), cx, 64, COLORS.mapRoomEdge, 15, "center");

  const cw = AREA.w / map.cols;
  const ch = AREA.h / map.rows;
  const bw = Math.min(cw - 8, 120);
  const bh = Math.min(ch - 6, 44);
  const center = (m: MapRoom) => ({
    x: AREA.x + (m.gx - map.minX + 0.5) * cw,
    y: AREA.y + (m.gy - map.minY + 0.5) * ch,
  });

  // 1. Portes entre salles non mitoyennes : un trait, sous les cases.
  for (const link of map.links) {
    if (link.from.level !== level) continue;
    if (!revealAll && !(visited.has(link.from.id) && visited.has(link.to.id))) continue;
    const a = center(link.from);
    const b = center(link.to);
    r.line(a.x, a.y, b.x, b.y, COLORS.mapInkDim, 1);
  }

  // 2. Les salles. Elles ne portent aucun nom : un plan, pas une liste - la seule
  // salle nommée est celle où l'on se trouve, sous le plan.
  for (const m of rooms) {
    const c = center(m);
    const box = { x: c.x - bw / 2, y: c.y - bh / 2, w: bw, h: bh };
    // Salle noire au départ : case grisée (elle peut s'éclairer, torche à la main).
    const fill = m.dark ? COLORS.mapRoomDark : COLORS.mapRoom;
    r.rect(box, fill);
    r.strokeRect(box, COLORS.mapRoomEdge, 1.5);
    for (const d of m.doors) drawDoor(r, box, d, fill);
    for (const d of m.doors) drawDoorStairs(r, box, d);
    if (m.fireplace !== null) drawFireplace(r, box, m.fireplace);
    drawMarks(r, box, m);
    if (m.id === currentRoom) {
      r.strokeRect({ x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 }, COLORS.mapHere, 2);
      r.circle(c.x, c.y, Math.max(2.5, bh * 0.14), COLORS.mapHere);
    }
  }

  // 3. Légende. Aucune salle n'est nommée, pas même celle où l'on se trouve : le
  // cadre rouge suffit à se situer.
  drawLegend(r, map, level);
}

/** Ouverture sur le mur : on efface le bord, puis on pose le symbole du passage.
 *  `d.dir` est la direction sur le PLAN (0 nord, 1 est, 2 sud, 3 ouest) : le mur du
 *  fond d'une salle tournée vers l'ouest s'ouvre bien sur le bord gauche de sa case. */
function drawDoor(r: Renderer, box: { x: number; y: number; w: number; h: number }, d: MapDoor, paper: string): void {
  const horizontal = d.dir === 0 || d.dir === 2;
  const len = Math.max(6, (horizontal ? box.w : box.h) * 0.34);
  const t = 3; // épaisseur effacée de part et d'autre du trait de mur
  const mid = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const gap = horizontal
    ? { x: mid.x - len / 2, y: (d.dir === 0 ? box.y : box.y + box.h) - t / 2, w: len, h: t }
    : { x: (d.dir === 3 ? box.x : box.x + box.w) - t / 2, y: mid.y - len / 2, w: t, h: len };
  r.rect(gap, paper);
  if (d.kind === "arch") return; // arche : le passage reste ouvert

  const color =
    d.kind === "exit" ? COLORS.mapExit :
    d.kind === "grille" ? COLORS.mapGrille : COLORS.mapDoorWood;

  if (d.kind === "grille") {
    // Trois barreaux en travers de l'ouverture.
    for (let i = 0; i < 3; i++) {
      const f = 0.25 + i * 0.25;
      if (horizontal) r.rect({ x: gap.x + gap.w * f - 0.5, y: gap.y - 1, w: 1, h: gap.h + 2 }, color);
      else r.rect({ x: gap.x - 1, y: gap.y + gap.h * f - 0.5, w: gap.w + 2, h: 1 }, color);
    }
    return;
  }
  // Battant : un trait plein en travers, épais comme celui de la porte de sortie -
  // plus fin, il se perd dans le trait de mur. Sortie et porte ordinaire se
  // distinguent alors par leur couleur, comme la grille.
  const t2 = 3;
  r.rect(horizontal
    ? { x: gap.x, y: gap.y + (gap.h - t2) / 2, w: gap.w, h: t2 }
    : { x: gap.x + (gap.w - t2) / 2, y: gap.y, w: t2, h: gap.h }, color);
}

/** Escalier posé À CÔTÉ de son ouverture, dans la salle : on voit quelle porte monte. */
function drawDoorStairs(r: Renderer, box: { x: number; y: number; w: number; h: number }, d: MapDoor): void {
  if (!d.stairs) return;
  const s = Math.max(3, Math.min(5, box.h * 0.16));
  const horizontal = d.dir === 0 || d.dir === 2;
  const len = Math.max(6, (horizontal ? box.w : box.h) * 0.34);
  const p = horizontal
    ? { x: box.x + box.w / 2 - len / 2 - s - 2, y: (d.dir === 0 ? box.y + s + 1 : box.y + box.h - s - 1) }
    : { x: (d.dir === 3 ? box.x + s + 2 : box.x + box.w - s - 2), y: box.y + box.h / 2 };
  drawStairs(r, p.x, p.y, s, d.stairs === "up", COLORS.mapInk);
}

/** Symboles du contenu structurel de la salle, alignés en bas à droite. */
function drawMarks(r: Renderer, box: { x: number; y: number; w: number; h: number }, m: MapRoom): void {
  const s = Math.max(3, Math.min(5, box.h * 0.16));
  const x = box.x + box.w - s - 4;
  const y = box.y + box.h - s - 3;
  // Le trou au sol n'a pas de place sur un mur : il reste un symbole dans la case.
  // La dale étoile, elle, ne figure pas du tout - elle se voit au sol, dans la salle.
  if (m.down) r.circle(x, y, s * 0.8, COLORS.mapInk);
}

/**
 * Cheminée : adossée au milieu de son mur, l'âtre ouvert vers l'intérieur de la salle
 * - c'est un élément de maçonnerie, il se dessine là où il est. Toutes se ressemblent
 * sur le plan : celles qui s'ouvrent, au joueur de les trouver.
 */
function drawFireplace(r: Renderer, box: { x: number; y: number; w: number; h: number }, dir: PlanDir): void {
  const s = Math.max(3, Math.min(5, box.h * 0.16));
  // Centre du symbole : le milieu du mur, rentré de `s` dans la salle, pour que le dos
  // de la cheminée tombe pile sur le trait de mur.
  const { dx, dy } = DELTA[dir];
  const x = box.x + box.w / 2 + (dx * (box.w / 2 - s));
  const y = box.y + box.h / 2 + (dy * (box.h / 2 - s));
  drawHearth(r, x, y, s, dir, COLORS.mapInk);
}

/** Escalier : deux marches, montantes vers la droite (ou descendantes). */
function drawStairs(r: Renderer, x: number, y: number, s: number, up: boolean, color: string): void {
  const d = up ? 1 : -1;
  r.poly(
    [
      { x: x - d * s, y: y + s }, { x: x - d * s, y }, { x, y },
      { x, y: y - s }, { x: x + d * s, y: y - s }, { x: x + d * s, y: y + s },
    ],
    color,
  );
}

/** Âtre : une cheminée, secrète ou non. Le dos plaqué contre son mur (`dir`), la
 *  hotte ouverte vers l'intérieur de la salle - le symbole tourne avec le mur. */
function drawHearth(r: Renderer, x: number, y: number, s: number, dir: PlanDir, color: string): void {
  // Dessin de référence : cheminée du mur SUD (dir 2), donc évasée vers le haut.
  const shape = [
    { x: -s, y: s }, { x: -s, y: -s * 0.2 },
    { x: 0, y: -s }, { x: s, y: -s * 0.2 }, { x: s, y: s },
  ];
  // Puis autant de quarts de tour (sens horaire) qu'il en faut pour l'amener sur `dir`.
  let turns = (dir - 2 + 4) % 4;
  const pts = shape.map((p) => ({ ...p }));
  for (; turns > 0; turns--) for (const p of pts) [p.x, p.y] = [-p.y, p.x];
  r.poly(pts.map((p) => ({ x: x + p.x, y: y + p.y })), color);
}

function drawLegend(r: Renderer, map: CastleMap, level: number): void {
  const y1 = AREA.y + AREA.h + 22;
  const y2 = y1 + 22;
  const ink = COLORS.mapInk;
  const s = 4;

  // Ligne 1 : symboles de salle.
  let x = 60;
  const item = (draw: () => void, label: string): void => {
    draw();
    r.text(label, x + 12, y1 + 4, ink, 11, "left");
    x += 20 + label.length * 6.6;
  };
  item(() => r.circle(x, y1, s * 0.8, ink), "trou (descente)");
  item(() => drawStairs(r, x, y1, s, true, ink), "escalier (étage)");
  item(() => {
    // Un bout de mur sous l'âtre : la légende dit aussi qu'elle est adossée.
    r.rect({ x: x - s * 1.6, y: y1 + s, w: s * 3.2, h: 1.5 }, COLORS.mapRoomEdge);
    drawHearth(r, x, y1, s, 2, ink);
  }, "cheminée");
  item(() => {
    const box = { x: x - s, y: y1 - s, w: s * 2, h: s * 2 };
    r.rect(box, COLORS.mapRoomDark);
    r.strokeRect(box, COLORS.mapRoomEdge, 1);
  }, "salle noire");
  item(() => r.circle(x, y1, s, COLORS.mapHere), "vous êtes ici");

  // Ligne 2 : natures de passage.
  x = 60;
  // Même épaisseur que sur le plan (3 px) : la légende montre le trait que l'on cherche.
  // L'arche n'y figure pas : c'est une ouverture sans rien en travers, elle se lit
  // toute seule sur le plan - la légende ne sert qu'à nommer les traits.
  const bar = (color: string, label: string, thick = 3): void => {
    r.rect({ x: x - 5, y: y2 - thick / 2, w: 12, h: thick }, color);
    r.text(label, x + 14, y2 + 4, ink, 11, "left");
    x += 22 + label.length * 6.6;
  };
  bar(COLORS.mapDoorWood, "porte");
  bar(COLORS.mapGrille, "grille");
  bar(COLORS.mapExit, "sortie du chateau");

  // Ligne 3 : navigation entre niveaux.
  const above = map.levels.some((l) => l > level);
  const below = map.levels.some((l) => l < level);
  const nav = above || below
    ? `Flèches ${above ? "haut" : ""}${above && below ? " / " : ""}${below ? "bas" : ""} : changer de niveau     `
    : "";
  r.text(`${nav}C ou Echap : refermer la carte`, cx, VIEW_H - 18, COLORS.mapRoomEdge, 12, "center");
}
