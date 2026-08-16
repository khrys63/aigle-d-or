import { colToX, rowToZ } from "../world/grid";

const BOLT_SPEED    = 1.0;   // unités-monde/s (ralenti)
const IDLE_TIME     = 2.5;   // s avant le premier tir
const WALL_COOLDOWN = 1.0;   // s après que le bolt touche le mur
const CLEAR_DIST    = 0.15;  // distance min avant de considérer que le bolt a quitté le fantôme

export class Ghost {
  readonly x: number;
  readonly z: number;
  alive      = true;
  hitsLeft:  number;
  floatT     = 0;
  phaseTimer = IDLE_TIME;

  boltActive       = false;
  boltX            = 0;
  boltDir          = 1;
  boltDeflected    = false;
  boltClearedGhost = false;

  private readonly boltDirBase: number;

  constructor(
    public readonly col: number,
    public readonly row: number,
    cols: number,
    rows: number,
    public readonly side: "left" | "right",
    hits = 1,
  ) {
    this.x           = colToX(col, cols);
    this.z           = rowToZ(row, rows);
    this.boltDirBase = side === "left" ? 1 : -1;
    this.boltX       = this.x;
    this.hitsLeft    = hits;
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.floatT += dt;
    if (this.boltActive) {
      this.boltX += this.boltDir * BOLT_SPEED * dt;
      if (!this.boltClearedGhost && Math.abs(this.boltX - this.x) > CLEAR_DIST) {
        this.boltClearedGhost = true;
      }
      return;
    }
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      this.boltActive      = true;
      this.boltX           = this.x;
      this.boltDir         = this.boltDirBase;
      this.boltDeflected   = false;
      this.boltClearedGhost = false;
    }
  }

  deflectBolt(): void {
    this.boltDir      = -this.boltDir;
    this.boltDeflected = true;
  }

  /** Bolt manqué (a touché un mur ou le joueur) : cooldown avant de retirer. */
  resetBolt(): void {
    this.boltActive      = false;
    this.boltX           = this.x;
    this.boltClearedGhost = false;
    this.phaseTimer      = WALL_COOLDOWN;
  }
}
