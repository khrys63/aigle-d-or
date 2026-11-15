/**
 * LE CHÂTEAU DE L'AIGLE D'OR - le château joué par défaut.
 *
 * Plan du jeu de 1984, reconstruit salle par salle dans l'éditeur, puis exporté au
 * format JSON (`aigle-dor.json`). Ce plan est l'œuvre de Louis-Marie Rocques : il
 * est diffusé ici avec son accord (15 novembre 2026), voir le NOTICE.
 *
 * Il reste un fichier JSON, et non du TypeScript comme `ronceval.ts` : c'est
 * exactement ce que l'éditeur produit et ce que la touche 3 charge, on le
 * retouche donc dans l'éditeur (bouton « Ouvrir… ») plutôt qu'à la main.
 */

import type { CastleDef } from "./rooms";
import { castleFromData } from "./loadCastle";
import data from "./aigle-dor.json";

/** 65 salles ; un fichier invalide ici est une erreur de build, pas de joueur. */
export const AIGLE_DOR_CASTLE: CastleDef = castleFromData(data)!;
