/**
 * LE PLAN, en version manipulable.
 *
 * Il ne redessine pas la carte du jeu : il réutilise la même déduction
 * (`castleMap()`, `world/mapLayout.ts`), de sorte que ce qu'on voit ici est
 * exactement ce que le joueur verra sous la touche `C`. Contrairement au jeu, il
 * NOMME les salles - c'est un outil, pas un plan d'époque.
 *
 * Deux gestes : cliquer une salle la sélectionne ; tirer d'une salle vers une case
 * voisine y perce un passage (et crée la salle si la case est vide).
 */

import type { RoomId } from "../types";
import { castleMap, levelLabel, DELTA, type CastleMap, type MapRoom, type PlanDir } from "../world/mapLayout";
import { connect, freeRoomId, makeRoom, sideForPlanDir, opposite } from "./doors";
import type { Store } from "./store";

const PAD = 14;
/**
 * Anneau de cases vides autour du plan. `castleMap` ne rend que la boîte
 * englobante des salles existantes : sans cette marge, aucune case libre ne
 * bordant le château, on ne pourrait jamais l'agrandir vers l'extérieur.
 */
const MARGIN = 1;
const PAPER = "#e8dcae";
const INK = "#3a2a18";
const INK_DIM = "#9a8a5e";
const ROOM = "#f5edd4";
const ROOM_DARK = "#c9b992";
const EDGE = "#5a4630";
const SELECTED = "#c0332f";
const START = "#2c7a46";
const GHOST = "rgba(192, 51, 47, 0.35)";

const DOOR_COLOR = { arch: "#9a8a5e", door: "#8a5a2a", grille: "#4a6a86", exit: "#2c7a46" };

