import { Vec2 } from "../math/vec2";
import { Vec3 } from "../math/vec3";
import { Vec4 } from "../math/vec4";
import { Mat4 } from "../math/mat4";
import { projectPoint, Viewport, type ProjectedPoint } from "../math/projection";
import { isSphereInFrustum } from "../math/frustum";
import { Scene } from "./Scene";
import type { MeshMaterial, Polygon } from "../io/meshLoader";
import {
  computeLightingDiffuseAndSpecular,
  hexToColorRGB,
  transformLightsToCameraSpace,
  type Light,
  type Material,
} from "./Lighting";

/** Geometry that has vertices, polygons, optional normals, optional UVs, and optional material. */
export interface MeshLike {
  vertices: Vec3[];
  polygons: Polygon[];
  vertexNormals?: Vec3[];
  uvs?: Array<{ u: number; v: number }>;
  material?: MeshMaterial;
}

/** A batch of line segments drawn in a single color (e.g. one polygon's wireframe). */
export interface ColoredSegmentBatch {
  color: string;
  segments: Array<[number, number, number, number]>;
}

/** A drawable polygon batch with depth for Painter's algorithm (sort back-to-front). */
export interface DrawablePolygonBatch extends ColoredSegmentBatch {
  /** Camera-space z (negative in front of camera); used for depth sort (farthest first). */
  depth: number;
}

/** Screen-space vertex with per-vertex color for Gouraud shading; optional u,v for texture. */
export interface GouraudVertex {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  /** 1/w from clip space; when present, rasterizer uses perspective-correct interpolation. */
  invW?: number;
  /** UV for texture sampling (when batch has texture). */
  u?: number;
  v?: number;
  /** Specular (0–255) added on top of texture×diffuse when present; used for textured polys only. */
  sr?: number;
  sg?: number;
  sb?: number;
}

/** A filled polygon batch: Gouraud vertices; optional texture for texture × lighting. */
export interface FilledPolygonBatch {
  vertices: GouraudVertex[];
  depth: number;
  texture?: ImageData;
  /** Stable sort tie-breaker when depths are equal (avoids blipping). */
  batchIndex: number;
}

/** Result of projectSceneToPolygonWireframe: batches to draw, and optional debug normal segments. */
export interface ProjectSceneResult {
  batches: ColoredSegmentBatch[];
  debugNormalSegments: Array<[number, number, number, number]>;
}

/** Result of projectSceneToFilledPolygons: filled polygon batches and optional debug normal segments. */
export interface ProjectSceneFilledResult {
  batches: FilledPolygonBatch[];
  debugNormalSegments: Array<[number, number, number, number]>;
}

/** Length of debug normal line in camera-space units. */
const DEBUG_NORMAL_LENGTH = 0.4;

/**
 * Project all mesh vertices to screen space using the MVP matrix.
 * Returns an array where each element is either a Vec3 (screen coordinates)
 * or null if the vertex is behind the camera or invalid.
 */
export function projectMeshVertices(
  mesh: MeshLike,
  mvp: Mat4,
  viewport: Viewport,
): (Vec3 | null)[] {
  const projected: (Vec3 | null)[] = [];

  for (const vertex of mesh.vertices) {
    const p = projectPoint(vertex, mvp, viewport);
    if (p && !p.behind) {
      projected.push(new Vec3(p.x, p.y, 0));
    } else {
      projected.push(null);
    }
  }

  return projected;
}

/**
 * Project all mesh vertices to screen space, returning full ProjectedPoint (x, y, w) for Gouraud/perspective.
 */
function projectMeshVerticesFull(
  mesh: MeshLike,
  mvp: Mat4,
  viewport: Viewport,
): (ProjectedPoint | null)[] {
  const projected: (ProjectedPoint | null)[] = [];
  for (const vertex of mesh.vertices) {
    const p = projectPoint(vertex, mvp, viewport);
    if (p && !p.behind) {
      projected.push(p);
    } else {
      projected.push(null);
    }
  }
  return projected;
}

