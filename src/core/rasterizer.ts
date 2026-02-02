import { Vec2 } from "../math/vec2";
import { parseColorHex } from "../math/utils";
import { Framebuffer } from "./Framebuffer";
import type { GouraudVertex } from "./renderHelpers";

/** Sample texture at (u, v); wrap to [0,1]. Nearest-neighbor. Returns r,g,b 0–255. */
export function sampleTexture(
  texture: ImageData,
  u: number,
  v: number,
): [number, number, number] {
  const w = texture.width;
  const h = texture.height;
  const uu = ((u % 1) + 1) % 1;
  const vv = ((v % 1) + 1) % 1;
  const x = Math.min(w - 1, Math.max(0, Math.floor(uu * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor(vv * h)));
  const i = (y * w + x) * 4;
  const data = texture.data;
  return [data[i], data[i + 1], data[i + 2]];
}

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
  const [r, g, blue] = parseColorHex(color);

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
        framebuffer.putPixelUnsafe(px, py, r, g, blue);
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
        framebuffer.putPixelUnsafe(
          px,
          py,
          Math.round(Math.max(0, Math.min(255, r))),
          Math.round(Math.max(0, Math.min(255, g))),
          Math.round(Math.max(0, Math.min(255, blue))),
        );
      }
    }
  }
}

/**
 * Rasterize a triangle with Gouraud shading and texture: interpolate (r,g,b) and (u,v) with perspective correction,
 * sample texture at (u,v), final color = texture × lighting (modulate).
 */
export function rasterizeTriangleGouraudTextured(
  framebuffer: Framebuffer,
  a: GouraudVertex,
  b: GouraudVertex,
  c: GouraudVertex,
  texture: ImageData,
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
  const hasUV =
    a.u !== undefined && a.v !== undefined &&
    b.u !== undefined && b.v !== undefined &&
    c.u !== undefined && c.v !== undefined;

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
        let uTex: number, vTex: number;
        if (usePerspective && a.invW! > 0 && b.invW! > 0 && c.invW! > 0) {
          const invW = w * a.invW! + u * b.invW! + v * c.invW!;
          if (invW <= 0) continue;
          r = (w * a.r * a.invW! + u * b.r * b.invW! + v * c.r * c.invW!) / invW;
          g = (w * a.g * a.invW! + u * b.g * b.invW! + v * c.g * c.invW!) / invW;
          blue = (w * a.b * a.invW! + u * b.b * b.invW! + v * c.b * c.invW!) / invW;
          if (hasUV) {
            uTex = (w * a.u! * a.invW! + u * b.u! * b.invW! + v * c.u! * c.invW!) / invW;
            vTex = (w * a.v! * a.invW! + u * b.v! * b.invW! + v * c.v! * c.invW!) / invW;
          } else {
            uTex = 0;
            vTex = 0;
          }
        } else {
          r = w * a.r + u * b.r + v * c.r;
          g = w * a.g + u * b.g + v * c.g;
          blue = w * a.b + u * b.b + v * c.b;
          uTex = hasUV ? w * a.u! + u * b.u! + v * c.u! : 0;
          vTex = hasUV ? w * a.v! + u * b.v! + v * c.v! : 0;
        }
        const [tR, tG, tB] = sampleTexture(texture, uTex, vTex);
        const fr = Math.round(Math.max(0, Math.min(255, (tR * r) / 255)));
        const fg = Math.round(Math.max(0, Math.min(255, (tG * g) / 255)));
        const fb = Math.round(Math.max(0, Math.min(255, (tB * blue) / 255)));
        framebuffer.putPixelUnsafe(px, py, fr, fg, fb);
      }
    }
  }
}
