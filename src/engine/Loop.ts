/** Boucle de jeu à pas de temps fixe pour l'update (physique déterministe). */
export class Loop {
  private readonly step = 1 / 60; // pas d'update fixe (s)
  private accumulator = 0;
  private last = 0;
  private running = false;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    // Clamp pour éviter une "spirale de la mort" après un onglet en arrière-plan.
    let frameTime = (now - this.last) / 1000;
    if (frameTime > 0.25) frameTime = 0.25;
    this.last = now;
    this.accumulator += frameTime;

    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    this.render();
    requestAnimationFrame(this.frame);
  };
}
