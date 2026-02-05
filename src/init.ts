/**
 * Scene initialization: load assets, create canvas/camera/scene, and return
 * everything needed for the render loop. Call from main() in index.ts.
 */
import { loadMesh, type MeshData, type MeshMaterial } from "./io/meshLoader";
import { loadTexturesForMesh } from "./io/textureLoader";
import { Vec3 } from "./math/vec3";
import { degToRad } from "./math/utils";
import { Canvas } from "./core/Canvas";
import { Framebuffer } from "./core/Framebuffer";
import { Mesh } from "./core/Mesh";
import { Object3D } from "./core/Object3D";
import { Scene } from "./core/Scene";
import { Camera } from "./core/Camera";
import { Quat } from "./math/quat";
import { InputController } from "./core/Input";
import type { DirectionalLight, PointLight, SpotLight } from "./core/Lighting";
import { Viewport } from "./math/projection";

/** Debug overlay options returned by init (what to draw). */
export interface InitDebugOptions {
  showFaceNormals: boolean;
  showFps: boolean;
  showLightSources: boolean;
  showLightDirections: boolean;
  showVertexNormals: boolean;
}

/** Render pipeline config (visibility and order). */
export interface InitRenderConfig {
  applyPaintersAlgorithm: boolean;
  applyBackFaceCulling: boolean;
}

/** Mutable camera state (yaw/pitch) updated each frame by the render loop. */
export interface CameraState {
  yaw: number;
  pitch: number;
}

/** Result of successful init(); null if loading failed. */
export interface InitResult {
  canvas: Canvas;
  viewport: Viewport;
  aspect: number;
  scene: Scene;
  framebuffer: Framebuffer;
  textureMap: Map<string, ImageData>;
  camera: Camera;
  input: InputController;
  cameraState: CameraState;
  debug: InitDebugOptions;
  config: InitRenderConfig;
}

/** Result of loading scene assets (meshes + textures). Null on failure. */
interface SceneAssets {
  meshDataNoTex: MeshData;
  meshDataWithTex: MeshData;
  textureMap: Map<string, ImageData>;
}

/** Create a mesh from loaded data with optional material and face-normal overrides. */
function meshFromDataWithOverrides(
  data: MeshData,
  overrides: { material?: MeshMaterial; useFaceNormalsForLighting?: boolean }
): Mesh {
  return Mesh.fromData({ ...data, ...overrides });
}

/** Meshes used by the test scene (built from cube JSON variants). */
interface TestSceneMeshes {
  meshFaceNorm: Mesh;
  meshVertexNorm: Mesh;
  meshLowShininess: Mesh;
  meshNoSpecular: Mesh;
  meshColoredSpecular: Mesh;
  meshTextured: Mesh;
}

function buildTestSceneMeshes(
  meshDataNoTex: MeshData,
  meshDataWithTex: MeshData
): TestSceneMeshes {
  const defaultMaterial: MeshMaterial = meshDataNoTex.material ?? {
    specular: "#ffffff",
    shininess: 64,
  };
  return {
    meshFaceNorm: meshFromDataWithOverrides(meshDataNoTex, {
      material: defaultMaterial,
      useFaceNormalsForLighting: true,
    }),
    meshVertexNorm: meshFromDataWithOverrides(meshDataNoTex, {
      material: defaultMaterial,
      useFaceNormalsForLighting: false,
    }),
    meshLowShininess: meshFromDataWithOverrides(meshDataNoTex, {
      material: { specular: "#ffffff", shininess: 8 },
      useFaceNormalsForLighting: true,
    }),
    meshNoSpecular: meshFromDataWithOverrides(meshDataNoTex, {
      material: { specular: "#000000", shininess: 32 },
      useFaceNormalsForLighting: true,
    }),
    meshColoredSpecular: meshFromDataWithOverrides(meshDataNoTex, {
      material: { specular: "#ff4444", shininess: 64 },
      useFaceNormalsForLighting: true,
    }),
    meshTextured: Mesh.fromData(meshDataWithTex),
  };
}

