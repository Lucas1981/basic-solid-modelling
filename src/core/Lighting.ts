import { Vec3 } from "../math/vec3";
import { Vec4 } from "../math/vec4";
import { Mat4 } from "../math/mat4";

/** RGB 0–1. */
export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

/** Material: diffuse color (from polygon), specular, shininess, optional emissive. */
export interface Material {
  /** Diffuse color (e.g. from polygon.color). */
  diffuse: ColorRGB;
  /** Specular color (often white). */
  specular: ColorRGB;
  /** Shininess exponent for specular (e.g. 32). */
  shininess: number;
  /** Emissive (additive, no light needed). */
  emissive?: ColorRGB;
}

/** Directional light: direction (to light), color, intensity. */
export interface DirectionalLight {
  type: "directional";
  /** Direction from surface toward the light (unit vector). */
  direction: Vec3;
  color: ColorRGB;
  intensity: number;
}

/** Point light: position, color, intensity, optional attenuation. */
export interface PointLight {
  type: "point";
  position: Vec3;
  color: ColorRGB;
  intensity: number;
  /** Optional: constant, linear, quadratic attenuation. */
  attenuation?: { constant: number; linear: number; quadratic: number };
}

/** Spot light: position, direction, color, intensity, cone angle. */
export interface SpotLight {
  type: "spot";
  position: Vec3;
  /** Direction from position (unit vector). */
  direction: Vec3;
  color: ColorRGB;
  intensity: number;
  /** Inner/outer cone angles in radians, or single cutoff. */
  innerCone?: number;
  outerCone?: number;
  attenuation?: { constant: number; linear: number; quadratic: number };
}

export type Light = DirectionalLight | PointLight | SpotLight;

/**
 * Phong-style lighting: ambient + diffuse (N·L) + specular (R·V)^shininess + emissive.
 * All positions and directions in the same space (e.g. camera space).
 */
