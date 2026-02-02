import { parseColorHex } from "../math/utils";

/**
 * Color buffer for per-pixel drawing. No depth buffer.
 * Used by the rasterizer; display via Canvas.blit().
 */
export class Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly colorBuffer: ImageData;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.colorBuffer = new ImageData(width, height);
  }

  /**
   * Clear the entire buffer to a solid color.
   * @param color - CSS color string (e.g. "#000000").
   */
  clear(color: string = "#000000"): void {
    const [r, g, b] = parseColorHex(color);
    const data = this.colorBuffer.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  /**
   * Write a single pixel. r, g, b are 0–255. No-op if (x, y) is out of bounds.
   */
  putPixel(x: number, y: number, r: number, g: number, b: number): void {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return;
    this.putPixelUnsafe(ix, iy, r, g, b);
  }

  /**
   * Write a single pixel at integer coordinates. Caller must ensure (ix, iy) is in bounds.
   * Used by the rasterizer inner loop to avoid redundant bounds checks.
   */
  putPixelUnsafe(ix: number, iy: number, r: number, g: number, b: number): void {
    const i = (iy * this.width + ix) * 4;
    const data = this.colorBuffer.data;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
}