function addTestCubes(scene: Scene, meshes: TestSceneMeshes): void {
  scene.add(new Object3D(meshes.meshFaceNorm, new Vec3(-6, 0, 0)));
  scene.add(new Object3D(meshes.meshVertexNorm, new Vec3(-3, 0, 0)));
  scene.add(new Object3D(meshes.meshLowShininess, new Vec3(0, 0, 0)));
  scene.add(new Object3D(meshes.meshNoSpecular, new Vec3(3, 0, 0)));
  scene.add(new Object3D(meshes.meshColoredSpecular, new Vec3(6, 0, 0)));
  scene.add(new Object3D(meshes.meshTextured, new Vec3(0, -2.5, 0.5)));
}

function addTestLights(scene: Scene): void {
  const dirToLight = new Vec3(1, 1.5, 0.5).normalize();
  scene.lights.push({
    type: "directional",
    direction: dirToLight,
    color: { r: 1, g: 1, b: 1 },
    intensity: 0.7,
  } as DirectionalLight);
  scene.lights.push({
    type: "point",
    position: new Vec3(2, 3, 5),
    color: { r: 1, g: 0.9, b: 0.85 },
    intensity: 1.0,
    attenuation: { constant: 0.2, linear: 0.1, quadratic: 0.02 },
  } as PointLight);
  scene.lights.push({
    type: "point",
    position: new Vec3(-3, 2, 4),
    color: { r: 0.6, g: 0.7, b: 1 },
    intensity: 0.8,
    attenuation: { constant: 0.2, linear: 0.12, quadratic: 0.02 },
  } as PointLight);
  const spotPos = new Vec3(0, 2.5, 2);
  const spotTarget = new Vec3(0, 0, 0);
  scene.lights.push({
    type: "spot",
    position: spotPos,
    direction: spotTarget.sub(spotPos).normalize(),
    color: { r: 1, g: 1, b: 0.95 },
    intensity: 1.4,
    innerCone: degToRad(15),
    outerCone: degToRad(28),
    attenuation: { constant: 0.2, linear: 0.08, quadratic: 0.02 },
  } as SpotLight);
  scene.ambientColor = { r: 0.1, g: 0.1, b: 0.15 };
}

async function loadSceneAssets(): Promise<SceneAssets | null> {
  const urlNoTex = "./assets/cube-without-texture.json";
  const urlWithTex = "./assets/cube-with-texture.json";
  try {
    const meshDataNoTex = await loadMesh(urlNoTex);
    const meshDataWithTex = await loadMesh(urlWithTex);
    const textureMap = await loadTexturesForMesh(meshDataWithTex, urlWithTex);
    return { meshDataNoTex, meshDataWithTex, textureMap };
  } catch (error) {
    console.error("Failed to load scene assets:", error);
    return null;
  }
}

/**
 * Load assets, create canvas/camera/scene/framebuffer, and return everything
 * needed to run the render loop. Returns null if loading fails.
 */
export async function init(): Promise<InitResult | null> {
  const assets = await loadSceneAssets();
  if (!assets) return null;

  const canvas = new Canvas("canvas", 800, 600);
  const viewport: Viewport = {
    width: canvas.getWidth(),
    height: canvas.getHeight(),
  };
  const aspect = viewport.width / viewport.height;
  const fov = degToRad(60);
  const near = 0.1;
  const far = 100;

  const cameraState: CameraState = {
    yaw: 0,
    pitch: -degToRad(20),
  };
  const cameraPosition = new Vec3(0, 4, 10);
  const camera = new Camera(
    cameraPosition,
    Quat.fromEuler(cameraState.yaw, cameraState.pitch, 0),
    fov,
    near,
    far
  );
  const input = new InputController();

  const meshes = buildTestSceneMeshes(
    assets.meshDataNoTex,
    assets.meshDataWithTex
  );
  const scene = new Scene(camera);
  addTestCubes(scene, meshes);
  addTestLights(scene);

  const framebuffer = new Framebuffer(viewport.width, viewport.height);

  return {
    canvas,
    viewport,
    aspect,
    scene,
    framebuffer,
    textureMap: assets.textureMap,
    camera,
    input,
    cameraState,
    debug: {
      showFaceNormals: false,
      showFps: true,
      showLightSources: true,
      showLightDirections: false,
      showVertexNormals: false,
    },
    config: {
      applyPaintersAlgorithm: true,
      applyBackFaceCulling: true,
    },
  };
}
