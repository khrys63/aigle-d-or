/**
 * Gestion clavier avec détection de fronts.
 *
 * Deux espaces de touches :
 *  - par `code` (position physique) : flèches, chiffres, Entrée - indépendant du layout ;
 *  - par `char` (lettre réellement saisie, e.key) : actions-lettres (A, S, D, O…) -
 *    suit le layout, donc correct en AZERTY (où A et Q ne sont pas à la même place
 *    physique qu'en QWERTY).
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private chars = new Set<string>();
  private charsPressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (HANDLED.has(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      const ch = letterOf(e.key);
      if (ch) {
        if (!this.chars.has(ch)) this.charsPressed.add(ch);
        this.chars.add(ch);
      }
    });
    target.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      const ch = letterOf(e.key);
      if (ch) this.chars.delete(ch);
    });
  }

  /** Touche maintenue, par position physique (flèches, chiffres…). */
  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** Front d'appui, par position physique (consommé). */
  wasPressed(code: string): boolean {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Lettre maintenue (selon le layout : "a", "s", "q"…). */
  isChar(ch: string): boolean {
    return this.chars.has(ch);
  }

  /** Front d'appui d'une lettre (consommé). */
  wasChar(ch: string): boolean {
    if (this.charsPressed.has(ch)) {
      this.charsPressed.delete(ch);
      return true;
    }
    return false;
  }

  endFrame(): void {
    this.pressed.clear();
    this.charsPressed.clear();
  }
}

/** Retourne la lettre a-z d'un e.key, ou null. */
function letterOf(key: string): string | null {
  if (key.length !== 1) return null;
  const ch = key.toLowerCase();
  return ch >= "a" && ch <= "z" ? ch : null;
}

const HANDLED = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  // En AZERTY, les chiffres non shiftés produisent ' " è ç… — Firefox ouvre sa
  // recherche rapide sur ' et /, d'où le preventDefault sur toute la rangée.
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
  ...Array.from({ length: 10 }, (_, i) => `Numpad${i}`),
]);
