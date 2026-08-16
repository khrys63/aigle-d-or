/**
 * Conversion entre cases de la grille et coordonnées normalisées du plan-sol.
 * La grille de chaque salle pave entièrement la boîte de perspective :
 * x ∈ [-1, 1] (gauche→droite), z ∈ [0, 1] (proche→loin).
 */

/** Centre en x d'une colonne (0..cols-1). */
export function colToX(col: number, cols: number): number {
  return -1 + (2 * (col + 0.5)) / cols;
}

/** Centre en z d'une rangée (0..rows-1) ; row 0 = au plus près de la caméra. */
export function rowToZ(row: number, rows: number): number {
  return (row + 0.5) / rows;
}

/** Bord vertical (x) entre les colonnes i-1 et i. */
export function xEdge(i: number, cols: number): number {
  return -1 + (2 * i) / cols;
}

/** Bord (z) entre les rangées i-1 et i. */
export function zEdge(i: number, rows: number): number {
  return i / rows;
}

export function clampCol(col: number, cols: number): number {
  return Math.max(0, Math.min(cols - 1, col));
}

export function clampRow(row: number, rows: number): number {
  return Math.max(0, Math.min(rows - 1, row));
}
