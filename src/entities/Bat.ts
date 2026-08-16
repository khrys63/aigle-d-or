import { colToX, rowToZ } from "../world/grid";

const DIVE_DOWN = 0.18;
const DIVE_UP   = 0.24;
const H_NORMAL  = 0.88;
const H_NADIR   = 0.10;

export class Bat {
  x: number;
  readonly z: number;
  dir = 1;
  /** Vivante ? Une torche allumée brandie en plein saut l'enflamme. */
  alive = true;
  readonly speed: number;
  heightFrac = H_NORMAL;
  private diveTimer = -1;
  private cooldown  = 0;

  constructor(row: number, rows: number, speed: number, col: number | null, cols: number) {
    this.z     = rowToZ(row, rows);
    this.speed = speed;
    this.x     = col !== null ? colToX(col, cols) : 0;
  }

  update(dt: number): void {
    this.x += this.dir * this.speed * dt;
    if (this.x >= 1)  { this.x =  1; this.dir = -1; }
    if (this.x <= -1) { this.x = -1; this.dir =  1; }
    if (this.cooldown > 0) this.cooldown -= dt;

    if (this.diveTimer >= 0) {
      this.diveTimer += dt;
      if (this.diveTimer < DIVE_DOWN) {
        this.heightFrac = H_NORMAL - (H_NORMAL - H_NADIR) * (this.diveTimer / DIVE_DOWN);
      } else if (this.diveTimer < DIVE_DOWN + DIVE_UP) {
        this.heightFrac = H_NADIR + (H_NORMAL - H_NADIR) * ((this.diveTimer - DIVE_DOWN) / DIVE_UP);
      } else {
        this.diveTimer = -1;
        this.heightFrac = H_NORMAL;
      }
    }
  }

  isNearPlayer(px: number, pz: number): boolean {
    return Math.abs(this.x - px) < 0.15 && Math.abs(this.z - pz) < 0.22;
  }

  get canDive(): boolean {
    return this.diveTimer < 0 && this.cooldown <= 0;
  }

  dive(): void {
    this.diveTimer = 0;
    this.cooldown  = DIVE_DOWN + DIVE_UP + 0.5;
  }

  /** Nadir de la piqûe : fenêtre de frappe. */
  get isStriking(): boolean {
    return this.diveTimer >= DIVE_DOWN - 0.04 && this.diveTimer < DIVE_DOWN + 0.08;
  }
}
