# Solid Modeling 3D Engine

A TypeScript 3D engine that renders meshes as **filled, lit, textured triangles**. It extends a wireframe foundation with a full math and projection pipeline, object-level frustum culling, **back-face culling**, **Painter's algorithm** (depth sort), **Gouraud shading**, **Phong-style lighting** (ambient, diffuse, specular), and **texture mapping** with perspective-correct UV interpolation. No z-buffer: visibility is handled by back-face culling and drawing back-to-front.

## Features

### Core pipeline
- **Math:** Vec2, Vec3, Vec4 (dot, cross, normalize), Mat4 (multiply, transformVec4, translation, scaling, rotation, perspective, normalMatrix), Quat (fromEuler, conjugate, toMat4).
- **Projection:** Viewport, NDC → screen (Y flip), `projectPoint(point, mvp, viewport)` with screen (x, y), clip-space `w`, and `behind` flag.
- **Scene:** Camera (position, orientation, fov/near/far), Object3D (mesh, position, rotation, scale), Scene (objects + camera + lights).
- **Mesh:** Vertices (Vec3[]), polygons (color, vertexIndices, optional textureUrl, uvIndices), optional vertexNormals and uvs; bounding radius for culling.

### Visibility and order
- **Frustum culling:** Object-level; world bounding sphere vs view frustum.
- **Back-face culling:** Polygon normal in camera space (e1×e2 from first three vertices); cull when dot(v0, n) ≥ 0. Mesh should be wound CCW from outside so normals point outward.
- **Painter's algorithm:** Depth = farthest vertex (min camera-space z); sort ascending (farthest first); stable tie-breaker by batch index.

### Rendering
- **Framebuffer:** Color buffer (ImageData), `clear(color)`, `putPixel(x, y, r, g, b)`, no depth buffer.
- **Rasterizer:** Barycentric triangle rasterization; Gouraud (interpolate r,g,b with optional 1/w); textured (interpolate u/w, v/w, 1/w; sample texture; final color = texture × lighting).
- **Lighting:** Phong-style in `Lighting.ts`: ambient, diffuse (N·L), specular (R·V)^shininess, emissive; directional, point, and spot lights; lights and normals in camera space for shading.

### IO and assets
- **Mesh:** JSON via `loadMesh(url)` — vertices, polygons (color, vertexIndices, textureUrl?, uvIndices?), optional uvs, normals.
- **Textures:** `loadTexturesForMesh(meshData, meshBaseUrl)` loads all textureUrl values from polygons into a Map; nearest-neighbor sampling with wrap.

### Debug
- **DEBUG_SHOW_DIRECTION:** When true, draw polygon surface normals as small pink lines.
- **SHOW_FPS:** When true, show frames per second in the bottom-left corner (green monospace).
- **APPLY_PAINTERS_ALGORITHM** / **APPLY_BACK_FACE_CULLING:** Toggle depth sort and back-face culling in `index.ts`.

## Project structure

```
src/
  index.ts            # Entry: load mesh + textures, scene, render loop (Gouraud textured)
  index.html          # Canvas and script
  core/
    Camera.ts        # Perspective camera (view / projection matrices)
    Canvas.ts        # HTML5 Canvas wrapper (clear, drawLine, drawLines, blit, fillPolygon, drawText)
    Framebuffer.ts   # Color buffer (ImageData, clear, putPixel)
    rasterizer.ts   # rasterizeTriangle, rasterizeTriangleGouraud, rasterizeTriangleGouraudTextured
    renderHelpers.ts # projectSceneToFilledPolygons, frustum/backface/depth, Gouraud vertex collection
    Lighting.ts      # computeLighting, light types, transformLightsToCameraSpace
    Scene.ts         # Object3D[] + Camera + lights + ambientColor
    Object3D.ts      # Mesh instance (position, rotation, scale)
    Mesh.ts          # Vertices, polygons, optional vertexNormals, uvs, bounding radius
    Input.ts         # Fly-camera input
  math/
    vec2.ts, vec3.ts, vec4.ts
    mat4.ts, quat.ts
    projection.ts    # projectPoint, NDC→screen
    frustum.ts       # isSphereInFrustum
    utils.ts
  io/
    meshLoader.ts    # loadMesh, MeshData, Polygon (color, vertexIndices, textureUrl?, uvIndices?)
    textureLoader.ts # loadTexture, loadTexturesForMesh
  assets/
    cube.json        # Example mesh (vertices, uvs, polygons with textureUrl + uvIndices)
    cat.jpg         # Example texture
```

## How to use

### Build and run
1. `npm install`
2. `npm run build`
3. Open `dist/index.html` (or serve the project and open the page). The demo loads `./assets/cube.json`, loads textures for all polygon `textureUrl` values, creates a scene with two rotating cubes, directional + point light, and renders with a fly camera.

