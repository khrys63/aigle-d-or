import type { RoomId } from "../types";
import type { Spawn } from "./Door";

/** Cheminée murale sur le mur du fond (3 cases de large, centrée sur col).
 *  - Décorative : deux montants avec cercles vides, pas d'interaction.
 *  - Passage secret (secret=true) : montant gauche = cercle plein ;
 *    clé en or sur le montant gauche (O) → ouvre ; accroupi au centre + ↑ → passage. */
export class Fireplace {
  opened = false;

  constructor(
    readonly id: string,
    readonly col: number,
    readonly row: number,
    readonly secret: boolean = false,
    readonly target?: RoomId,
    readonly spawn?: Spawn,
  ) {}
}
