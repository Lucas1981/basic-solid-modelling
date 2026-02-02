import { Object3D } from "./Object3D";
import { Camera } from "./Camera";
import type { Light } from "./Lighting";

/**
 * Scene (world) holds all objects to be rendered, the active camera, and lights.
 */
export class Scene {
  private _objects: Object3D[] = [];
  camera: Camera;
  /** Lights in the scene (direction/position in world space; renderer may transform to camera space). */
  lights: Light[] = [];
  /** Ambient color (RGB 0–1) applied to all surfaces. */
  ambientColor: { r: number; g: number; b: number } = { r: 0.15, g: 0.15, b: 0.2 };

  constructor(camera: Camera) {
    this.camera = camera;
  }

  get objects(): readonly Object3D[] {
    return this._objects;
  }

  add(object: Object3D): void {
    this._objects.push(object);
  }

  remove(object: Object3D): boolean {
    const i = this._objects.indexOf(object);
    if (i === -1) return false;
    this._objects.splice(i, 1);
    return true;
  }

  clear(): void {
    this._objects.length = 0;
  }
}

