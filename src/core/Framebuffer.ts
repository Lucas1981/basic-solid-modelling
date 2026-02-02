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
   * @param color - CSS color string (e.g. "#000000") or "r,g,b" for 0-255 values.
   */
  clear(color: string = "#000000"): void {
    const [r, g, b] = parseColor(color);
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
    const i = (iy * this.width + ix) * 4;
    this.colorBuffer.data[i] = r;
    this.colorBuffer.data[i + 1] = g;
    this.colorBuffer.data[i + 2] = b;
    this.colorBuffer.data[i + 3] = 255;
  }
}

/** Parse "#rrggbb" or "#rgb" to [r, g, b] 0–255. */
function parseColor(color: string): [number, number, number] {
  const hex = color.startsWith("#") ? color.slice(1) : color;
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  return [0, 0, 0];
}
