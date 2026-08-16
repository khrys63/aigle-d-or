import type { Rect } from "../types";
import { installLegacyContext, withoutOutline } from "../render/legacy";

/** Helpers de dessin Canvas 2D (formes simples, texte, barres). */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;

  constructor(
    public readonly canvas: HTMLCanvasElement,
    public readonly width: number,
    public readonly height: number,
  ) {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D non supporté");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    installLegacyContext(this.ctx);
  }

  clear(color: string): void {
    // Un fond plein n'est pas une forme : en mode MO5 il ne doit pas être cerné.
    withoutOutline(() => {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.width, this.height);
    });
  }

  rect(r: Rect, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(r.x), Math.round(r.y), r.w, r.h);
  }

  /** Remplit (et borde optionnellement) un polygone défini par ses sommets. */
  poly(
    points: { x: number; y: number }[],
    fill: string,
    stroke?: string,
    lineWidth = 1,
  ): void {
    if (points.length < 3) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /** Trace une ligne. */
  line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /** Disque plein. */
  circle(x: number, y: number, radius: number, color: string): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  strokeRect(r: Rect, color: string, lineWidth = 2): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(Math.round(r.x), Math.round(r.y), r.w, r.h);
  }

  text(
    str: string,
    x: number,
    y: number,
    color: string,
    size = 16,
    align: CanvasTextAlign = "left",
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = "alphabetic";
    this.ctx.fillText(str, x, y);
  }
}
