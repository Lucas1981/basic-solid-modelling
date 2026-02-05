# Solid Modeling 3D Engine

A TypeScript 3D engine that renders meshes as **filled, lit, textured triangles**. It extends a wireframe foundation with a full math and projection pipeline, object-level frustum culling, **back-face culling**, **Painter's algorithm** (depth sort), **Gouraud shading**, **Phong-style lighting** (ambient, diffuse, specular), and **texture mapping** with perspective-correct UV interpolation. No z-buffer: visibility is handled by back-face culling and drawing back-to-front.

## Features

### Core pipeline
- **Math:** Vec2, Vec3, Vec4 (dot, cross, normalize), Mat4 (multiply, transformVec4, translation, scaling, rotation, perspective, normalMatrix), Quat (fromEuler, conjugate, toMat4).
- **Projection:** Viewport, NDC → screen (Y flip), `projectPoint(point, mvp, viewport)` with screen (x, y), clip-space `w`, and `behind` flag.
- **Scene:** Camera (position, orientation, fov/near/far), Object3D (mesh, position, rotation, scale), Scene (objects + camera + lights).
- **Mesh:** Vertices (Vec3[]), polygons (color, vertexIndices, optional textureUrl, uvIndices), optional vertexNormals and uvs; optional **material** (specular color, shininess) and **useFaceNormalsForLighting** (face vs per-vertex normals); bounding radius for culling.

### Visibility and order
- **Frustum culling:** Object-level; world bounding sphere vs view frustum.
- **Back-face culling:** Polygon normal in camera space (e1×e2 from first three vertices); cull when dot(v0, n) ≥ 0. Mesh should be wound CCW from outside so normals point outward.
- **Painter's algorithm:** Depth = farthest vertex (min camera-space z); sort ascending (farthest first); stable tie-breaker by batch index.

### Rendering
- **Framebuffer:** Color buffer (ImageData), `clear(color)`, `putPixel(x, y, r, g, b)`, no depth buffer.
- **Rasterizer:** Barycentric triangle rasterization; Gouraud (interpolate r,g,b with optional 1/w); textured (interpolate u/w, v/w, 1/w; sample texture; final color = (texture × diffuse) + specular for additive specular on textured polygons).
- **Lighting:** Phong-style in `Lighting.ts`: ambient, diffuse (N·L), specular (R·V)^shininess, emissive; **directional**, **point**, and **spot** lights (position, direction, inner/outer cone, attenuation); lights and normals in camera space for shading.

### IO and assets
- **Mesh:** JSON via `loadMesh(url)` — vertices, polygons (color, vertexIndices, textureUrl?, uvIndices?), optional uvs, normals, **material** (specular, shininess), **useFaceNormalsForLighting**.
- **Textures:** `loadTexturesForMesh(meshData, meshBaseUrl)` loads all textureUrl values from polygons into a Map; nearest-neighbor sampling with wrap.

### Debug
- Debug overlay options are configured in **init.ts** and returned as **result.debug** (InitDebugOptions). The overlay is drawn by **utils.drawDebugOverlay(...)**.
- **showFaceNormals:** When true, draw polygon face normals as small pink lines.
- **showFps:** When true, show frames per second in the bottom-left corner (green monospace).
- **showLightSources:** When true, draw point and spot light positions as orange filled circles with red outline; radius scales with camera-space z (clamped 2–16 px).
- **showLightDirections:** When true, draw purple lines in the direction of directional and spot lights.
- **showVertexNormals:** When true, draw per-vertex normals as cyan lines.
- Render pipeline options (depth sort, back-face culling) are in **result.config** (InitRenderConfig), not in debug.

## Project structure

