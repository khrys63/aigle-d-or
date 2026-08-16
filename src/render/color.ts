import { isLegacy } from "./legacy";

/** Assombrit une couleur hex (#rrggbb) d'un facteur t ∈ [0,1] (brouillard de profondeur). */
export function shade(hex: string, t: number): string {
  // Mode MO5 : la machine n'avait pas de nuances. Un brouillard ferait varier le
  // magenta d'une rangée à l'autre et casserait l'uniformité du trait.
  if (isLegacy()) return hex;
  const f = Math.max(0, Math.min(1, 1 - t));
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * f);
  const g = Math.round(((n >> 8) & 0xff) * f);
  const b = Math.round((n & 0xff) * f);
  return `rgb(${r},${g},${b})`;
}
