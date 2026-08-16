import type { Dir } from "../types";
import { ATTACK_COLS, GUARD_DAMAGE, GUARD_HIT_COOLDOWN, TOUCH_DX, TOUCH_DZ } from "../config";
import type { Player } from "../entities/Player";
import type { Room } from "../world/Room";

/** La cible (dc, dr) - écart en COLONNES et RANGÉES - est-elle devant le héros ?
 *  Le combat est LATÉRAL uniquement : même rangée, de profil (le déclenchement
 *  face/dos est déjà bloqué à la saisie, avec message). */
function hitInFront(facing: Dir, dc: number, dr: number): boolean {
  if (Math.abs(dr) >= 0.6) return false;
  if (facing === "right") return dc > 0 && dc < ATTACK_COLS;
  if (facing === "left") return dc < 0 && -dc < ATTACK_COLS;
  return false;
}

/**
 * Combat :
 * - un coup d'épée (attackTimer actif) neutralise un garde droit devant ;
 * - sinon, un garde au contact blesse le héros (avec recharge + invincibilité).
 */
export function resolveCombat(player: Player, room: Room): void {
  for (const guard of room.guards) {
    if (!guard.alive) continue;
    const dx = guard.x - player.x;
    const dz = guard.z - player.z;
    // Écarts en cases (x couvre 2/cols par colonne, z 1/rows par rangée).
    const dc = dx * (room.cols / 2);
    const dr = dz * room.rows;

    if (player.isAttacking && hitInFront(player.facing, dc, dr)) {
      guard.alive = false;
      continue;
    }

    if (Math.abs(dx) < TOUCH_DX && Math.abs(dz) < TOUCH_DZ) {
      if (guard.hitCooldown <= 0 && player.invuln <= 0) {
        player.health = Math.max(0, player.health - GUARD_DAMAGE);
        player.bleeding = true; // déclenche l'hémorragie (stoppée par une fiole)
        guard.hitCooldown = GUARD_HIT_COOLDOWN;
        player.invuln = GUARD_HIT_COOLDOWN;
      }
    }
  }
}