```
src/
  index.ts            # Entry: calls init(), then render loop only (projectSceneToFilledPolygons, rasterizeBatches, drawDebugOverlay)
  index.html          # Canvas and script
  init.ts             # Scene init: loadSceneAssets(), canvas/viewport, camera, input, test scene (meshes, cubes, lights), framebuffer, debug options, config; exports init() → InitResult | null
  utils.ts            # rasterizeBatches(framebuffer, batches), drawDebugOverlay(..., debugNormalSegments, debugVertexNormalSegments, debug), DebugOverlayOptions
  core/
    Camera.ts        # Perspective camera (view / projection matrices)
    Canvas.ts        # HTML5 Canvas wrapper (clear, drawLine, drawLines, blit, fillPolygon, drawText, drawFilledCircle)
    Framebuffer.ts   # Color buffer (ImageData, clear, putPixel)
    rasterizer.ts   # rasterizeTriangle, rasterizeTriangleGouraud, rasterizeTriangleGouraudTextured
    renderHelpers.ts # projectSceneToFilledPolygons, frustum/backface/depth, Gouraud vertex collection
    Lighting.ts      # computeLighting, light types (directional, point, spot), transformLightsToCameraSpace
    Scene.ts         # Object3D[] + Camera + lights + ambientColor
    Object3D.ts      # Mesh instance (position, rotation, scale)
    Mesh.ts          # Vertices, polygons, optional vertexNormals, uvs, material, useFaceNormalsForLighting, bounding radius
    Input.ts         # Fly-camera input
  math/
    vec2.ts, vec3.ts, vec4.ts
    mat4.ts, quat.ts
    projection.ts    # projectPoint, NDC→screen
    frustum.ts       # isSphereInFrustum
    utils.ts
  io/
    meshLoader.ts    # loadMesh, MeshData, Polygon (color, vertexIndices, textureUrl?, uvIndices?), material?, useFaceNormalsForLighting?
    textureLoader.ts # loadTexture, loadTexturesForMesh
  assets/
    cube-without-texture.json  # Untextured cube (vertices, polygons, optional material)
    cube-with-texture.json    # Textured cube (vertices, uvs, polygons with textureUrl + uvIndices)
    cat.jpg                   # Example texture
```

## How to use

### Build and run
1. `npm install`
2. `npm run build`
3. Open `dist/index.html` (or serve the project and open the page). The demo calls **init()**, which loads `cube-without-texture.json` and `cube-with-texture.json`, loads textures for polygon `textureUrl` values, builds a **test scene** with **six rotating cubes** (face normals, vertex normals, low shininess, no specular, red specular, textured) and **four lights** (directional + two point + spotlight), then returns canvas, scene, framebuffer, **debug** and **config**. The render loop runs with a fly camera.

### Load mesh and textures (e.g. inside init or custom setup)
```ts
const meshDataNoTex = await loadMesh("./assets/cube-without-texture.json");
const meshDataWithTex = await loadMesh("./assets/cube-with-texture.json");
const mesh = Mesh.fromData(meshDataWithTex);
const textureMap = await loadTexturesForMesh(meshDataWithTex, baseUrl);
```

### Build a scene
```ts
const scene = new Scene(camera);
scene.add(new Object3D(mesh, new Vec3(-2, 0, 0)));
scene.lights.push({ type: "directional", direction, color, intensity } as DirectionalLight);
scene.lights.push({ type: "point", position, color, intensity, attenuation } as PointLight);
scene.lights.push({ type: "spot", position, direction, color, intensity, innerCone, outerCone, attenuation } as SpotLight);
scene.ambientColor = { r: 0.12, g: 0.12, b: 0.18 };
```

### Render loop (filled polygons)
Each frame (in **index.ts** after `const result = await init()`):
1. Clear framebuffer, update camera from input (`result.input`, `result.cameraState`), update object rotations.
2. `projectSceneToFilledPolygons(scene, viewProj, viewport, { debugShowFaceNormals, debugShowVertexNormals, applyPaintersAlgorithm, applyBackFaceCulling, textureMap })` — pass **config.applyPaintersAlgorithm** and **config.applyBackFaceCulling** from **result.config**; → batches of Gouraud vertices (x, y, r, g, b, invW, u?, v?) and optional texture.
3. **rasterizeBatches(framebuffer, batches)** (from **utils**) — for each batch, if `batch.texture` use Gouraud textured, else Gouraud.
4. `canvas.blit(framebuffer)`.
5. **drawDebugOverlay(canvas, scene, view, projection, viewport, debugNormalSegments, debugVertexNormalSegments, deltaTime, debug)** (from **utils**) to draw face normals (pink), vertex normals (cyan), FPS, light positions (orange), and light directions (purple) when enabled.