/** Parse "#rrggbb" or "#rgb" to [r, g, b] 0–255. */
function parseColorToRgb(color: string): [number, number, number] {
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

/**
 * Build Gouraud vertices for a single polygon: per-vertex color from computeLightingDiffuseAndSpecular.
 * For textured polygons, store diffuse in r,g,b and specular in sr,sg,sb so the rasterizer can add specular on top of texture×diffuse.
 * For untextured polygons, store diffuse+specular in r,g,b.
 */
function collectPolygonGouraudVertices(
  projectedPoints: (ProjectedPoint | null)[],
  polygon: Polygon,
  cameraSpaceVertices: Vec3[],
  cameraSpaceNormals: Vec3[],
  faceNormal: Vec3 | null,
  material: Material,
  lights: Light[],
  ambientColor: { r: number; g: number; b: number },
  uvs: Array<{ u: number; v: number }>,
  uvIndices: number[] | undefined,
): GouraudVertex[] | null {
  const indices = polygon.vertexIndices;
  if (indices.length < 2) return null;
  const vertices: GouraudVertex[] = [];
  const useFaceNormal = cameraSpaceNormals.length === 0 && faceNormal !== null;
  const hasUVs = uvs.length > 0 && uvIndices && uvIndices.length === indices.length;
  const useSeparateSpecular = Boolean(polygon.textureUrl && hasUVs);

  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    const p = projectedPoints[i];
    if (!p) return null;
    const pos = cameraSpaceVertices[i];
    const normal = useFaceNormal
      ? faceNormal
      : cameraSpaceNormals[i] ?? faceNormal ?? new Vec3(0, 1, 0);
    const viewDir = pos.negate();
    const { diffuse, specular } = computeLightingDiffuseAndSpecular(
      pos,
      normal,
      viewDir,
      material,
      lights,
      ambientColor,
    );
    let r: number, g: number, b: number;
    let sr: number | undefined, sg: number | undefined, sb: number | undefined;
    if (useSeparateSpecular) {
      r = diffuse.r * 255;
      g = diffuse.g * 255;
      b = diffuse.b * 255;
      sr = specular.r * 255;
      sg = specular.g * 255;
      sb = specular.b * 255;
    } else {
      r = (diffuse.r + specular.r) * 255;
      g = (diffuse.g + specular.g) * 255;
      b = (diffuse.b + specular.b) * 255;
    }
    const vert: GouraudVertex = {
      x: p.x,
      y: p.y,
      r: Math.round(Math.max(0, Math.min(255, r))),
      g: Math.round(Math.max(0, Math.min(255, g))),
      b: Math.round(Math.max(0, Math.min(255, b))),
      invW: 1 / p.w,
    };
    if (sr !== undefined && sg !== undefined && sb !== undefined) {
      vert.sr = Math.round(Math.max(0, Math.min(255, sr)));
      vert.sg = Math.round(Math.max(0, Math.min(255, sg)));
      vert.sb = Math.round(Math.max(0, Math.min(255, sb)));
    }
    if (hasUVs && uvIndices[k] < uvs.length) {
      vert.u = uvs[uvIndices[k]].u;
      vert.v = uvs[uvIndices[k]].v;
    }
    vertices.push(vert);
  }
  return vertices;
}

/**
 * Transform mesh vertices to camera space (view * model).
 * Returns array of Vec3 (x, y, z) in camera space; z is negative in front of camera.
 */
function transformVerticesToCameraSpace(
  mesh: MeshLike,
  viewModel: Mat4,
): Vec3[] {
  const out: Vec3[] = [];
  for (const v of mesh.vertices) {
    const c = viewModel.transformVec4(new Vec4(v.x, v.y, v.z, 1));
    out.push(new Vec3(c.x, c.y, c.z));
  }
  return out;
}

/**
 * Transform mesh normals to camera space using inverse transpose of view*model.
 * If mesh has no vertexNormals, returns empty array (caller should use face normals or skip lighting).
 */
