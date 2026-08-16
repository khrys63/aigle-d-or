/**
 * LA SALLE, vue de dessus.
 *
 * Le jeu montre les salles de face, en perspective ; pour les bâtir il faut le plan
 * du sol. On garde le repère du format : `col` de 0 (gauche) à cols−1, `row` de 0
 * (l'avant, côté caméra) au fond - donc **la rangée 0 est en bas** de la vue, et le
 * mur du fond en haut, comme sur un plan que l'on dessinerait devant la salle.
 *
 * Un outil est actif à la fois : « Sélection » choisit, « Sol » creuse ou rebouche,
 * les autres posent leur élément sur la case cliquée.
 */

import type { RoomId } from "../types";
import type { DoorSide } from "../entities/Door";
import { FURNITURE_W, type FurnitureKind, type RoomDef } from "../world/rooms";
import { isFloor, roomSize } from "./doors";
import type { ListKey, Store } from "./store";

/** Outils de la palette : « ce que fait un clic sur une case ». */
export type Tool =
  | "select" | "floor"
  | "items" | "guards" | "chests" | "traps" | "herses" | "furnitures"
  | "skeletons" | "fireplaces" | "bats" | "ghosts"
  | "climbTile" | "holeTile";

export const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "select", label: "Sélection" },
  { tool: "floor", label: "Sol" },
  { tool: "items", label: "Objet" },
  { tool: "guards", label: "Garde" },
  { tool: "chests", label: "Coffre" },
  { tool: "traps", label: "Dalle piégée" },
  { tool: "herses", label: "Herse" },
  { tool: "furnitures", label: "Meuble" },
  { tool: "skeletons", label: "Squelette" },
  { tool: "fireplaces", label: "Cheminée" },
  { tool: "bats", label: "Chauve-souris" },
  { tool: "ghosts", label: "Fantôme" },
  { tool: "climbTile", label: "Dalle étoile" },
  { tool: "holeTile", label: "Trou" },
];

const FLOOR = "#211a2e";
const FLOOR_ALT = "#312748";
const VOID = "#0b0810";
const GRID = "#3a3050";
const SELECTED = "#ffd24a";

/** Couleur et sigle de chaque élément posé sur une case. */
const GLYPH: Record<string, { color: string; sign: string }> = {
  items: { color: "#ffaa33", sign: "◆" },
  guards: { color: "#d2492f", sign: "G" },
  chests: { color: "#b8895a", sign: "▭" },
  traps: { color: "#8a2740", sign: "✕" },
  herses: { color: "#8a93a0", sign: "H" },
  furnitures: { color: "#6b3f23", sign: "▬" },
  skeletons: { color: "#cfc3ad", sign: "☠" },
  fireplaces: { color: "#ff7a1a", sign: "▣" },
  bats: { color: "#7a5aa8", sign: "^" },
  ghosts: { color: "#9fd7ff", sign: "○" },
  climbTile: { color: "#7fd2ff", sign: "★" },
  holeTile: { color: "#0e0814", sign: "●" },
};

/** Largeur en dalles d'un élément, à partir de sa case d'ancrage. */
function spanOf(list: ListKey | "climbTile" | "holeTile", element: any): { from: number; to: number } {
  if (list === "furnitures") {
    const w = FURNITURE_W[(element.kind as FurnitureKind) ?? "chaise"];
    return { from: element.col, to: element.col + w - 1 };
  }
  // Coffres, cheminées et squelettes occupent 3 dalles, centrées sur `col`.
  if (list === "chests" || list === "fireplaces" || list === "skeletons") {
    return { from: element.col - 1, to: element.col + 1 };
  }
  return { from: element.col, to: element.col };
}

