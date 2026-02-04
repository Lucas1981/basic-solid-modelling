// Entry point for the 3D solid modeling engine (Phase 8: texture mapping)
import { loadMesh, type MeshData, type MeshMaterial } from "./io/meshLoader";
import { loadTexturesForMesh } from "./io/textureLoader";
import { Vec3 } from "./math/vec3";
import { projectSceneToFilledPolygons } from "./core/renderHelpers";
import type { DirectionalLight, PointLight, SpotLight } from "./core/Lighting";
import { Viewport, projectPoint } from "./math/projection";
import { Vec4 } from "./math/vec4";
import { degToRad } from "./math/utils";
import { Canvas } from "./core/Canvas";
import { Framebuffer } from "./core/Framebuffer";
import {
  rasterizeTriangleGouraud,
  rasterizeTriangleGouraudTextured,
} from "./core/rasterizer";
import { Mesh } from "./core/Mesh";
import { Object3D } from "./core/Object3D";
import { Scene } from "./core/Scene";
import { Camera } from "./core/Camera";
import { Quat } from "./math/quat";
import { InputController } from "./core/Input";

/** Create a mesh from loaded data with optional material and face-normal overrides (for test variants). */
function meshFromDataWithOverrides(
  data: MeshData,
  overrides: { material?: MeshMaterial; useFaceNormalsForLighting?: boolean }
): Mesh {
  return Mesh.fromData({ ...data, ...overrides });
}

// Initialize canvas
const canvas = new Canvas("canvas", 800, 600);
const viewport: Viewport = {
  width: canvas.getWidth(),
  height: canvas.getHeight(),
};

// Camera parameters
const aspect = viewport.width / viewport.height;
const fov = degToRad(60);
const near = 0.1;
const far = 100;

// Simple fly camera state (Euler angles for control, stored as quaternion in Camera).
let yaw = 0; // left/right
let pitch = -degToRad(20); // slight downward tilt to start
const cameraPosition = new Vec3(0, 4, 10);
const camera = new Camera(
  cameraPosition,
  Quat.fromEuler(yaw, pitch, 0),
  fov,
  near,
  far
);
const input = new InputController();

/** When true, draw each polygon's surface normal as a small pink line. */
const DEBUG_SHOW_DIRECTION = false;

/** When true, show frames per second in the bottom-left corner. */
const SHOW_FPS = true;

/** When true, draw point/spot light positions as orange circles (radius by z-distance). Useful to verify test-scene lights. */
const SHOW_LIGHT_SOURCES = true;

/** When true, sort polygons by depth (farthest first) before drawing (Painter's algorithm). */
const APPLY_PAINTERS_ALGORITHM = true;

/** When true, skip polygons facing away from the camera (back-face culling). */
const APPLY_BACK_FACE_CULLING = true;

// Load cube meshes (untextured and textured) and build test-scene variants
async function main() {
  try {
    const urlNoTex = "./assets/cube-without-texture.json";
    const urlWithTex = "./assets/cube-with-texture.json";

    const meshDataNoTex = await loadMesh(urlNoTex);
    const meshDataWithTex = await loadMesh(urlWithTex);
    const textureMap = await loadTexturesForMesh(meshDataWithTex, urlWithTex);

    // Default material (from JSON): white specular, shininess 64
    const defaultMaterial: MeshMaterial = meshDataNoTex.material ?? {
      specular: "#ffffff",
      shininess: 64,
    };

    // Test-scene mesh variants (all derived from cube JSON)
    const meshFaceNorm = meshFromDataWithOverrides(meshDataNoTex, {
      material: defaultMaterial,
      useFaceNormalsForLighting: true,
    });
    const meshVertexNorm = meshFromDataWithOverrides(meshDataNoTex, {
      material: defaultMaterial,
      useFaceNormalsForLighting: false,
    });
    const meshLowShininess = meshFromDataWithOverrides(meshDataNoTex, {
      material: { specular: "#ffffff", shininess: 8 },
      useFaceNormalsForLighting: true,
    });
    const meshNoSpecular = meshFromDataWithOverrides(meshDataNoTex, {
      material: { specular: "#000000", shininess: 32 },
      useFaceNormalsForLighting: true,
    });
    const meshColoredSpecular = meshFromDataWithOverrides(meshDataNoTex, {
      material: { specular: "#ff4444", shininess: 64 },
      useFaceNormalsForLighting: true,
    });
    const meshTextured = Mesh.fromData(meshDataWithTex); // already has specular + face normals

    const scene = new Scene(camera);

    // Stage cubes in a row (x) and one textured cube slightly forward (z) for visibility
    // 1. Face normals, default material
    scene.add(new Object3D(meshFaceNorm, new Vec3(-6, 0, 0)));
    // 2. Vertex normals, default material (compare specular “duration” vs face-norm cube)
    scene.add(new Object3D(meshVertexNorm, new Vec3(-3, 0, 0)));
    // 3. Face normals, low shininess (broader, softer specular)
    scene.add(new Object3D(meshLowShininess, new Vec3(0, 0, 0)));
    // 4. Face normals, no specular (diffuse only)
    scene.add(new Object3D(meshNoSpecular, new Vec3(3, 0, 0)));
    // 5. Face normals, red specular
    scene.add(new Object3D(meshColoredSpecular, new Vec3(6, 0, 0)));
    // 6. Textured cube with specular (face normals)
    scene.add(new Object3D(meshTextured, new Vec3(0, -2.5, 0.5)));

    // Lights: directional + two point lights to verify multi-light and different colors
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
    // Spotlight from above-front, aimed at the center cube (low-shininess at 0,0,0)
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

    const framebuffer = new Framebuffer(viewport.width, viewport.height);
    let lastTime = performance.now();

    function render(currentTime: number) {
      framebuffer.clear("#000000");

      const now = currentTime;
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      // --- Camera controls via InputController ---
      const updated = input.updateCamera(yaw, pitch, camera, deltaTime);
      yaw = updated.yaw;
      pitch = updated.pitch;

      // --- Object animation ---
      const angle = (now / 1000) * ((Math.PI * 2) / 4);

      for (const object of scene.objects) {
        object.rotation.y = angle;
      }

      const view = camera.getViewMatrix();
      const projection = camera.getProjectionMatrix(aspect);
      const viewProj = projection.multiply(view);

      const { batches, debugNormalSegments } = projectSceneToFilledPolygons(
        scene,
        viewProj,
        viewport,
        {
          debugShowDirection: DEBUG_SHOW_DIRECTION,
          applyPaintersAlgorithm: APPLY_PAINTERS_ALGORITHM,
          applyBackFaceCulling: APPLY_BACK_FACE_CULLING,
          textureMap,
        }
      );
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

      canvas.blit(framebuffer);
      if (debugNormalSegments.length > 0) {
        canvas.drawLines(debugNormalSegments, "#ff69b4", 1);
      }
      if (SHOW_FPS) {
        const fps = deltaTime > 0 ? Math.round(1 / deltaTime) : 0;
        canvas.drawText(`${fps} FPS`, 10, canvas.getHeight() - 10, {
          color: "#00ff00",
          font: "14px monospace",
        });
      }
      if (SHOW_LIGHT_SOURCES) {
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

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  } catch (error) {
    console.error("Failed to load mesh:", error);
  }
}

main();
