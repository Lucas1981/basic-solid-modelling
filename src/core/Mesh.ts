import { Vec3 } from "../math/vec3";
import { MeshData, Polygon } from "../io/meshLoader";

/**
 * Mesh holds immutable geometry: local-space vertices (3D positions),
 * per-vertex normals, polygons, and bounding radius.
 */
export class Mesh {
  readonly vertices: Vec3[];
  readonly vertexNormals: Vec3[];
  readonly polygons: Polygon[];
  readonly boundingRadius: number;

  constructor(vertices: Vec3[], polygons: Polygon[] = [], vertexNormals?: Vec3[]) {
    this.vertices = vertices;
    this.polygons = polygons;
    this.vertexNormals =
      vertexNormals ?? Mesh.computeVertexNormals(vertices, polygons);
    this.boundingRadius = Mesh.computeBoundingRadius(vertices);
  }

  /**
   * Create a Mesh from loaded mesh data (e.g. from JSON).
   * If normals are not in data, they are computed as average of adjacent face normals.
   */
  static fromData(data: MeshData): Mesh {
    const vertexNormals = data.normals
      ? Mesh.expandNormalsToPerVertex(data)
      : Mesh.computeVertexNormals(data.vertices, data.polygons);
    return new Mesh(data.vertices, data.polygons, vertexNormals);
  }

  /**
   * Expand loaded normals to per-vertex array: each vertex gets the average of normals from polygons that use it (via normalIndices or vertexIndices).
   */
  private static expandNormalsToPerVertex(data: MeshData): Vec3[] {
    const n = data.vertices.length;
    const normals = data.normals!;
    const sum = new Array<Vec3>(n);
    const count = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      sum[i] = new Vec3(0, 0, 0);
      count[i] = 0;
    }
    for (const poly of data.polygons) {
      const ni = poly.normalIndices ?? poly.vertexIndices;
      for (let k = 0; k < poly.vertexIndices.length; k++) {
        const vi = poly.vertexIndices[k];
        const nidx = ni[k];
        if (nidx < normals.length) {
          sum[vi] = sum[vi].add(normals[nidx]);
          count[vi]++;
        }
      }
    }
    const out: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      if (count[i] > 0) {
        const len = sum[i].length();
        out.push(len > 1e-10 ? sum[i].normalize() : new Vec3(0, 1, 0));
      } else {
        out.push(new Vec3(0, 1, 0));
      }
    }
    return out;
  }

  /**
   * Face normal from first three vertices (outward by right-hand rule).
   */
  private static faceNormalFromVertices(indices: number[], vertices: Vec3[]): Vec3 {
    if (indices.length < 3) return new Vec3(0, 1, 0);
    const v0 = vertices[indices[0]];
    const v1 = vertices[indices[1]];
    const v2 = vertices[indices[2]];
    const e1 = v1.sub(v0);
    const e2 = v2.sub(v0);
    const n = e1.cross(e2);
    const len = n.length();
    return len > 1e-10 ? n.normalize() : new Vec3(0, 1, 0);
  }

  /**
   * Compute per-vertex normals as average of adjacent face normals.
   */
  static computeVertexNormals(vertices: Vec3[], polygons: Polygon[]): Vec3[] {
    const n = vertices.length;
    const sum = new Array<Vec3>(n);
    const count = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      sum[i] = new Vec3(0, 0, 0);
      count[i] = 0;
    }
    for (const poly of polygons) {
      const fn = Mesh.faceNormalFromVertices(poly.vertexIndices, vertices);
      for (const vi of poly.vertexIndices) {
        sum[vi] = sum[vi].add(fn);
        count[vi]++;
      }
    }
    const out: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      if (count[i] > 0) {
        const len = sum[i].length();
        out.push(len > 1e-10 ? sum[i].normalize() : new Vec3(0, 1, 0));
      } else {
        out.push(new Vec3(0, 1, 0));
      }
    }
    return out;
  }

  /**
   * Bounding radius = max distance from origin to any vertex in local space.
   */
  static computeBoundingRadius(vertices: Vec3[]): number {
    let maxSq = 0;
    for (const v of vertices) {
      const sq = v.lengthSq();
      if (sq > maxSq) maxSq = sq;
    }
    return Math.sqrt(maxSq);
  }
}