export class RoomView {
  private ctx: CanvasRenderingContext2D;
  tool: Tool = "select";
  /** Herse en cours de pose : la case déclencheuse attend sa case de chute. */
  private pendingHerse: { col: number; row: number } | null = null;
  /** Géométrie du dernier rendu. */
  private tile = 0;
  private ox = 0;
  private oy = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly store: Store,
    private readonly report: (message: string) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D non supporté");
    this.ctx = ctx;
    canvas.addEventListener("pointerdown", (e) => this.onClick(e));
  }

  render(): void {
    const room = this.store.room;
    const { cols, rows } = roomSize(room);
    const { ctx, canvas } = this;

    const ratio = devicePixelRatio || 1;
    const w = canvas.clientWidth;
    this.tile = Math.floor((w - 2) / cols);
    const h = this.tile * rows + 2;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    canvas.style.height = `${h}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.ox = Math.round((w - this.tile * cols) / 2);
    this.oy = 1;

    ctx.fillStyle = VOID;
    ctx.fillRect(0, 0, w, h);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const { x, y } = this.tileXY(col, row, rows);
        ctx.fillStyle = isFloor(room, col, row) ? ((col + row) % 2 ? FLOOR_ALT : FLOOR) : VOID;
        ctx.fillRect(x, y, this.tile, this.tile);
        ctx.strokeStyle = GRID;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, this.tile - 1, this.tile - 1);
      }
    }

    this.drawElements(room, rows);
    this.drawDoors(room, rows);
    this.drawTorches(room, rows, cols);
  }

  /** Coin haut-gauche d'une case : la rangée 0 est en BAS (côté caméra). */
  private tileXY(col: number, row: number, rows: number): { x: number; y: number } {
    return { x: this.ox + col * this.tile, y: this.oy + (rows - 1 - row) * this.tile };
  }

  private drawElements(room: RoomDef, rows: number): void {
    const { ctx } = this;
    const lists: (ListKey | "climbTile" | "holeTile")[] = [
      "furnitures", "skeletons", "chests", "fireplaces", "traps", "herses",
      "guards", "bats", "ghosts", "items", "climbTile", "holeTile",
    ];

    for (const list of lists) {
      const value = room[list as keyof RoomDef];
      const elements: any[] = list === "climbTile" || list === "holeTile"
        ? (value ? [value] : [])
        : ((value as any[]) ?? []);

      elements.forEach((element, index) => {
        const glyph = GLYPH[list];
        const span = spanOf(list, element);
        const row = element.row ?? 0;
        const { x, y } = this.tileXY(span.from, row, rows);
        const w = (span.to - span.from + 1) * this.tile;

        ctx.fillStyle = glyph.color;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x + 2, y + 2, w - 4, this.tile - 4);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = glyph.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2.5, y + 2.5, w - 5, this.tile - 5);

        ctx.fillStyle = glyph.color;
        ctx.font = `${Math.round(this.tile * 0.5)}px ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(glyph.sign, x + w / 2, y + this.tile / 2);

        // Un garde patrouille : on trace sa course, de colMin à colMax.
        if (list === "guards") {
          const a = this.tileXY(element.colMin, row, rows);
          const b = this.tileXY(element.colMax, row, rows);
          ctx.strokeStyle = glyph.color;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(a.x + 2, y + this.tile / 2);
          ctx.lineTo(b.x + this.tile - 2, y + this.tile / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Une herse tombe ailleurs qu'à son déclencheur : on relie les deux.
        if (list === "herses") {
          const fall = this.tileXY(element.herseCol, element.herseRow, rows);
          ctx.strokeStyle = glyph.color;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(x + this.tile / 2, y + this.tile / 2);
          ctx.lineTo(fall.x + this.tile / 2, fall.y + this.tile / 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeRect(fall.x + 4.5, fall.y + 4.5, this.tile - 9, this.tile - 9);
        }

        if (this.isSelected(list, index)) {
          ctx.strokeStyle = SELECTED;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, w - 2, this.tile - 2);
        }
      });
    }
  }

  private isSelected(list: string, index: number): boolean {
    return this.store.sel.list === list && this.store.sel.index === index;
  }

  private drawDoors(room: RoomDef, rows: number): void {
    const { ctx } = this;
    room.doors.forEach((door, index) => {
      const { x, y } = this.tileXY(door.col, door.row, rows);
      const t = this.tile;
      // Le mur du fond est en haut de la vue, l'avant en bas.
      const edge: Record<DoorSide, [number, number, number, number]> = {
        front: [x, y, x + t, y],
        back: [x, y + t, x + t, y + t],
        left: [x, y, x, y + t],
        right: [x + t, y, x + t, y + t],
      };
      const [x1, y1, x2, y2] = edge[door.side];
      ctx.strokeStyle = door.exit ? "#2c8a4e" : door.arch ? "#9a8fb0" : door.grille ? "#4a6a86" : "#c08a4a";
      ctx.lineWidth = this.isSelected("doors", index) ? 6 : 4;
      if (door.barred) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.isSelected("doors", index)) {
        ctx.strokeStyle = SELECTED;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, t - 2, t - 2);
      }
    });
  }

  /** Torches murales : au premier plan, en bas à gauche et à droite de la salle. */
  private drawTorches(room: RoomDef, rows: number, cols: number): void {
    const { ctx } = this;
    const torches = room.torches ?? [{ side: "left" as const }, { side: "right" as const }];
    torches.forEach((torch, index) => {
      const col = torch.side === "left" ? 0 : cols - 1;
      const { x, y } = this.tileXY(col, 0, rows);
      ctx.fillStyle = (torch.lit ?? true) ? "#ff7a1a" : "#4a3a28";
      ctx.beginPath();
      ctx.arc(x + (torch.side === "left" ? 5 : this.tile - 5), y + this.tile - 5, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (this.isSelected("torches", index)) {
        ctx.strokeStyle = SELECTED;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  // ── Interaction ─────────────────────────────────────────────────────────

  private onClick(e: PointerEvent): void {
    const room = this.store.room;
    const { cols, rows } = roomSize(room);
    const rect = this.canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left - this.ox) / this.tile);
    const row = rows - 1 - Math.floor((e.clientY - rect.top - this.oy) / this.tile);
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;

    if (this.tool === "select") return this.selectAt(room, col, row);
    if (this.tool === "floor") return this.paintFloor(col, row);
    this.place(this.tool, col, row);
  }

  /** Clic de sélection : le dernier élément posé sur la case l'emporte. */
  private selectAt(room: RoomDef, col: number, row: number): void {
    const lists: ListKey[] = [
      "doors", "items", "guards", "chests", "traps", "herses", "furnitures",
      "skeletons", "fireplaces", "bats", "ghosts",
    ];
    for (const list of lists) {
      const elements = (room[list] as any[]) ?? [];
      for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        const span = spanOf(list, element);
        const elementRow = element.row ?? 0;
        if (elementRow === row && col >= span.from && col <= span.to) {
          this.store.select(this.store.sel.room, list, i);
          return;
        }
      }
    }
    this.store.select(this.store.sel.room); // la case est nue : on montre la salle
  }

  /**
   * Creuse ou rebouche une case. Tant que la salle reste un rectangle plein, on ne
   * lui écrit pas de `layout` - le format veut qu'on n'énonce que ce qui s'écarte
   * du défaut, et un `layout` de « que du sol » serait du bruit.
   */
  private paintFloor(col: number, row: number): void {
    const id = this.store.sel.room;
    this.store.edit((castle) => {
      const room = castle.rooms[id];
      const { cols, rows } = roomSize(room);
      const grid = room.layout
        ? room.layout.map((line) => [...line])
        : Array.from({ length: rows }, () => Array<string>(cols).fill("."));
      grid[row][col] = grid[row][col] === "." ? "#" : ".";
      const layout = grid.map((line) => line.join(""));

      if (layout.every((line) => !line.includes("#"))) {
        delete room.layout;
        room.cols = cols;
        room.rows = rows;
      } else {
        room.layout = layout;
        delete room.cols;
        delete room.rows;
      }
    });
  }

  /** Pose l'élément de l'outil actif sur la case, avec des valeurs par défaut saines. */
  private place(tool: Exclude<Tool, "select" | "floor">, col: number, row: number): void {
    const id = this.store.sel.room;

    if (tool === "herses") {
      if (!this.pendingHerse) {
        this.pendingHerse = { col, row };
        this.report("Herse : cliquez maintenant la case où elle tombe.");
        return;
      }
      const trigger = this.pendingHerse;
      this.pendingHerse = null;
      this.commit(id, "herses", {
        triggerCol: trigger.col, triggerRow: trigger.row,
        herseCol: col, herseRow: row, herseSide: "front", marked: true,
      });
      return;
    }

    if (tool === "climbTile" || tool === "holeTile") {
      // Cible et arrivée restent à choisir dans l'inspecteur : le validateur y veille.
      this.store.edit((castle) => {
        castle.rooms[id][tool] = { col, row, target: "", spawn: { col: 0, row: 0 } };
      });
      this.store.select(id, null);
      return;
    }

    const n = ((this.store.room[tool] as any[]) ?? []).length;
    const defaults: Record<string, any> = {
      items: { id: `item-${id}-${n + 1}`, kind: "treasure", col, row },
      guards: { row, colMin: Math.max(0, col - 3), colMax: col + 3, col },
      chests: { id: `chest-${id}-${n + 1}`, col, row },
      traps: { col, row, marked: true },
      furnitures: { kind: "chaise", col, row },
      skeletons: { col, row },
      fireplaces: { id: `fp-${id}-${n + 1}`, col, row },
      bats: { row, col },
      ghosts: { col, row, side: "left" },
    };
    this.commit(id, tool as ListKey, defaults[tool]);
  }

  /** Ajoute l'élément et le sélectionne, en refusant ce qui déborde de la salle. */
  private commit(id: RoomId, list: ListKey, element: any): void {
    const room = this.store.room;
    const { cols } = roomSize(room);
    const span = spanOf(list, element);
    if (span.from < 0 || span.to >= cols) {
      this.report("L'élément déborde de la salle : décalez-le vers le centre.");
      return;
    }
    this.store.edit((castle) => {
      const target = castle.rooms[id] as any;
      (target[list] ??= []).push(element);
    });
    this.store.select(id, list, ((room[list] as any[]) ?? []).length);
  }
}
