import type { Dir, HeldItem, InventoryItem } from "../types";
import { MAX_HEALTH } from "../config";
import { colToX, rowToZ } from "../world/grid";
import { emptyInventory } from "../items";

/**
 * Le héros se déplace sur une grille (col, row) propre à la salle courante.
 * `x`/`z` sont la position affichée (interpolée pendant une animation).
 */
export class Player {
  col = 3;
  row = 0;
  x = 0;
  z = 0.12;
  /** Direction regardée (le héros ne bouge que dans cette direction). */
  facing: Dir = "back";

  // Animation d'un déplacement / saut.
  animating = false;
  animT = 0;
  animDur = 0;
  fromX = 0;
  fromZ = 0;
  toX = 0;
  toZ = 0;
  hopArc = false;
  hop = 0;
  /**
   * Saut directionnel (S) décomposé en étapes successives :
   * "crouch" (élan accroupi) → "air" (vol, pose de saut) → "land" (réception
   * accroupie) → "rise" (relève) → "none". Pilote la pose affichée par drawHero.
   */
  leapStage: "none" | "crouch" | "air" | "land" | "rise" = "none";
  leapTimer = 0;
  /** Délai restant après une rotation (bloque la marche le temps d'un éventuel tap). */
  turnGrace = 0;
  /** Direction d'un pas tenté mais bloqué (mur/bord) cette frame - sert aux arches. */
  blockedDir: Dir | null = null;
  /** Verrou de mouvement (s) après une transition : on garde l'orientation d'arrivée. */
  moveLock = 0;

  /** Accroupi : verrouillé par A, on se relève avec Espace. Requis pour ramasser au sol. */
  crouching = false;

  /**
   * Grimpe à la corde : "throw" (le grappin monte au plafond en déroulant la corde)
   * puis "up" (le héros se hisse et sort par le plafond). Bloque le reste du jeu.
   */
  climbStage: "none" | "throw" | "up" = "none";
  climbT = 0;

  /** Parchemins ramassés (leur texte) ; lus à la suite avec L. */
  readonly parchments: string[] = [];
  /** Index du prochain parchemin lu (rotation à chaque appui sur L). */
  parchmentReadIdx = 0;

  health = MAX_HEALTH;
  /** Invincibilité après un coup reçu (s restantes). */
  invuln = 0;
  /** Hémorragie en cours : la vie baisse jusqu'à boire une fiole. */
  bleeding = false;
  /** Carburant restant (s) de la torche allumée en main. */
  torchFuel = 0;
  /** Coup d'épée actif (s restantes) et recharge. */
  attackTimer = 0;
  attackCooldown = 0;

  /** Usure du pied de biche : il casse après `crowbarLife` usages (tiré entre 30 et 40). */
  crowbarWear = 0;
  crowbarLife = 30 + Math.floor(Math.random() * 11);
  /** Vient de casser ce tour-ci (Game affiche le message puis remet à faux). */
  crowbarBroke = false;

  /**
   * File des fioles dans l'ordre d'acquisition (true = empoisonnée) : on les boit
   * dans cet ordre, et une empoisonnée - ramassée comme une fiole normale, rien ne
   * la trahit - empoisonne à la consommation. Tenue en phase avec inventory.vial.
   */
  readonly vialQueue: boolean[] = [];

  /** Inventaire (nombre par objet) et objet tenu en main. */
  readonly inventory = emptyInventory();
  inHand: HeldItem | null = null;
  /** La torche tenue en main est-elle allumée ? (éteinte par défaut quand on la prend en main) */
  handTorchLit = false;

  treasures = 0;
  /** Points accumulés en ramassant des objets (barème SCORE dans items.ts). */
  score = 0;
  /** Les trois trophées de la quête (puissance / richesse / sagesse). */
  hasEagle = false;
  hasDiamond = false;
  hasBook = false;
  /** Bourse (pièces d'or) - 500 au début de la partie. */
  gold = 500;
  /** Bague maudite ramassée : on ne voit plus les pièges (oubliettes). */
  hasRing = false;

  /** A-t-on les trois objets de la quête ? */
  get hasAllQuest(): boolean {
    return this.hasEagle && this.hasDiamond && this.hasBook;
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  get isAttacking(): boolean {
    return this.attackTimer > 0;
  }

  owns(item: InventoryItem): boolean {
    return this.inventory[item] > 0;
  }

  /** Place instantanément le héros sur une case de la salle (cols×rows). */
  placeAt(col: number, row: number, cols: number, rows: number): void {
    this.col = col;
    this.row = row;
    this.x = this.fromX = this.toX = colToX(col, cols);
    this.z = this.fromZ = this.toZ = rowToZ(row, rows);
    this.animating = false;
    this.animT = 0;
    this.hop = 0;
    this.hopArc = false;
    this.turnGrace = 0;
    this.leapStage = "none";
    this.leapTimer = 0;
    this.climbStage = "none";
    this.climbT = 0;
  }
}
