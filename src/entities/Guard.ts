import { colToX, rowToZ } from "../world/grid";

/** Garde patrouillant en aller-retour le long d'une rangée (entre colMin et colMax). */
export class Guard {
  alive = true;
  hitCooldown = 0;
  /** Position courante en colonnes (flottante). */
  col: number;
  private vc: number; // vitesse en colonnes/s

  constructor(
    colStart: number,
    public readonly row: number,
    public readonly colMin: number,
    public readonly colMax: number,
    private readonly cols: number,
    private readonly rows: number,
    speed = 1.8,
  ) {
    this.col = colStart;
    this.vc = speed;
  }

  get x(): number {
    return colToX(this.col, this.cols);
  }

  get z(): number {
    return rowToZ(this.row, this.rows);
  }

  get facing(): 1 | -1 {
    return this.vc >= 0 ? 1 : -1;
  }

  update(dt: number): void {
    if (!this.alive) return;
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    this.col += this.vc * dt;
    if (this.col <= this.colMin) {
      this.col = this.colMin;
      this.vc = Math.abs(this.vc);
    } else if (this.col >= this.colMax) {
      this.col = this.colMax;
      this.vc = -Math.abs(this.vc);
    }
  }
}