### Debug options (in init.ts, returned as result.debug)
- **showFps** (default `true`): Show FPS in bottom-left.
- **showLightSources** (default `true`): Draw point/spot light positions as orange circles (red outline), radius 2–16 px by distance.
- **showFaceNormals** (default `false`): Draw polygon face normals in pink.
- **showLightDirections** (default `false`): Draw directional and spot light directions as purple lines.
- **showVertexNormals** (default `false`): Draw per-vertex normals in cyan.

### Render config (in init.ts, returned as result.config)
- **applyPaintersAlgorithm** (default `true`): Sort polygons by depth (farthest first).
- **applyBackFaceCulling** (default `true`): Skip polygons facing away from the camera.

## Data structures

### JSON mesh format
- **vertices:** `[{ x, y, z }, ...]` in local space.
- **uvs:** Optional `[{ u, v }, ...]`; each polygon references by uvIndices.
- **polygons:** `[{ color, vertexIndices, textureUrl?, uvIndices? }, ...]`. Triangles (3 indices). If `textureUrl` is set, `uvIndices` must match vertex count; texture is applied with lighting: (texture × diffuse) + specular.
- **material:** Optional mesh-wide `{ specular: "#hex", shininess: number }`.
- **useFaceNormalsForLighting:** Optional boolean; when true, use one face normal (and consistent lighting) per polygon; when false, use per-vertex normals. Default true.

Mesh winding: both triangles of each quad should be wound **CCW when viewed from outside** so that the computed normal (e1×e2) points outward and back-face culling is correct. Using a consistent diagonal split (e.g. first-to-third vertex) on all faces avoids lighting asymmetry.

### In-memory
- **Mesh:** `vertices`, `polygons`, `vertexNormals?`, `uvs?`, `material?`, `useFaceNormalsForLighting`, `boundingRadius`.
- **Polygon:** `color`, `vertexIndices`, `textureUrl?`, `uvIndices?`.
- **Scene:** `objects`, `camera`, `lights`, `ambientColor`.
- **Lights:** DirectionalLight, PointLight, SpotLight (position, direction, inner/outer cone, attenuation).
- **Filled batch:** `vertices` (GouraudVertex[]), `depth`, `texture?`, `batchIndex`.

## Rendering pipeline

1. **Init (init.ts):** Load assets (loadSceneAssets → mesh data + textureMap); create canvas, viewport, camera, input; build test scene (meshes from cube JSONs, addTestCubes, addTestLights); create framebuffer; return InitResult (canvas, scene, framebuffer, textureMap, camera, input, cameraState, **debug**, **config**).
2. **Per frame (index.ts):** Update camera and object rotations; projectSceneToFilledPolygons (frustum cull, camera-space transform, back-face cull, per-vertex or per-face lighting, depth sort); rasterizeBatches; blit; drawDebugOverlay.
3. **Per polygon (renderHelpers):** Compute face normal; if useFaceNormalsForLighting, use face normal (and optionally single view direction per face) for all vertices of the polygon; else use per-vertex normals. Build Gouraud vertices (diffuse + specular; for textured polys, store diffuse and specular separately so rasterizer can do texture×diffuse + specular). Depth = min vertex z; optional texture from textureMap.
4. **Rasterize:** For each batch, rasterize triangle (Gouraud or Gouraud textured) into framebuffer.

Pipeline: **init() → JSON + textures → Mesh → Scene (cubes + lights) → per frame: frustum cull → camera-space transform → back-face cull → per-vertex/per-face lighting + UVs → depth sort → rasterizeBatches → blit → drawDebugOverlay.**

## Plan completion

This implementation follows [docs/plan.md](docs/plan.md):

- **Phases 1–3:** Flat fill path, color buffer (Framebuffer), triangle rasterization.
- **Phase 4:** Gouraud shading (vertex color interpolation, perspective-correct when invW present).
- **Phases 5–7:** Per-vertex normals (from mesh or face), Phong-style lighting (Lighting.ts), per-vertex lighting with Gouraud; optional useFaceNormalsForLighting and mesh material.
- **Phase 8:** Texture mapping (UVs, loadTexture/loadTexturesForMesh, perspective-correct u/v, (texture × diffuse) + specular).
- **Phase 9:** Demo with test scene (six cubes, directional + point + spot lights), init/utils split, **debug** (InitResult.debug) and **config** (InitResult.config), debug overlay (face normals, vertex normals, FPS, light sources, light directions), and this README.

No z-buffer; visibility is handled by back-face culling and Painter's algorithm only.
