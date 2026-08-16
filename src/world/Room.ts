import type { RoomId } from "../types";
import { DEFAULT_COLS, DEFAULT_ROWS } from "../config";
import { Door } from "../entities/Door";
import { Item } from "../entities/Item";
import { Chest } from "../entities/Chest";
import { Fireplace } from "../entities/Fireplace";
import { Guard } from "../entities/Guard";
import { FURNITURE_W, type DecorDef, type FurnitureDef, type HerseDef, type RoomDef, type SkeletonDef, type TrapDef } from "./rooms";
import { Bat } from "../entities/Bat";
import { Ghost } from "../entities/Ghost";
import { ArrowTrap } from "../entities/ArrowTrap";
import { rowToZ } from "./grid";

/** Torche murale (état d'allumage mutable). */
export interface Torch {
  side: "left" | "right";
  lit: boolean;
}

/** Instance runtime d'une salle. L'état (objets, gardes, torches) persiste. */
export class Room {
  readonly id: RoomId;
  readonly name: string;
  readonly cols: number;
  readonly rows: number;
  readonly round: boolean;
  private readonly walkable: boolean[][];
  readonly doors: Door[];
  readonly items: Item[];
  readonly chests: Chest[];
  readonly guards: Guard[];
  readonly torches: Torch[];
  readonly traps: TrapDef[];
  /** Dalles piégées révélées par une chute ("col,row") : affichées comme des trous. */
  private readonly openedTraps: Set<string>;
  readonly herses: HerseDef[];
  readonly decors: DecorDef[];
  readonly furnitures: FurnitureDef[];
  readonly skeletons: SkeletonDef[];
  readonly herseDropped: boolean[];
  readonly fireplaces: Fireplace[];
  readonly bats: Bat[];
  readonly ghosts: Ghost[];
  readonly arrowTraps: ArrowTrap[];
  readonly isOubliette: boolean;
  /** La salle possède-t-elle une sortie par le plafond (utilisable de partout, a la corde) ? */
  readonly hasCeilingExit: boolean;
  /** Donjon (niveau supérieur) : piège sans porte, seule issue = cheminée secrète (clef en or). */
  readonly isDonjon: boolean;
  /** Dale étoile : G + corde fait monter (target + spawn définis dans la def). */
  readonly climbTile: { col: number; row: number; target: string; spawn: { col: number; row: number } } | null;
  /** Trou de descente - mutable : certains objets le referment à leur ramassage. */
  /** Trou au sol : marcher dessus fait descendre au niveau inférieur. */
  holeTile: { col: number; row: number; target: string; spawn: { col: number; row: number } } | null;

  constructor(def: RoomDef) {
    this.id = def.id;
    this.name = def.name;
    this.round = def.round ?? false;
    this.isOubliette = def.oubliette ?? false;
    this.isDonjon = def.donjon ?? false;
    this.climbTile = def.climbTile ?? null;
    this.holeTile = def.holeTile ?? null;

    if (def.layout) {
      this.rows = def.layout.length;
      this.cols = def.layout[0].length;
      this.walkable = def.layout.map((line) => [...line].map((ch) => ch === "."));
    } else {
      this.cols = def.cols ?? DEFAULT_COLS;
      this.rows = def.rows ?? DEFAULT_ROWS;
      this.walkable = Array.from({ length: this.rows }, () => Array<boolean>(this.cols).fill(true));
    }

    this.doors = def.doors.map(
      (d) =>
        new Door(d.col, d.row, d.side, d.target, d.spawn, d.lock, d.exit ?? false, d.arch ?? false, d.grille ?? false, d.barred ?? false),
    );
    this.items = (def.items ?? []).map((i) => new Item(i.id, i.kind, i.col, i.row, i.amount, i.text, i.pedestal, i.arrowTrap, i.closesHole));
    this.chests = (def.chests ?? []).map(
      (c) => new Chest(c.id, c.col, c.row, c.lock, c.trap ?? false, c.content),
    );
    this.guards = (def.guards ?? []).map(
      (g) => new Guard(g.col ?? g.colMin, g.row, g.colMin, g.colMax, this.cols, this.rows, g.speed),
    );
    // Défaut : une torche allumée de chaque côté (torches: [] = salle sombre).
    this.torches = (def.torches ?? [{ side: "left" }, { side: "right" }]).map(
      (t) => ({ side: t.side, lit: t.lit ?? true }),
    );
    this.traps = def.traps ?? [];
    this.openedTraps = new Set<string>();
    this.herses = def.herses ?? [];
    this.decors = def.decors ?? [];
    this.furnitures = def.furnitures ?? [];
    this.skeletons = def.skeletons ?? [];
    this.herseDropped = this.herses.map(() => false);
    this.fireplaces = (def.fireplaces ?? []).map(
      (f) => new Fireplace(f.id, f.col, f.row, f.secret ?? false, f.target, f.spawn),
    );
    this.bats       = (def.bats   ?? []).map((b) => new Bat(b.row, this.rows, b.speed ?? 1.0, b.col ?? null, this.cols));
    this.ghosts     = (def.ghosts ?? []).map((g) => new Ghost(g.col, g.row, this.cols, this.rows, g.side, g.hits ?? 1));
    this.arrowTraps = this.items
      .filter((i) => i.arrowTrap)
      .map((i) => new ArrowTrap(i.id, i.arrowTrap!.side, rowToZ(i.row, this.rows)));
    this.hasCeilingExit = def.ceilingExit ?? false;
  }

  isWalkable(col: number, row: number): boolean {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    return this.walkable[row][col];
  }

