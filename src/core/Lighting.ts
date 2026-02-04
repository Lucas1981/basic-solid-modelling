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

const EPS = 1e-10;

function clampColor(c: { r: number; g: number; b: number }): ColorRGB {
  return {
    r: Math.min(1, Math.max(0, c.r)),
    g: Math.min(1, Math.max(0, c.g)),
    b: Math.min(1, Math.max(0, c.b)),
  };
}

function safeNormalize(v: Vec3, fallback: Vec3): Vec3 {
  return v.length() > EPS ? v.normalize() : fallback;
}

/** Phong specular factor (R·V)^shininess; 0 if surface faces away from light or shininess is 0. */
function specularFactor(L: Vec3, N: Vec3, V: Vec3, shininess: number): number {
  if (shininess <= 0) return 0;
  const NdotL = N.dot(L);
  if (NdotL <= 0) return 0;
  const R = L.scale(-1).add(N.scale(2 * NdotL));
  const RdotV = Math.max(0, safeNormalize(R, N).dot(V));
  return Math.pow(RdotV, shininess);
}

/** Diffuse and specular contribution from one light (direction L, attenuation att). */
function lightContribution(
  L: Vec3,
  att: number,
  N: Vec3,
  V: Vec3,
  material: Material,
  lightColor: ColorRGB,
): { diffuse: ColorRGB; specular: ColorRGB } {
  const NdotL = Math.max(0, N.dot(L));
  const diffuse = {
    r: lightColor.r * att * NdotL * material.diffuse.r,
    g: lightColor.g * att * NdotL * material.diffuse.g,
    b: lightColor.b * att * NdotL * material.diffuse.b,
  };
  const spec = specularFactor(L, N, V, material.shininess);
  const specular = {
    r: lightColor.r * att * spec * material.specular.r,
    g: lightColor.g * att * spec * material.specular.g,
    b: lightColor.b * att * spec * material.specular.b,
  };
  return { diffuse, specular };
}

function getDirectionalLAndAtt(light: DirectionalLight): { L: Vec3; att: number } {
  return { L: safeNormalize(light.direction, light.direction), att: light.intensity };
}

function pointAttenuation(light: PointLight, dist: number): number {
  if (!light.attenuation) return light.intensity;
  const { constant, linear, quadratic } = light.attenuation;
  return light.intensity / (constant + linear * dist + quadratic * dist * dist);
}

function getPointLAndAtt(
  light: PointLight,
  vertexPos: Vec3,
): { L: Vec3; att: number } | null {
  const toLight = light.position.sub(vertexPos);
  const dist = toLight.length();
  if (dist < EPS) return null;
  const L = toLight.scale(1 / dist);
  return { L, att: pointAttenuation(light, dist) };
}

function getSpotLAndAtt(
  light: SpotLight,
  vertexPos: Vec3,
): { L: Vec3; att: number } | null {
  const toLight = light.position.sub(vertexPos);
  const dist = toLight.length();
  if (dist < EPS) return null;
  const L = toLight.scale(1 / dist);
  const spotDir = safeNormalize(light.direction, light.direction);
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
  return { L, att };
}

/**
 * Core: ambient + emissive + per-light diffuse and specular. Returns unclamped totals.
 */
function computeLightingComponents(
  vertexPos: Vec3,
  normal: Vec3,
  viewDir: Vec3,
  material: Material,
  lights: Light[],
  ambientColor: ColorRGB,
): { diffuse: ColorRGB; specular: ColorRGB } {
  const N = safeNormalize(normal, new Vec3(0, 1, 0));
  const V = safeNormalize(viewDir, new Vec3(0, 0, -1));

  let rd = ambientColor.r * material.diffuse.r;
  let gd = ambientColor.g * material.diffuse.g;
  let bd = ambientColor.b * material.diffuse.b;
  let rs = 0, gs = 0, bs = 0;

  if (material.emissive) {
    rd += material.emissive.r;
    gd += material.emissive.g;
    bd += material.emissive.b;
  }

  for (const light of lights) {
    let L: Vec3, att: number;
    if (light.type === "directional") {
      const out = getDirectionalLAndAtt(light);
      L = out.L;
      att = out.att;
    } else if (light.type === "point") {
      const out = getPointLAndAtt(light, vertexPos);
      if (!out) continue;
      L = out.L;
      att = out.att;
    } else {
      const out = getSpotLAndAtt(light, vertexPos);
      if (!out) continue;
      L = out.L;
      att = out.att;
    }
    const contrib = lightContribution(L, att, N, V, material, light.color);
    rd += contrib.diffuse.r;
    gd += contrib.diffuse.g;
    bd += contrib.diffuse.b;
    rs += contrib.specular.r;
    gs += contrib.specular.g;
    bs += contrib.specular.b;
  }

  return {
    diffuse: { r: rd, g: gd, b: bd },
    specular: { r: rs, g: gs, b: bs },
  };
}

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
  const { diffuse, specular } = computeLightingComponents(
    vertexPos,
    normal,
    viewDir,
    material,
    lights,
    ambientColor,
  );
  return clampColor({
    r: diffuse.r + specular.r,
    g: diffuse.g + specular.g,
    b: diffuse.b + specular.b,
  });
}

/**
 * Same as computeLighting but returns diffuse and specular separately (each 0–1).
 * Use for textured surfaces so specular can be added on top of (texture × diffuse).
 */
export function computeLightingDiffuseAndSpecular(
  vertexPos: Vec3,
  normal: Vec3,
  viewDir: Vec3,
  material: Material,
  lights: Light[],
  ambientColor: ColorRGB,
): { diffuse: ColorRGB; specular: ColorRGB } {
  const { diffuse, specular } = computeLightingComponents(
    vertexPos,
    normal,
    viewDir,
    material,
    lights,
    ambientColor,
  );
  return {
    diffuse: clampColor(diffuse),
    specular: clampColor(specular),
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

/** Parse "#rrggbb" or "#rgb" to ColorRGB 0–1. */
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