export function computeLighting(
  vertexPos: Vec3,
  normal: Vec3,
  viewDir: Vec3,
  material: Material,
  lights: Light[],
  ambientColor: ColorRGB,
): ColorRGB {
  const N = normal.length() > 1e-10 ? normal.normalize() : new Vec3(0, 1, 0);
  const V =
    viewDir.length() > 1e-10 ? viewDir.normalize() : new Vec3(0, 0, -1);

  let r = ambientColor.r * material.diffuse.r;
  let g = ambientColor.g * material.diffuse.g;
  let b = ambientColor.b * material.diffuse.b;

  if (material.emissive) {
    r += material.emissive.r;
    g += material.emissive.g;
    b += material.emissive.b;
  }

  for (const light of lights) {
    if (light.type === "directional") {
      const L =
        light.direction.length() > 1e-10
          ? light.direction.normalize()
          : light.direction;
      const NdotL = Math.max(0, N.dot(L));
      r += light.color.r * light.intensity * NdotL * material.diffuse.r;
      g += light.color.g * light.intensity * NdotL * material.diffuse.g;
      b += light.color.b * light.intensity * NdotL * material.diffuse.b;

      if (NdotL > 0 && material.shininess > 0) {
        const R = L.scale(-1).add(N.scale(2 * NdotL));
        const RdotV = Math.max(0, R.normalize().dot(V));
        const spec = Math.pow(RdotV, material.shininess);
        r += light.color.r * light.intensity * spec * material.specular.r;
        g += light.color.g * light.intensity * spec * material.specular.g;
        b += light.color.b * light.intensity * spec * material.specular.b;
      }
    } else if (light.type === "point") {
      const toLight = light.position.sub(vertexPos);
      const dist = toLight.length();
      if (dist < 1e-10) continue;
      const L = toLight.scale(1 / dist);
      const NdotL = Math.max(0, N.dot(L));
      let att = 1;
      if (light.attenuation) {
        const { constant, linear, quadratic } = light.attenuation;
        att = 1 / (constant + linear * dist + quadratic * dist * dist);
      }
      att *= light.intensity;
      r += light.color.r * att * NdotL * material.diffuse.r;
      g += light.color.g * att * NdotL * material.diffuse.g;
      b += light.color.b * att * NdotL * material.diffuse.b;

      if (NdotL > 0 && material.shininess > 0) {
        const R = L.scale(-1).add(N.scale(2 * NdotL));
        const RdotV = Math.max(0, R.normalize().dot(V));
        const spec = Math.pow(RdotV, material.shininess);
        r += light.color.r * att * spec * material.specular.r;
        g += light.color.g * att * spec * material.specular.g;
        b += light.color.b * att * spec * material.specular.b;
      }
    } else if (light.type === "spot") {
      const toLight = light.position.sub(vertexPos);
      const dist = toLight.length();
      if (dist < 1e-10) continue;
      const L = toLight.scale(1 / dist);
      const NdotL = Math.max(0, N.dot(L));
      const spotDir =
        light.direction.length() > 1e-10
          ? light.direction.normalize()
          : light.direction;
      const cosAngle = Math.max(0, L.negate().dot(spotDir));
      const outer = light.outerCone ?? Math.PI / 4;
      const inner = light.innerCone ?? outer * 0.8;
      let spot = 1;
      if (cosAngle < Math.cos(outer)) spot = 0;
      else if (cosAngle < Math.cos(inner))
        spot = (cosAngle - Math.cos(outer)) / (Math.cos(inner) - Math.cos(outer));
      let att = spot * light.intensity;
      if (light.attenuation) {
        const { constant, linear, quadratic } = light.attenuation;
        att /= constant + linear * dist + quadratic * dist * dist;
      }
      r += light.color.r * att * NdotL * material.diffuse.r;
      g += light.color.g * att * NdotL * material.diffuse.g;
      b += light.color.b * att * NdotL * material.diffuse.b;

      if (NdotL > 0 && material.shininess > 0) {
        const R = L.scale(-1).add(N.scale(2 * NdotL));
        const RdotV = Math.max(0, R.normalize().dot(V));
        const spec = Math.pow(RdotV, material.shininess);
        r += light.color.r * att * spec * material.specular.r;
        g += light.color.g * att * spec * material.specular.g;
        b += light.color.b * att * spec * material.specular.b;
      }
    }
  }

  return {
    r: Math.min(1, Math.max(0, r)),
    g: Math.min(1, Math.max(0, g)),
    b: Math.min(1, Math.max(0, b)),
  };
}

/** Transform lights from world space to camera space (view matrix). */
export function transformLightsToCameraSpace(
  lights: Light[],
  view: Mat4,
): Light[] {
  return lights.map((light) => {
    if (light.type === "directional") {
      const d = view.transformVec4(new Vec4(light.direction.x, light.direction.y, light.direction.z, 0));
      return { ...light, direction: new Vec3(d.x, d.y, d.z) };
    }
    if (light.type === "point") {
      const p = view.transformVec4(new Vec4(light.position.x, light.position.y, light.position.z, 1));
      return { ...light, position: new Vec3(p.x, p.y, p.z) };
    }
    if (light.type === "spot") {
      const p = view.transformVec4(new Vec4(light.position.x, light.position.y, light.position.z, 1));
      const d = view.transformVec4(new Vec4(light.direction.x, light.direction.y, light.direction.z, 0));
      return { ...light, position: new Vec3(p.x, p.y, p.z), direction: new Vec3(d.x, d.y, d.z) };
    }
    return light;
  });
}

/** Parse "#rrggbb" to ColorRGB 0–1. */
export function hexToColorRGB(hex: string): ColorRGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
    };
  }
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16) / 255,
      g: parseInt(h[1] + h[1], 16) / 255,
      b: parseInt(h[2] + h[2], 16) / 255,
    };
  }
  return { r: 1, g: 1, b: 1 };
}
