import type { InventoryItem } from "../types";
import { COLORS, VIEW_H, VIEW_W } from "../config";
import type { Renderer } from "../engine/Renderer";
import type { Player } from "../entities/Player";
import { HELD_KEYS, HELD_NAME, SHOP } from "../items";

function overlay(r: Renderer): void {
  r.ctx.fillStyle = "rgba(8, 4, 16, 0.82)";
  r.ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

const cx = VIEW_W / 2;

/**
 * Écran-titre. Le texte est de nous : rien n'est repris de l'écran d'origine, dont
 * la prose appartient à son auteur (voir NOTICE). Le sous-titre dit d'entrée à qui
 * l'on doit l'idée, et ce que ce projet n'est pas.
 */
export function drawTitle(r: Renderer): void {
  overlay(r);
  r.text("L'AIGLE D'OR", cx, 66, COLORS.eagle, 56, "center");
  r.text("Hommage non officiel à l'œuvre de Louis-Marie Rocques (Loriciels, 1984)", cx, 100, COLORS.text, 15, "center");
  r.text("Projet indépendant, sans lien avec l'auteur ni ses ayants droit", cx, 122, COLORS.textDim, 13, "center");

  r.text("Trois jours de selle sous la pluie, et le donjon de Ronceval se lève", cx, 190, COLORS.text, 14, "center");
  r.text("enfin au bout de la lande.", cx, 210, COLORS.text, 14, "center");
  r.text("On dit au village qu'il garde plus d'or qu'un royaume - et qu'aucun", cx, 250, COLORS.text, 14, "center");
  r.text("de ceux qui ont poussé sa porte n'est revenu le raconter.", cx, 270, COLORS.text, 14, "center");
  r.text("Vous n'emportez qu'une bourse et l'idée fixe de trois reliques :", cx, 310, COLORS.text, 14, "center");
  r.text("le Livre, le Diamant, l'Aigle d'Or.", cx, 332, COLORS.eagle, 15, "center");
  r.text("Appuyez sur ENTREE pour commencer", cx, 480, COLORS.hero, 20, "center");
}

export function drawWin(r: Renderer, player: Player): void {
  overlay(r);
  r.text("VICTOIRE !", cx, 195, COLORS.doorExit, 52, "center");
  r.text("Le Livre, le Diamant et l'Aigle d'Or ont quitté Ronceval avec vous.", cx, 245, COLORS.text, 16, "center");
  r.text("Le donjon peut se rendormir.", cx, 270, COLORS.eagle, 16, "center");
  r.text(`Score final : ${player.score}`, cx, 305, COLORS.eagle, 20, "center");
  r.text("Appuyez sur ENTREE pour rejouer", cx, 380, COLORS.hero, 18, "center");
}

/** Écran de choix entre la boutique et le château (fond déjà nettoyé par Game).
 *  `castle` : nom du château chargé ("" = celui qui est livré) ; `error` : échec de lecture. */
export function drawSelect(r: Renderer, gold: number, castle: string, error: string): void {
  r.text("L'AIGLE D'OR", cx, 110, COLORS.eagle, 44, "center");
  r.text("Où voulez-vous aller ?", cx, 165, COLORS.text, 18, "center");
  r.text("1   -   ENTRER DANS LE CHATEAU", cx, 235, COLORS.text, 22, "center");
  r.text("2   -   ALLER CHEZ LE MARCHAND", cx, 285, COLORS.text, 22, "center");
  r.text("3   -   CHARGER UN CHATEAU", cx, 335, COLORS.text, 22, "center");
  r.text(`Bourse : ${gold} pièces d'or`, cx, 400, COLORS.treasure, 16, "center");
  r.text(`Château : ${castle || "Ronceval (livré)"}`, cx, 428, COLORS.textDim, 14, "center");
  if (error) r.text(error, cx, 456, COLORS.healthFront, 14, "center");
}

/** Boutique : achat d'objets contre de l'or. */
export function drawShop(r: Renderer, player: Player): void {
  r.text("LE MARCHAND", cx, 90, COLORS.eagle, 36, "center");
  r.text(`Bourse : ${player.gold} pièces d'or`, cx, 130, COLORS.treasure, 16, "center");
  SHOP.forEach((a, i) => {
    const y = 190 + i * 42;
    const can = player.gold >= a.price;
    const color = can ? COLORS.text : "#5a5070";
    r.text(`${i + 1}.   ${HELD_NAME[a.item]}`, cx - 180, y, color, 20, "left");
    r.text(`${a.price} or   (x${player.inventory[a.item]})`, cx + 50, y, can ? COLORS.treasure : "#5a5070", 18, "left");
  });
  r.text("1-4 : acheter      Q (ou Echap) : sortir", cx, 430, COLORS.textDim, 14, "center");
}

export function drawInventory(r: Renderer, player: Player): void {
  overlay(r);
  r.text("INVENTAIRE", cx, 80, COLORS.eagle, 32, "center");

  const y0 = 130;
  const step = 30;
  const colL = cx - 240;
  const colR = cx + 30;

  // Colonne gauche : objets tenables en main (1-7).
  r.text("En main (1-7)", colL, y0 - 26, COLORS.textDim, 13, "left");
  HELD_KEYS.forEach((it, i) => {
    const n = player.inventory[it];
    const y = y0 + i * step;
    const inHand = player.inHand === it;
    const color = n > 0 ? (inHand ? COLORS.hero : COLORS.text) : "#5a5070";
    r.text(`${i + 1}.  ${HELD_NAME[it]}   x${n}${inHand ? "  <" : ""}`, colL, y, color, 16, "left");
  });

  // Colonne droite : objets non équipables.
  const extras: InventoryItem[] = ["rope", "leadEagle", "ring", "map"];
  r.text("Non équipables", colR, y0 - 26, COLORS.textDim, 13, "left");
  extras.forEach((it, i) => {
    const n = player.inventory[it];
    r.text(`${HELD_NAME[it]}   x${n}`, colR, y0 + i * step, n > 0 ? COLORS.text : "#5a5070", 16, "left");
  });

  // Parchemins ramassés, listés à la suite (lus en jeu avec L).
  if (player.parchments.length > 0) {
    const yp = y0 + extras.length * step;
    r.text("Ecrits (L pour les lire)", colR, yp + 6, COLORS.textDim, 13, "left");
    player.parchments.forEach((t, i) => {
      r.text(`- ${t}`, colR, yp + 30 + i * 22, COLORS.text, 13, "left");
    });
  }

  r.text("1-7 : Equiper | 0 : Vider | O : Ouvrir | S/D : Saut | A : Accroupir | esp : Se lever  | C : Carte", cx, 410, COLORS.textDim, 12, "center");
  r.text("G : Grimper (corde) | P : Prendre | F : Frapper | B : Boire | L : Lire | I : Fermer inv | Q : Abandon", cx, 434, COLORS.textDim, 12, "center",);
}

export function drawGameOver(r: Renderer, score: number): void {
  overlay(r);
  r.text("VOUS ETES TOMBE", cx, 200, COLORS.guard, 48, "center");
  r.text(`Score final : ${score}`, cx, 290, COLORS.eagle, 18, "center");
  r.text("Appuyez sur ENTREE pour reessayer", cx, 360, COLORS.hero, 18, "center");
}