function transformNormalsToCameraSpace(
  mesh: MeshLike,
  viewModel: Mat4,
): Vec3[] {
  if (!mesh.vertexNormals || mesh.vertexNormals.length === 0) return [];
  const normalMat = viewModel.normalMatrix();
  if (!normalMat) return mesh.vertexNormals.map((n) => n.clone());
  const out: Vec3[] = [];
  for (const n of mesh.vertexNormals) {
    const c = normalMat.transformVec4(new Vec4(n.x, n.y, n.z, 0));
    const v = new Vec3(c.x, c.y, c.z);
    const len = v.length();
    out.push(len > 1e-10 ? v.normalize() : new Vec3(0, 1, 0));
  }
  return out;
}

/**
 * Compute polygon depth for Painter's algorithm: camera-space z of the farthest vertex
 * (minimum z, since z is negative in front of camera). Using farthest vertex gives
 * stable sort order and matches the idea "draw the polygon that is furthest back first".
 * Smaller z = farther from camera (draw first).
 */
function polygonDepth(
  vertexIndices: number[],
  cameraSpaceVertices: Vec3[],
): number {
  if (vertexIndices.length === 0) return 0;
  let minZ = cameraSpaceVertices[vertexIndices[0]].z;
  for (let k = 1; k < vertexIndices.length; k++) {
    const z = cameraSpaceVertices[vertexIndices[k]].z;
    if (z < minZ) minZ = z;
  }
  return minZ;
}

/**
 * Compute polygon surface normal in camera space from first three vertices.
 * Uses cross(e1, e2) with e1 = v1-v0, e2 = v2-v0 so that when the mesh is wound
 * CCW when viewed from outside, n points outward. Back-face: cull when dot(v0, n) >= 0.
 * Both triangles of each quad must use the same winding (both CCW from outside).
 * Returns null if degenerate.
 */
function polygonNormal(
  vertexIndices: number[],
  cameraSpaceVertices: Vec3[],
): Vec3 | null {
  if (vertexIndices.length < 3) return null;
  const v0 = cameraSpaceVertices[vertexIndices[0]];
  const v1 = cameraSpaceVertices[vertexIndices[1]];
  const v2 = cameraSpaceVertices[vertexIndices[2]];
  const e1 = v1.sub(v0);
  const e2 = v2.sub(v0);
  const n = e1.cross(e2);
  const len = n.length();
  if (len === 0) return null;
  return n.normalize();
}

/**
 * Back-face test using dot(vertex, normal) like the reference implementation.
 * Cull when dot(v0, n) >= 0 (polygon is on the "positive" side of its plane from the camera).
 * This is axis-independent and avoids false positives from relying on normal.z alone.
 */
function isBackFacing(
  vertexIndices: number[],
  cameraSpaceVertices: Vec3[],
  normal: Vec3 | null,
): boolean {
  if (normal === null || vertexIndices.length < 3) return false;
  const v0 = cameraSpaceVertices[vertexIndices[0]];
  const dp = v0.x * normal.x + v0.y * normal.y + v0.z * normal.z;
  return dp >= 0;
}

/**
 * Compute polygon center in camera space (average of vertex positions).
 */
function polygonCenter(
  vertexIndices: number[],
  cameraSpaceVertices: Vec3[],
): Vec3 {
  if (vertexIndices.length === 0) return new Vec3(0, 0, 0);
  let x = 0,
    y = 0,
    z = 0;
  for (const i of vertexIndices) {
    const v = cameraSpaceVertices[i];
    x += v.x;
    y += v.y;
    z += v.z;
  }
  const n = vertexIndices.length;
  return new Vec3(x / n, y / n, z / n);
}

/**
 * Build wireframe segments for a single polygon from projected vertices.
 * Draws lines between consecutive vertex indices, then last back to first.
 * Returns the segments, or null if any polygon vertex is invalid or behind.
 */
export function collectPolygonSegments(
  projectedVertices: (Vec3 | null)[],
  polygon: Polygon,
): Array<[number, number, number, number]> | null {
  const indices = polygon.vertexIndices;
  if (indices.length < 2) return [];

  const segments: Array<[number, number, number, number]> = [];

  for (let i = 0; i < indices.length; i++) {
    const idxA = indices[i];
    const idxB = indices[(i + 1) % indices.length];
    const vA = projectedVertices[idxA];
    const vB = projectedVertices[idxB];

    if (!vA || !vB) return null;
    segments.push([vA.x, vA.y, vB.x, vB.y]);
  }

  return segments;
}

