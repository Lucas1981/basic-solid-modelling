/**
 * Load a texture image from URL and return ImageData for sampling.
 * Resolves url relative to baseUrl when baseUrl is provided.
 */
export async function loadTexture(
  url: string,
  baseUrl?: string,
): Promise<ImageData> {
  const resolved = baseUrl ? resolveUrl(baseUrl, url) : url;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D context for texture"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = () => reject(new Error(`Failed to load texture: ${resolved}`));
    img.src = resolved;
  });
}

/** Resolve relative url against base (e.g. base = "./assets/cube.json" -> dir = "./assets/", url "cat.jpg" -> "./assets/cat.jpg"). */
function resolveUrl(base: string, url: string): string {
  if (url.startsWith("/") || url.startsWith("http")) return url;
  const lastSlash = base.lastIndexOf("/");
  const dir = lastSlash >= 0 ? base.slice(0, lastSlash + 1) : "";
  return dir + url;
}

/**
 * Load all unique textures referenced by mesh polygons.
 * Returns Map keyed by textureUrl (as in JSON) -> ImageData.
 */
export async function loadTexturesForMesh(
  meshData: { polygons: Array<{ textureUrl?: string }> },
  meshBaseUrl: string,
): Promise<Map<string, ImageData>> {
  const urls = new Set<string>();
  for (const p of meshData.polygons) {
    if (p.textureUrl) urls.add(p.textureUrl);
  }
  const map = new Map<string, ImageData>();
  for (const url of urls) {
    const imageData = await loadTexture(url, meshBaseUrl);
    map.set(url, imageData);
  }
  return map;
}
