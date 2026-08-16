import type { RoomId } from "../types";

/** Arête de la case où l'ouverture est dessinée. */
export type DoorSide = "front" | "back" | "left" | "right";

/** Objet à tenir EN MAIN pour ouvrir la porte.
 *  La clé en or n'ouvre PAS les portes - elle sert uniquement aux cheminées secrètes. */
export type Lock = "ironKey" | "crowbar";

/** Cible d'apparition : une case de la salle de destination. */
export interface Spawn {
  col: number;
  row: number;
}

/** Porte située sur une case (col, row). */
export class Door {
  /** Une fois ouverte, le reste (clé/pied de biche consommés à l'usage, pas l'objet). */
  opened = false;
  /** Résistances restantes : une porte au pied de biche cède après 1 à 2 coups. */
  resist: number;

  constructor(
    public readonly col: number,
    public readonly row: number,
    /** front = mur du fond, back = vers la caméra, left/right = murs latéraux. */
    public readonly side: DoorSide,
    public readonly target: RoomId,
    public readonly spawn: Spawn,
    /** Serrure éventuelle (sinon porte libre). */
    public readonly lock?: Lock,
    /** Vraie pour la porte de sortie du château (condition de victoire). */
    public readonly exit = false,
    /** Arche : pas de porte ; on passe en faisant un pas dessus (sans Ouvrir). */
    public readonly arch = false,
    /** Grille (barreaux d'acier) plutôt qu'une porte en bois pleine. */
    public readonly grille = false,
    /** Barrée de ce côté : visible et infranchissable, s'ouvre depuis l'autre côté. */
    public readonly barred = false,
  ) {
    // Une porte au pied de biche résiste 1 ou 2 fois avant de céder.
    this.resist = lock === "crowbar" ? 1 + Math.floor(Math.random() * 2) : 0;
  }

  /** La porte bloque-t-elle encore le passage ? */
  get isLocked(): boolean {
    return this.lock !== undefined && !this.opened;
  }
}