/**
 * Build screen-space 2D vertices for a single polygon from projected vertices.
 * Returns vertices in polygon order, or null if any polygon vertex is invalid or behind.
 */
export function collectPolygonScreenVertices(
  projectedVertices: (Vec3 | null)[],
  polygon: Polygon,
): Vec2[] | null {
  const indices = polygon.vertexIndices;
  if (indices.length < 2) return null;

  const vertices: Vec2[] = [];
  for (const i of indices) {
    const v = projectedVertices[i];
    if (!v) return null;
    vertices.push(new Vec2(v.x, v.y));
  }
  return vertices;
}

export interface ProjectSceneOptions {
  debugShowDirection?: boolean;
  applyPaintersAlgorithm?: boolean;
  applyBackFaceCulling?: boolean;
  /** Map textureUrl (as in JSON) -> ImageData; when set, textured polygons get texture. */
  textureMap?: Map<string, ImageData>;
}

/**
 * Project the whole scene to screen-space wireframe per polygon, with depth for Painter's algorithm.
 * Each object (after frustum culling) is rendered by polygon: for each polygon,
 * project its vertex indices; draw lines 1-2, 2-3, ..., n-1 (last back to first).
 * Batches are sorted by depth (farthest first) so drawing order gives correct occlusion.
 * Returns sorted batches and optional debug normal segments for drawing back-to-front.
 */
export function projectSceneToPolygonWireframe(
  scene: Scene,
  viewProj: Mat4,
  viewport: Viewport,
  options?: ProjectSceneOptions,
): ProjectSceneResult {
  const batches: DrawablePolygonBatch[] = [];
  const debugNormalSegments: Array<[number, number, number, number]> = [];
  const camera = scene.camera;
  const view = camera.getViewMatrix();
  const aspect = viewport.width / viewport.height;
  const projection = camera.getProjectionMatrix(aspect);

  for (const object of scene.objects) {
    const mesh = object.mesh;
    const worldCenter = object.position;
    const worldRadius =
      mesh.boundingRadius *
      Math.max(object.scale.x, object.scale.y, object.scale.z);

    if (
      !isSphereInFrustum(
        worldCenter,
        worldRadius,
        view,
        camera.fovYRad,
        aspect,
        camera.near,
        camera.far,
      )
    ) {
      continue;
    }

    const model = object.getModelMatrix();
    const viewModel = view.multiply(model);
    const mvp = viewProj.multiply(model);
    const cameraSpaceVertices = transformVerticesToCameraSpace(mesh, viewModel);
    const projectedVertices = projectMeshVertices(mesh, mvp, viewport);

    for (const polygon of mesh.polygons) {
      const normal = polygonNormal(polygon.vertexIndices, cameraSpaceVertices);
      if (options?.applyBackFaceCulling && isBackFacing(polygon.vertexIndices, cameraSpaceVertices, normal)) {
        continue;
      }

      const segments = collectPolygonSegments(projectedVertices, polygon);
      if (segments !== null && segments.length > 0) {
        const depth = polygonDepth(polygon.vertexIndices, cameraSpaceVertices);
        batches.push({ color: polygon.color, segments, depth });
      }

      if (options?.debugShowDirection && normal) {
        const center = polygonCenter(
          polygon.vertexIndices,
          cameraSpaceVertices,
        );
        const end = center.add(normal.scale(DEBUG_NORMAL_LENGTH));
        const pStart = projectPoint(center, projection, viewport);
        const pEnd = projectPoint(end, projection, viewport);
        if (pStart && !pStart.behind && pEnd && !pEnd.behind) {
          debugNormalSegments.push([pStart.x, pStart.y, pEnd.x, pEnd.y]);
        }
      }
    }
  }

  if (options?.applyPaintersAlgorithm) {
    batches.sort((a, b) => a.depth - b.depth);
  }

  return { batches, debugNormalSegments };
}

