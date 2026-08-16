import type { ItemKind } from "../types";

/** Objet ramassable / lisible posé sur une case de la grille. */
export class Item {
  collected = false;

  constructor(
    public readonly id: string,
    public readonly kind: ItemKind,
    public readonly col: number,
    public readonly row: number,
    /** Pour une bourse : quantité d'or (sinon tirée au hasard à la prise). */
    public readonly amount = 0,
    /** Texte lisible (parchemins, livre sacré). */
    public readonly text = "",
    /** Posé sur un piédestal : ramassable debout (sans s'accroupir). */
    public readonly pedestal = false,
    /** Piège flèche : déclenché au ramassage ; indique le mur d'où sort la flèche. */
    public readonly arrowTrap?: { side: "left" | "right" },
    /** Au ramassage, referme le trou au sol de la salle. */
    public readonly closesHole = false,
  ) {}
}