  isGhostAt(col: number, row: number): boolean {
    return this.ghosts.some((g) => g.alive && g.col === col && g.row === row);
  }

  /** Un squelette (3 cases de large, centré sur sk.col) occupe-t-il (col, row) ?
   *  Bloque la marche mais pas le saut - on ne touche pas à `walkable`, sinon le
   *  rendu élèverait des murs latéraux le long de ses cases. */
  isSkeletonAt(col: number, row: number): boolean {
    return this.skeletons.some((sk) => sk.row === row && Math.abs(col - sk.col) <= 1);
  }

  /** Un meuble occupe-t-il (col, row) ? Bloque la marche et l'arrivée d'un saut
   *  (comme les squelettes, on ne touche pas à `walkable` : pas de murs au rendu). */
  isFurnitureAt(col: number, row: number): boolean {
    return this.furnitures.some(
      (f) => f.row === row && col >= f.col && col < f.col + FURNITURE_W[f.kind],
    );
  }

  /** Une salle est éclairée si elle a au moins une torche allumée ; sans torche = sombre. */
  isLit(): boolean {
    return this.torches.length > 0 && this.torches.some((t) => t.lit);
  }

  isClimbTile(col: number, row: number): boolean {
    return this.climbTile !== null && this.climbTile.col === col && this.climbTile.row === row;
  }

  isHoleTile(col: number, row: number): boolean {
    return this.holeTile !== null && this.holeTile.col === col && this.holeTile.row === row;
  }

  /** Referme le trou de descente de la salle (déclenché par certains ramassages). */
  closeHole(): void {
    this.holeTile = null;
  }

  isTrap(col: number, row: number): boolean {
    return this.traps.some((t) => t.col === col && t.row === row);
  }

  trapMarked(col: number, row: number): boolean {
    return this.traps.some((t) => t.col === col && t.row === row && t.marked === true);
  }

  /** Dalle piégée déjà révélée (le joueur y est tombé) : rendue comme un trou béant. */
  isTrapOpen(col: number, row: number): boolean {
    return this.openedTraps.has(`${col},${row}`);
  }

  /** Marque la dalle piégée (col,row) comme révélée après une chute. */
  openTrap(col: number, row: number): void {
    if (this.isTrap(col, row)) this.openedTraps.add(`${col},${row}`);
  }

  /**
   * Herse marquée dont la case d'ATTERRISSAGE est (col, row) : les points d'alerte se
   * posent là où la grille tombe, pas sur la case déclencheuse. On renvoie la herse
   * entière - le rendu a besoin de herseSide pour aligner les points sur sa chute.
   */
  herseMarkAt(col: number, row: number): HerseDef | null {
    return this.herses.find((h) => h.herseCol === col && h.herseRow === row && h.marked === true) ?? null;
  }

  /**
   * Déclenche toute herse dont la case de déclenchement est (col, row).
   * Retourne true si au moins une herse vient de tomber.
   */
  triggerHerse(col: number, row: number): boolean {
    let fell = false;
    this.herses.forEach((h, i) => {
      if (!this.herseDropped[i] && h.triggerCol === col && h.triggerRow === row) {
        (this.herseDropped as boolean[])[i] = true;
        fell = true;
      }
    });
    return fell;
  }

  /**
   * Vrai si une herse tombée bloque le déplacement de (fromCol,fromRow) vers (toCol,toRow).
   * "back" side d'une case = son bord proche (entre herseRow-1 et herseRow).
   * "front" side d'une case = son bord loin (entre herseRow et herseRow+1).
   */
  isHerseBlocking(fromCol: number, fromRow: number, toCol: number, toRow: number): boolean {
    return this.herses.some((h, i) => {
      if (!this.herseDropped[i]) return false;
      const { herseCol: c, herseRow: r, herseSide: s } = h;
      if (s === "front") {
        return fromCol === c && toCol === c &&
          ((fromRow === r && toRow === r + 1) || (fromRow === r + 1 && toRow === r));
      }
      if (s === "back") {
        return fromCol === c && toCol === c &&
          ((fromRow === r - 1 && toRow === r) || (fromRow === r && toRow === r - 1));
      }
      // Herses latérales : toute la profondeur par défaut, bornée à ses rangées
      // si herseRows est défini.
      if (h.herseRows !== undefined && (fromRow < r || fromRow >= r + h.herseRows)) {
        return false;
      }
      if (s === "right") {
        return (fromCol === c && toCol === c + 1) || (fromCol === c + 1 && toCol === c);
      }
      if (s === "left") {
        return (fromCol === c - 1 && toCol === c) || (fromCol === c && toCol === c - 1);
      }
      return false;
    });
  }
}

/** Monde complet : construit toutes les salles une fois, suit la salle courante. */
export class World {
  private readonly rooms = new Map<RoomId, Room>();
  current: Room;
  /** Salles où le héros a mis les pieds (le plan peut n'en montrer que celles-là). */
  readonly visited = new Set<RoomId>();

  constructor(
    readonly startRoom: RoomId,
    /** Données déclaratives du château : le plan (touche C) s'en déduit entièrement. */
    readonly defs: Record<RoomId, RoomDef>,
  ) {
    for (const def of Object.values(defs)) this.rooms.set(def.id, new Room(def));
    const start = this.rooms.get(startRoom);
    if (!start) throw new Error(`Salle de départ introuvable: ${startRoom}`);
    this.current = start;
    this.visited.add(startRoom);
  }

  goTo(id: RoomId): Room {
    const room = this.rooms.get(id);
    if (!room) throw new Error(`Salle introuvable: ${id}`);
    this.current = room;
    this.visited.add(id);
    return room;
  }
}
