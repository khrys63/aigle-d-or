import { COLORS, HUD_H, MAX_HEALTH, PLAY_H, VIEW_W } from "../config";
import type { Renderer } from "../engine/Renderer";
import type { Player } from "../entities/Player";
import { HELD_NAME } from "../items";

/** Bandeau du bas : barre de vie, objet en main, objectifs, touches
 *  (+ nom de salle si `roomName` est non vide : debug seulement). */
export function drawHud(r: Renderer, player: Player, roomName: string, message: string): void {
  // Message contextuel, juste au-dessus du bandeau (comme un sous-titre).
  if (message) r.text(message, VIEW_W / 2, PLAY_H - 12, COLORS.banner, 14, "center");

  const top = PLAY_H;
  r.rect({ x: 0, y: top, w: VIEW_W, h: HUD_H }, COLORS.hudBg);

  // Barre de vie.
  const barX = 14;
  const barY = top + 16;
  const barW = 170;
  const barH = 16;
  r.rect({ x: barX, y: barY, w: barW, h: barH }, COLORS.healthBack);
  const ratio = Math.max(0, player.health) / MAX_HEALTH;
  r.rect({ x: barX, y: barY, w: barW * ratio, h: barH }, COLORS.healthFront);
  r.strokeRect({ x: barX, y: barY, w: barW, h: barH }, COLORS.text, 1);
  // Pourcentage de forces, en blanc au centre de la barre.
  r.text(`${Math.round(ratio * 100)} %`, barX + barW / 2, barY + barH - 4, "#ffffff", 11, "center");
  r.text("FORCES", barX, barY - 3, COLORS.text, 11);

  // Objet en main.
  r.text("EN MAIN", 210, top + 17, COLORS.textDim, 11);
  r.text(
    player.inHand ? HELD_NAME[player.inHand] : "(rien)",
    210,
    top + 40,
    player.inHand ? COLORS.hero : COLORS.textDim,
    16,
  );

  // Hémorragie : alerte sous la barre de vie.
  if (player.bleeding) r.text("HEMORRAGIE !", barX, top + 52, COLORS.healthFront, 11);

  // Score + or + trésors.
  r.text(`Score: ${player.score}`, 360, top + 20, COLORS.eagle, 14);
  r.text(`Or: ${player.gold}`, 360, top + 40, COLORS.treasure, 12);

  // Salle courante (debug uniquement, cf. DEBUG_ROOM_NAME) + rappel "I : inventaire"
  // (les touches détaillées sont dans l'inventaire).
  if (roomName) r.text(roomName, VIEW_W - 14, top + 22, COLORS.text, 14, "right");
  r.text("I : inventaire & touches", VIEW_W - 14, top + 42, COLORS.textDim, 11, "right");
}
