import type { ItemKind } from "../types";
import type { Lock } from "./Door";

/** Contenu révélé par un coffre (objet posé sur la case à l'ouverture). */
export interface ChestContent {
  kind: ItemKind;
  amount?: number; // bourse : quantité d'or
  text?: string; // parchemin / livre : texte lisible (L)
}

/** Coffre posé sur une case : conteneur ouvert au pied de biche (ou autre verrou). */
export class Chest {
  opened = false;

  constructor(
    public readonly id: string,
    public readonly col: number,
    public readonly row: number,
    /** Objet à tenir EN MAIN pour ouvrir (pied de biche en démo) ; sinon ouverture libre. */
    public readonly lock?: Lock,
    /** Coffre piégé : l'ouvrir fait chuter en oubliette. */
    public readonly trap = false,
    /** Butin révélé au sol à l'ouverture ; absent => coffre vide. */
    public readonly content?: ChestContent,
  ) {}
}
