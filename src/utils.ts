/**
 * Render utilities: rasterize batches to framebuffer, draw debug overlay.
 */
import { projectPoint, Viewport } from "./math/projection";
import { Vec4 } from "./math/vec4";
import { Mat4 } from "./math/mat4";
import { Vec3 } from "./math/vec3";
import { Canvas } from "./core/Canvas";
import { Framebuffer } from "./core/Framebuffer";
import {
  rasterizeTriangleGouraud,
  rasterizeTriangleGouraudTextured,
} from "./core/rasterizer";
import { Scene } from "./core/Scene";
import type { FilledPolygonBatch } from "./core/renderHelpers";

/** Options for which debug overlay elements to draw. */
export interface DebugOverlayOptions {
  showFps: boolean;
  showLightSources: boolean;
  showLightDirections: boolean;
  showVertexNormals: boolean;
}

/**
 * Draw optional debug overlay: face normal lines, vertex normal lines, FPS, and point/spot light positions.
 * Call after blitting the framebuffer to the canvas.
 */
export function drawDebugOverlay(
  canvas: Canvas,
  scene: Scene,
  view: Mat4,
  projection: Mat4,
  viewport: Viewport,
  debugNormalSegments: Array<[number, number, number, number]>,
  debugVertexNormalSegments: Array<[number, number, number, number]>,
  deltaTime: number,
  debug: DebugOverlayOptions
): void {
  if (debugNormalSegments.length > 0) {
    canvas.drawLines(debugNormalSegments, "#ff69b4", 1);
  }
  if (debug.showVertexNormals && debugVertexNormalSegments.length > 0) {
    canvas.drawLines(debugVertexNormalSegments, "#00ffff", 1);
  }
  if (debug.showFps) {
    const fps = deltaTime > 0 ? Math.round(1 / deltaTime) : 0;
    canvas.drawText(`${fps} FPS`, 10, canvas.getHeight() - 10, {
      color: "#00ff00",
      font: "14px monospace",
    });
  }
  if (debug.showLightSources) {
    for (const light of scene.lights) {
      if (light.type !== "point" && light.type !== "spot") continue;
      const pos = light.position;
      const camV4 = view.transformVec4(new Vec4(pos.x, pos.y, pos.z, 1));
      const cam = new Vec3(camV4.x, camV4.y, camV4.z);
      const proj = projectPoint(cam, projection, viewport);
      if (!proj || proj.behind) continue;
      const radius = Math.min(16, Math.max(2, 80 / Math.max(0.1, -cam.z)));
      canvas.drawFilledCircle(
        proj.x,
        proj.y,
        radius,
        "#ffa500",
        "#ff0000",
        2
      );
    }
  }
  if (debug.showLightDirections) {
    const LENGTH = 3;
    const segments: Array<[number, number, number, number]> = [];
    for (const light of scene.lights) {
      if (light.type === "directional") {
        const start = new Vec3(0, 0, 0);
        const end = start.add(light.direction.scale(LENGTH));
        const camStart = view.transformVec4(new Vec4(start.x, start.y, start.z, 1));
        const camEnd = view.transformVec4(new Vec4(end.x, end.y, end.z, 1));
        const pStart = projectPoint(new Vec3(camStart.x, camStart.y, camStart.z), projection, viewport);
        const pEnd = projectPoint(new Vec3(camEnd.x, camEnd.y, camEnd.z), projection, viewport);
        if (pStart && !pStart.behind && pEnd && !pEnd.behind) {
          segments.push([pStart.x, pStart.y, pEnd.x, pEnd.y]);
        }
      } else if (light.type === "spot") {
        const start = light.position;
        const end = start.add(light.direction.scale(LENGTH));
        const camStart = view.transformVec4(new Vec4(start.x, start.y, start.z, 1));
        const camEnd = view.transformVec4(new Vec4(end.x, end.y, end.z, 1));
        const pStart = projectPoint(new Vec3(camStart.x, camStart.y, camStart.z), projection, viewport);
        const pEnd = projectPoint(new Vec3(camEnd.x, camEnd.y, camEnd.z), projection, viewport);
        if (pStart && !pStart.behind && pEnd && !pEnd.behind) {
          segments.push([pStart.x, pStart.y, pEnd.x, pEnd.y]);
        }
      }
    }
    if (segments.length > 0) {
      canvas.drawLines(segments, "#800080", 1);
    }
  }
}

/** Rasterize all filled polygon batches to the framebuffer (Gouraud or Gouraud + texture). */
export function rasterizeBatches(
  framebuffer: Framebuffer,
  batches: FilledPolygonBatch[]
): void {
  for (const batch of batches) {
    if (batch.vertices.length >= 3) {
      if (batch.texture) {
        rasterizeTriangleGouraudTextured(
          framebuffer,
          batch.vertices[0],
          batch.vertices[1],
          batch.vertices[2],
          batch.texture
        );
      } else {
        rasterizeTriangleGouraud(
          framebuffer,
          batch.vertices[0],
          batch.vertices[1],
          batch.vertices[2]
        );
      }
    }
  }
}
