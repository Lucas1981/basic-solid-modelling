import { Vec2 } from "../math/vec2";
import { Framebuffer } from "./Framebuffer";
import type { GouraudVertex } from "./renderHelpers";

/**
 * Rasterize a triangle into the color buffer with a flat color.
 * Uses barycentric coordinates: p = A + u*(B-A) + v*(C-A); inside if u >= 0, v >= 0, u+v <= 1.
 * No depth test; draw order is assumed to be Painter's (back-to-front) by the caller.
 */
export function rasterizeTriangle(
  framebuffer: Framebuffer,
  a: Vec2,
  b: Vec2,
  c: Vec2,
  color: string,
): void {
  const [r, g, blue] = parseColor(color);

  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(
    framebuffer.width - 1,
    Math.ceil(Math.max(a.x, b.x, c.x)),
  );
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(
    framebuffer.height - 1,
    Math.ceil(Math.max(a.y, b.y, c.y)),
  );

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const denom = abx * acy - aby * acx;
  if (Math.abs(denom) < 1e-10) return;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const px_ = px + 0.5;
      const py_ = py + 0.5;
      const pax = px_ - a.x;
      const pay = py_ - a.y;
      const u = (pax * acy - pay * acx) / denom;
      const v = (abx * pay - aby * pax) / denom;
      if (u >= 0 && v >= 0 && u + v <= 1) {
        framebuffer.putPixel(px_, py_, r, g, blue);
      }
    }
  }
}

/**
 * Rasterize a triangle with Gouraud shading: interpolate per-vertex color (r,g,b) across the triangle.
 * Uses barycentric coords; when all vertices have invW, uses perspective-correct interpolation
 * (interpolate r/w, g/w, b/w and 1/w, then divide at pixel).
 */
export function rasterizeTriangleGouraud(
  framebuffer: Framebuffer,
  a: GouraudVertex,
  b: GouraudVertex,
  c: GouraudVertex,
): void {
  const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
  const maxX = Math.min(
    framebuffer.width - 1,
    Math.ceil(Math.max(a.x, b.x, c.x)),
  );
  const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
  const maxY = Math.min(
    framebuffer.height - 1,
    Math.ceil(Math.max(a.y, b.y, c.y)),
  );

  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const acx = c.x - a.x;
  const acy = c.y - a.y;
  const denom = abx * acy - aby * acx;
  if (Math.abs(denom) < 1e-10) return;

  const usePerspective =
    a.invW !== undefined && b.invW !== undefined && c.invW !== undefined;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const px_ = px + 0.5;
      const py_ = py + 0.5;
      const pax = px_ - a.x;
      const pay = py_ - a.y;
      const u = (pax * acy - pay * acx) / denom;
      const v = (abx * pay - aby * pax) / denom;
      if (u >= 0 && v >= 0 && u + v <= 1) {
        const w = 1 - u - v;
        let r: number, g: number, blue: number;
        if (usePerspective && a.invW! > 0 && b.invW! > 0 && c.invW! > 0) {
          const invW = w * a.invW! + u * b.invW! + v * c.invW!;
          if (invW <= 0) continue;
          r =
            (w * a.r * a.invW! + u * b.r * b.invW! + v * c.r * c.invW!) / invW;
          g =
            (w * a.g * a.invW! + u * b.g * b.invW! + v * c.g * c.invW!) / invW;
          blue =
            (w * a.b * a.invW! + u * b.b * b.invW! + v * c.b * c.invW!) /
            invW;
        } else {
          r = w * a.r + u * b.r + v * c.r;
          g = w * a.g + u * b.g + v * c.g;
          blue = w * a.b + u * b.b + v * c.b;
        }
        framebuffer.putPixel(
          px_,
          py_,
          Math.round(Math.max(0, Math.min(255, r))),
          Math.round(Math.max(0, Math.min(255, g))),
          Math.round(Math.max(0, Math.min(255, blue))),
        );
      }
    }
  }
}

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
