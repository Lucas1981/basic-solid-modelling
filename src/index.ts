// Entry point for the 3D solid modeling engine (Phase 8: texture mapping)
import { init } from "./init";
import { projectSceneToFilledPolygons } from "./core/renderHelpers";
import { drawDebugOverlay, rasterizeBatches } from "./utils";

async function main() {
  const result = await init();
  if (!result) return;

  const {
    canvas,
    viewport,
    aspect,
    scene,
    framebuffer,
    textureMap,
    camera,
    input,
    cameraState,
    debug,
    config,
  } = result;

  let lastTime = performance.now();

  function render(currentTime: number) {
    framebuffer.clear("#000000");

    const now = currentTime;
    const deltaTime = (now - lastTime) / 1000;
    lastTime = now;

    const updated = input.updateCamera(
      cameraState.yaw,
      cameraState.pitch,
      camera,
      deltaTime
    );
    cameraState.yaw = updated.yaw;
    cameraState.pitch = updated.pitch;

    const angle = (now / 1000) * ((Math.PI * 2) / 4);
    for (const object of scene.objects) {
      object.rotation.y = angle;
    }

    const view = camera.getViewMatrix();
    const projection = camera.getProjectionMatrix(aspect);
    const viewProj = projection.multiply(view);

    const { batches, debugNormalSegments, debugVertexNormalSegments } =
      projectSceneToFilledPolygons(scene, viewProj, viewport, {
        debugShowFaceNormals: debug.showFaceNormals,
        debugShowVertexNormals: debug.showVertexNormals,
        applyPaintersAlgorithm: config.applyPaintersAlgorithm,
        applyBackFaceCulling: config.applyBackFaceCulling,
        textureMap,
      });
    rasterizeBatches(framebuffer, batches);

    canvas.blit(framebuffer);
    drawDebugOverlay(
      canvas,
      scene,
      view,
      projection,
      viewport,
      debugNormalSegments,
      debugVertexNormalSegments,
      deltaTime,
      debug
    );

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