/**
 * Project the whole scene to filled polygon batches (screen-space vertices per polygon).
 * Reuses the same pipeline as wireframe: frustum culling, back-face culling, depth for Painter's sort.
 * Returns batches with Gouraud vertices (x, y, r, g, b, invW) and depth for Painter's sort.
 */
export function projectSceneToFilledPolygons(
  scene: Scene,
  viewProj: Mat4,
  viewport: Viewport,
  options?: ProjectSceneOptions,
): ProjectSceneFilledResult {
  const batches: FilledPolygonBatch[] = [];
  const debugNormalSegments: Array<[number, number, number, number]> = [];
  const camera = scene.camera;
  const view = camera.getViewMatrix();
  const aspect = viewport.width / viewport.height;
  const projection = camera.getProjectionMatrix(aspect);
  const lightsCamera = transformLightsToCameraSpace(scene.lights, view);
  const ambientColor = scene.ambientColor;

  for (const object of scene.objects) {
    const mesh = object.mesh;
    const worldCenter = object.position;
    const worldRadius =
      mesh.boundingRadius *
      Math.max(object.scale.x, object.scale.y, object.scale.z);

    if (
      !isSphereInFrustum(
        worldCenter,
        worldRadius,
        view,
        camera.fovYRad,
        aspect,
        camera.near,
        camera.far,
      )
    ) {
      continue;
    }

    const model = object.getModelMatrix();
    const viewModel = view.multiply(model);
    const mvp = viewProj.multiply(model);
    const cameraSpaceVertices = transformVerticesToCameraSpace(mesh, viewModel);
    const cameraSpaceNormals = transformNormalsToCameraSpace(mesh, viewModel);
    const projectedPoints = projectMeshVerticesFull(mesh, mvp, viewport);

    for (const polygon of mesh.polygons) {
      const faceNormal = polygonNormal(polygon.vertexIndices, cameraSpaceVertices);
      if (options?.applyBackFaceCulling && isBackFacing(polygon.vertexIndices, cameraSpaceVertices, faceNormal)) {
        continue;
      }

      const material: Material = {
        diffuse: hexToColorRGB(polygon.color),
        specular: mesh.material
          ? hexToColorRGB(mesh.material.specular)
          : { r: 0.5, g: 0.5, b: 0.5 },
        shininess: mesh.material?.shininess ?? 32,
      };
      const meshUvs = mesh.uvs ?? [];
      const vertices = collectPolygonGouraudVertices(
        projectedPoints,
        polygon,
        cameraSpaceVertices,
        cameraSpaceNormals,
        faceNormal,
        material,
        lightsCamera,
        ambientColor,
        meshUvs,
        polygon.uvIndices,
      );
      if (vertices !== null && vertices.length >= 2) {
        const depth = polygonDepth(polygon.vertexIndices, cameraSpaceVertices);
        const texture =
          polygon.textureUrl && options?.textureMap
            ? options.textureMap.get(polygon.textureUrl)
            : undefined;
        batches.push({ vertices, depth, texture, batchIndex: batches.length });
      }

      if (options?.debugShowDirection && faceNormal) {
        const center = polygonCenter(
          polygon.vertexIndices,
          cameraSpaceVertices,
        );
        const end = center.add(faceNormal.scale(DEBUG_NORMAL_LENGTH));
        const pStart = projectPoint(center, projection, viewport);
        const pEnd = projectPoint(end, projection, viewport);
        if (pStart && !pStart.behind && pEnd && !pEnd.behind) {
          debugNormalSegments.push([pStart.x, pStart.y, pEnd.x, pEnd.y]);
        }
      }
    }
  }

  if (options?.applyPaintersAlgorithm) {
    batches.sort((a, b) => {
      const d = a.depth - b.depth;
      if (Math.abs(d) < 1e-9) return a.batchIndex - b.batchIndex;
      return d;
    });
  }

  return { batches, debugNormalSegments };
}
