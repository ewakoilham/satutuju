/**
 * Browser-side image compression for upload paths that hit Vercel's 4.5 MB
 * request body cap. Resizes the longest edge to `maxEdge` and re-encodes as
 * JPEG at the given quality. Returns the original `file` untouched if it's
 * already small enough OR if it's not a raster image.
 */

const RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; targetMaxBytes?: number } = {},
): Promise<File> {
  const maxEdge = opts.maxEdge ?? 2400;
  const quality = opts.quality ?? 0.88;
  const targetMaxBytes = opts.targetMaxBytes ?? 4 * 1024 * 1024; // ~4 MB

  // Skip non-raster types and already-small files
  if (!RASTER_TYPES.has(file.type)) return file;
  if (file.size <= targetMaxBytes) return file;
  if (typeof document === "undefined") return file;

  const bitmap = await loadImageBitmap(file);
  const { width: srcW, height: srcH } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  // Step the quality down once if we still aren't under target
  if (blob.size > targetMaxBytes) {
    const fallback = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", Math.max(0.6, quality - 0.18)),
    );
    if (fallback && fallback.size < blob.size) {
      return new File([fallback], swapExtension(file.name, "jpg"), {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
  }

  return new File([blob], swapExtension(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap is widely supported and ~10× faster than <img> + canvas.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  // Fallback: <img> path
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function swapExtension(name: string, ext: string): string {
  return name.replace(/\.[^./\\]+$/, "") + "." + ext;
}