### Load mesh and textures
```ts
const meshUrl = "./assets/cube.json";
const meshData = await loadMesh(meshUrl);
const mesh = Mesh.fromData(meshData);
const textureMap = await loadTexturesForMesh(meshData, meshUrl);
```

### Build a scene
```ts
const scene = new Scene(camera);
scene.add(new Object3D(mesh, new Vec3(-2, 0, 0)));
scene.lights.push({ type: "directional", direction, color, intensity } as DirectionalLight);
scene.lights.push({ type: "point", position, color, intensity, attenuation } as PointLight);
scene.ambientColor = { r: 0.12, g: 0.12, b: 0.18 };
```

### Render loop (filled polygons)
Each frame:
1. Clear framebuffer, update camera from input, update object rotations.
2. `projectSceneToFilledPolygons(scene, viewProj, viewport, { applyBackFaceCulling, applyPaintersAlgorithm, textureMap })` → batches of Gouraud vertices (x, y, r, g, b, invW, u?, v?) and optional texture.
3. For each batch: if `batch.texture` use `rasterizeTriangleGouraudTextured(framebuffer, a, b, c, texture)`, else `rasterizeTriangleGouraud(framebuffer, a, b, c)`.
4. `canvas.blit(framebuffer)`.
5. If debug: draw normals with `canvas.drawLines(debugNormalSegments, "#ff69b4")`; if SHOW_FPS, `canvas.drawText(\`${fps} FPS\`, 10, height - 10)`.

### Flags (in `index.ts`)
- **SHOW_FPS** (default `true`): Show FPS in bottom-left.
- **DEBUG_SHOW_DIRECTION** (default `false`): Draw polygon normals in pink.
- **APPLY_PAINTERS_ALGORITHM** (default `true`): Sort polygons by depth (farthest first).
- **APPLY_BACK_FACE_CULLING** (default `true`): Skip polygons facing away from the camera.

## Data structures

### JSON mesh format
- **vertices:** `[{ x, y, z }, ...]` in local space.
- **uvs:** Optional `[{ u, v }, ...]`; each polygon references by uvIndices.
- **polygons:** `[{ color, vertexIndices, textureUrl?, uvIndices? }, ...]`. Triangles (3 indices). If `textureUrl` is set, `uvIndices` must match vertex count; texture is loaded and applied with lighting (texture × lighting).

Mesh winding: both triangles of each quad should be wound **CCW when viewed from outside** so that the computed normal (e1×e2) points outward and back-face culling is correct.

### In-memory
- **Mesh:** `vertices`, `polygons`, `vertexNormals?`, `uvs?`, `boundingRadius`.
- **Polygon:** `color`, `vertexIndices`, `textureUrl?`, `uvIndices?`.
- **Scene:** `objects`, `camera`, `lights`, `ambientColor`.
- **Filled batch:** `vertices` (GouraudVertex[]), `depth`, `texture?`, `batchIndex`.

## Rendering pipeline

1. **Load:** JSON → MeshData → Mesh; load textures for all polygon textureUrl.
2. **Scene:** Mesh + Object3D transforms; Scene with Camera and lights.
3. **Per frame:**
   - Frustum cull objects (world bounding sphere vs view frustum).
   - For each visible object: transform vertices and normals to camera space; project vertices (full ProjectedPoint with w).
   - For each polygon: compute face normal (e1×e2); if back-face culling, skip when dot(v0, n) ≥ 0; build Gouraud vertices (per-vertex lighting, optional UVs); depth = min vertex z; optional texture from textureMap.
   - If Painter's: sort batches by depth ascending, tie-break by batchIndex.
   - For each batch: rasterize triangle (Gouraud or Gouraud textured) into framebuffer.
   - Blit framebuffer to canvas; draw debug normals and FPS if enabled.

Pipeline: **JSON + textures → Mesh → Object3D → Scene → frustum cull → camera-space transform → back-face cull → per-vertex lighting + UVs → depth sort → rasterize (Gouraud/textured) → blit → debug overlay.**

## Plan completion

This implementation follows [docs/plan.md](docs/plan.md):

- **Phases 1–3:** Flat fill path, color buffer (Framebuffer), triangle rasterization.
- **Phase 4:** Gouraud shading (vertex color interpolation, perspective-correct when invW present).
- **Phases 5–7:** Per-vertex normals (from mesh or face), Phong-style lighting (Lighting.ts), per-vertex lighting with Gouraud.
- **Phase 8:** Texture mapping (UVs, loadTexture/loadTexturesForMesh, perspective-correct u/v, texture × lighting).
- **Phase 9:** Demo with textured cube, debug options (normals, FPS), and this README.

No z-buffer; visibility is handled by back-face culling and Painter's algorithm only.
