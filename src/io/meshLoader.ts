import { Vec3 } from "../math/vec3";

export interface Polygon {
  color: string;
  /** Indices into the mesh vertices array. Renderer draws lines 1-2, 2-3, ..., n-1 (last back to first). */
  vertexIndices: number[];
  /** Optional indices into mesh normals array; if absent, vertexIndices are used for normals when normals exist. */
  normalIndices?: number[];
}

export interface MeshData {
  vertices: Vec3[];
  polygons: Polygon[];
  /** Optional per-vertex normals (same count as vertices or separate index set). */
  normals?: Vec3[];
}

export interface MeshJSON {
  vertices: Array<{ x: number; y: number; z?: number }>;
  normals?: Array<{ x: number; y: number; z?: number }>;
  polygons?: Array<{
    color: string;
    vertexIndices: number[];
    normalIndices?: number[];
  }>;
}

/**
 * Load a mesh from a JSON file.
 * Format: vertices (3D positions), polygons (each has color and vertexIndices into vertices).
 * No separate edge list: lines are implied by each polygon (consecutive vertices, then last to first).
 */
export async function loadMesh(url: string): Promise<MeshData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load mesh from ${url}: ${response.statusText}`);
  }

  const json: MeshJSON = await response.json();

  const vertices = json.vertices.map((v) => new Vec3(v.x, v.y, v.z ?? 0));
  const normals = json.normals?.map((n) => new Vec3(n.x, n.y, n.z ?? 0));
  const polygons: Polygon[] = (json.polygons ?? []).map((p) => ({
    color: p.color,
    vertexIndices: p.vertexIndices,
    normalIndices: p.normalIndices,
  }));

  return {
    vertices,
    polygons,
    normals,
  };
}
