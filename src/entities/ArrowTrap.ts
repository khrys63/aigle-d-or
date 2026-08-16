const ARROW_SPEED = 1.3; // un peu plus rapide que l'éclair du fantôme

export class ArrowTrap {
  arrowActive = false;
  arrowX: number;
  readonly arrowDir: number;

  constructor(
    public readonly itemId: string,
    public readonly side: "left" | "right",
    public readonly z: number,
  ) {
    this.arrowDir = side === "left" ? 1 : -1;
    this.arrowX = side === "left" ? -1.0 : 1.0;
  }

  trigger(): void {
    this.arrowActive = true;
    this.arrowX = this.side === "left" ? -1.0 : 1.0;
  }

  update(dt: number): void {
    if (!this.arrowActive) return;
    this.arrowX += this.arrowDir * ARROW_SPEED * dt;
  }
}
