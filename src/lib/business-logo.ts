import sharp from "sharp";

export const MAX_BUSINESS_LOGO_BYTES = 512 * 1024;
export const MAX_BUSINESS_LOGO_PIXELS = 40_000_000;
const MAX_BUSINESS_LOGO_DIMENSION = 2048;

export class LogoInputError extends Error {}

export async function optimizeBusinessLogo(input: Buffer): Promise<{ bytes: Buffer; mimeType: string }> {
  const image = sharp(input, {
    limitInputPixels: MAX_BUSINESS_LOGO_PIXELS,
    failOn: "warning",
  });
  let metadata: Awaited<ReturnType<typeof image.metadata>>;
  try {
    metadata = await image.metadata();
  } catch (error) {
    if (error instanceof Error && error.message === "Input image exceeds pixel limit") {
      throw new LogoInputError("This image is too large to process. Choose an image with fewer than 40 million pixels.");
    }
    throw error;
  }

  if (metadata.format !== "png" && metadata.format !== "jpeg") {
    throw new LogoInputError("Upload a valid PNG, JPG, or JPEG logo.");
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_BUSINESS_LOGO_PIXELS) {
    throw new LogoInputError("This image is too large to process. Choose an image with fewer than 40 million pixels.");
  }
  if (metadata.pages && metadata.pages > 1) {
    throw new LogoInputError("Animated or multi-page images are not supported. Choose a PNG or JPEG logo.");
  }

  const initialScale = Math.min(
    1,
    MAX_BUSINESS_LOGO_DIMENSION / metadata.width,
    MAX_BUSINESS_LOGO_DIMENSION / metadata.height,
  );
  const mimeType = metadata.format === "png" ? "image/png" : "image/jpeg";

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const scale = initialScale * Math.pow(0.82, attempt);
    const width = Math.max(1, Math.floor(metadata.width * scale));
    const height = Math.max(1, Math.floor(metadata.height * scale));
    let pipeline = sharp(input, {
      limitInputPixels: MAX_BUSINESS_LOGO_PIXELS,
      failOn: "warning",
    })
      .rotate()
      .resize({ width, height, fit: "inside", withoutEnlargement: true });

    if (metadata.format === "png") {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 });
    } else {
      pipeline = pipeline.jpeg({ quality: Math.max(55, 88 - attempt * 3), mozjpeg: true, progressive: true });
    }

    const bytes = await pipeline.toBuffer();
    if (bytes.byteLength <= MAX_BUSINESS_LOGO_BYTES) return { bytes, mimeType };
  }

  throw new LogoInputError("This logo could not be optimized to 512 KB. Try a simpler or smaller image.");
}