export class PlanView {
  private ctx: CanvasRenderingContext2D;
  private map: CastleMap;
  /** Géométrie du dernier rendu, pour retrouver la case sous la souris. */
  private cell = 0;
  private ox = 0;
  private oy = 0;
  /** Tracé en cours : salle de départ et direction visée. */
  private drag: { from: RoomId; gx: number; gy: number; dir: PlanDir | null } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly store: Store,
    private readonly report: (message: string) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D non supporté");
    this.ctx = ctx;
    this.map = this.build();

    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    canvas.addEventListener("pointermove", (e) => this.onMove(e));
    canvas.addEventListener("pointerup", () => this.onUp());
    canvas.addEventListener("pointerleave", () => {
      if (this.drag) {
        this.drag = null;
        this.render();
      }
    });
  }

  /** Plan à jour ; `castleMap` recalcule car chaque édition produit un objet neuf. */
  private build(): CastleMap {
    return castleMap(this.store.castle.rooms, this.store.castle.start);
  }

  /** Niveaux disponibles, du plus haut au plus bas. */
  get levels(): number[] {
    return this.map.levels;
  }

  /**
   * Salles absentes du plan. `castleMap` en écarte les **oubliettes** : on y tombe
   * de n'importe où, aucune porte n'y mène, elles n'ont donc pas de place sur un
   * plan et n'y renseigneraient sur rien. Elles restent pourtant à aménager - d'où
   * cette liste, seule façon de les atteindre puisque le plan est le moyen normal
   * de choisir une salle.
   *
   * On la calcule par différence plutôt que sur le seul champ `oubliette`, pour
   * qu'elle suive d'elle-même si `mapLayout` venait à en écarter d'autres.
   */
  offPlanRooms(): RoomId[] {
    const map = this.build(); // mémoïsé : coût nul juste après un rendu
    return Object.keys(this.store.castle.rooms).filter((id) => !map.byId.has(id));
  }

  levelLabel(): string {
    return levelLabel(this.map, this.store.level);
  }

  render(): void {
    this.map = this.build();
    // Le niveau affiché peut avoir disparu (dernière salle d'un étage supprimée).
    if (!this.map.levels.includes(this.store.level)) this.store.level = this.map.entranceLevel;

    const { ctx, canvas } = this;
    const ratio = devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = Math.max(260, Math.round(w * 0.72));
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.height = `${h}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    this.cell = Math.min((w - PAD * 2) / this.gridCols, (h - PAD * 2) / this.gridRows);
    this.ox = (w - this.cell * this.gridCols) / 2;
    this.oy = (h - this.cell * this.gridRows) / 2;

    this.drawGrid();

    const shown = this.map.rooms.filter((m) => m.level === this.store.level);

    // Liaisons : les passages dont les deux salles ne sont pas mitoyennes.
    ctx.strokeStyle = INK_DIM;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const link of this.map.links) {
      if (link.from.level !== this.store.level || link.to.level !== this.store.level) continue;
      const a = this.centre(link.from);
      const b = this.centre(link.to);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const room of shown) this.drawRoom(room);
    if (this.drag?.dir != null) this.drawDragTarget();
  }

  private get gridCols(): number {
    return this.map.cols + MARGIN * 2;
  }

  private get gridRows(): number {
    return this.map.rows + MARGIN * 2;
  }

  /** Trame légère : elle donne la maille du plan, et où l'on peut poser une salle. */
  private drawGrid(): void {
    const { ctx } = this;
    ctx.strokeStyle = "rgba(58, 42, 24, 0.10)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= this.gridCols; gx++) {
      const x = Math.round(this.ox + gx * this.cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, this.oy);
      ctx.lineTo(x, this.oy + this.gridRows * this.cell);
      ctx.stroke();
    }
    for (let gy = 0; gy <= this.gridRows; gy++) {
      const y = Math.round(this.oy + gy * this.cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(this.ox, y);
      ctx.lineTo(this.ox + this.gridCols * this.cell, y);
      ctx.stroke();
    }
  }

  /** Coin haut-gauche d'une case du plan, marge comprise. */
  private cellXY(gx: number, gy: number): { x: number; y: number } {
    return {
      x: this.ox + (gx - this.map.minX + MARGIN) * this.cell,
      y: this.oy + (gy - this.map.minY + MARGIN) * this.cell,
    };
  }

  private box(room: MapRoom): { x: number; y: number; s: number } {
    const inset = this.cell * 0.09;
    const { x, y } = this.cellXY(room.gx, room.gy);
    return { x: x + inset, y: y + inset, s: this.cell - inset * 2 };
  }

  private centre(room: MapRoom): { x: number; y: number } {
    const b = this.box(room);
    return { x: b.x + b.s / 2, y: b.y + b.s / 2 };
  }

  private drawRoom(room: MapRoom): void {
    const { ctx } = this;
    const { x, y, s } = this.box(room);
    const selected = room.id === this.store.sel.room;

    ctx.fillStyle = room.dark ? ROOM_DARK : ROOM;
    ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = selected ? SELECTED : EDGE;
    ctx.lineWidth = selected ? 2.5 : 1;
    ctx.strokeRect(x, y, s, s);

    // La salle d'entrée porte un liseré vert : c'est par elle qu'on commence.
    if (room.entrance) {
      ctx.strokeStyle = START;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
    }

    for (const door of room.doors) this.drawDoor(x, y, s, door.dir, DOOR_COLOR[door.kind], door.stairs != null);
    if (room.fireplace != null) this.drawFireplace(x, y, s, room.fireplace);
    if (room.down) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + s / 2, y + s * 0.72, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // Le nom, tronqué à la largeur de la case (le plan du jeu, lui, ne nomme rien).
    ctx.fillStyle = INK;
    ctx.font = `${Math.max(8, Math.round(s * 0.17))}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(room.id, x + s / 2, y + s / 2, s - 8);
  }

  /** Ouverture sur un mur, dessinée comme sur la carte du jeu (un trou dans le trait). */
  private drawDoor(x: number, y: number, s: number, dir: PlanDir, color: string, stairs: boolean): void {
    const { ctx } = this;
    const half = s * 0.16;
    const mid = s / 2;
    const at = [
      { x: x + mid, y: y, hx: half, hy: 0 },          // nord
      { x: x + s, y: y + mid, hx: 0, hy: half },      // est
      { x: x + mid, y: y + s, hx: half, hy: 0 },      // sud
      { x: x, y: y + mid, hx: 0, hy: half },          // ouest
    ][dir];

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(at.x - at.hx, at.y - at.hy);
    ctx.lineTo(at.x + at.hx, at.y + at.hy);
    ctx.stroke();

    // Escalier : trois marches posées à côté de la porte, à l'intérieur de la salle.
    if (stairs) {
      const into = DELTA[opposite(dir)];
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        const cx = at.x + into.dx * s * 0.08 * i + (into.dx ? 0 : half * 1.5);
        const cy = at.y + into.dy * s * 0.08 * i + (into.dy ? 0 : half * 1.5);
        ctx.beginPath();
        ctx.moveTo(cx - (into.dx ? 0 : s * 0.05), cy - (into.dy ? 0 : s * 0.05));
        ctx.lineTo(cx + (into.dx ? 0 : s * 0.05), cy + (into.dy ? 0 : s * 0.05));
        ctx.stroke();
      }
    }
  }

  /** Âtre adossé au mur du fond : sur le plan, ce mur est l'orientation de la salle. */
  private drawFireplace(x: number, y: number, s: number, dir: PlanDir): void {
    const { ctx } = this;
    const d = DELTA[dir];
    const cx = x + s / 2 + d.dx * s * 0.34;
    const cy = y + s / 2 + d.dy * s * 0.34;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - s * 0.09, cy - s * 0.09, s * 0.18, s * 0.18);
  }

  /** Aperçu de la salle qu'on est en train de rattacher. */
  private drawDragTarget(): void {
    const drag = this.drag!;
    const d = DELTA[drag.dir!];
    const gx = drag.gx + d.dx;
    const gy = drag.gy + d.dy;
    const { ctx } = this;
    const inset = this.cell * 0.09;
    const { x, y } = this.cellXY(gx, gy);
    ctx.strokeStyle = GHOST;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + inset, y + inset, this.cell - inset * 2, this.cell - inset * 2);
    ctx.setLineDash([]);
  }

  // ── Interaction ─────────────────────────────────────────────────────────

  /** Case du plan sous le pointeur (coordonnées absolues, comme `MapRoom.gx/gy`). */
  private cellAt(e: PointerEvent): { gx: number; gy: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      gx: Math.floor((e.clientX - r.left - this.ox) / this.cell) + this.map.minX - MARGIN,
      gy: Math.floor((e.clientY - r.top - this.oy) / this.cell) + this.map.minY - MARGIN,
    };
  }

  private roomAt(gx: number, gy: number): MapRoom | undefined {
    return this.map.rooms.find((m) => m.level === this.store.level && m.gx === gx && m.gy === gy);
  }

  private onDown(e: PointerEvent): void {
    const { gx, gy } = this.cellAt(e);
    const room = this.roomAt(gx, gy);
    if (!room) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { from: room.id, gx, gy, dir: null };
    this.store.select(room.id);
  }

  private onMove(e: PointerEvent): void {
    if (!this.drag) return;
    const { gx, gy } = this.cellAt(e);
    const dx = gx - this.drag.gx;
    const dy = gy - this.drag.gy;
    // On ne retient qu'un pas orthogonal : une porte relie deux cases mitoyennes.
    let dir: PlanDir | null = null;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 1 : 3;
    else if (Math.abs(dy) > Math.abs(dx)) dir = dy > 0 ? 2 : 0;
    if (dir !== this.drag.dir) {
      this.drag.dir = dir;
      this.render();
    }
  }

  private onUp(): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.dir == null) {
      this.render();
      return;
    }
    const d = DELTA[drag.dir];
    const target = this.roomAt(drag.gx + d.dx, drag.gy + d.dy);
    this.pierce(drag.from, drag.dir, target?.id ?? null);
  }

  /**
   * Perce un passage depuis `from` dans la direction `dir` du plan.
   *
   * Le mur à percer se déduit de l'orientation que le plan a donnée à la salle
   * (inverse de `planDir`). Pour une salle NEUVE, n'importe quel mur ferait
   * l'affaire - elle n'a pas encore d'orientation, et `orientations()` la déduira
   * justement de la paire de portes qu'on écrit ici. On lui donne son mur du fond,
   * si bien qu'elle regardera la salle d'où l'on vient.
   */
  private pierce(from: RoomId, dir: PlanDir, to: RoomId | null): void {
    const source = this.map.byId.get(from);
    if (!source) return;
    const sideA = sideForPlanDir(dir, source.facing);
    const targetPlan = to ? this.map.byId.get(to) : undefined;
    const sideB = targetPlan ? sideForPlanDir(opposite(dir), targetPlan.facing) : "front";

    const refusal = this.store.tryEdit((castle) => {
      let targetId = to;
      if (!targetId) {
        targetId = freeRoomId(castle);
        castle.rooms[targetId] = makeRoom(targetId, `Salle ${targetId}`);
      }
      return connect(castle, from, targetId, sideA, sideB, { arch: true });
    });
    if (refusal) this.report(refusal);
    else if (!to) this.store.select(this.newestRoom());
  }

  /** Après création, on se place dans la salle neuve (la dernière ajoutée). */
  private newestRoom(): RoomId {
    const ids = Object.keys(this.store.castle.rooms);
    return ids[ids.length - 1];
  }
}
