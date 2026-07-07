import { decode as decodePng } from "fast-png";

import type { MaskBitmap } from "../services/hit-test-service";

export interface ObjectStore {
  putLevelAsset(kind: "scene" | "mask", levelId: string, file: File): Promise<string>;
  getSceneUrl(objectKey: string): string;
  getMask(objectKey: string): Promise<MaskBitmap>;
}

const decodePngMask = async (body: R2ObjectBody): Promise<MaskBitmap> => {
  return decodePngMaskBytes(await body.arrayBuffer());
};

const decodePngMaskBytes = (bytes: ArrayBuffer): MaskBitmap => {
  let png: ReturnType<typeof decodePng>;
  try {
    png = decodePng(bytes);
  } catch {
    throw new Error("Invalid mask PNG.");
  }

  const { width, height, channels, data } = png;
  const alphaChannelIndex = channels === 4 ? 3 : channels === 2 ? 1 : -1;

  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    !Number.isInteger(height) ||
    height <= 0 ||
    alphaChannelIndex < 0 ||
    data.length < width * height * channels
  ) {
    throw new Error("Invalid mask PNG.");
  }

  return {
    width,
    height,
    alphaAt: (x: number, y: number) => data[(y * width + x) * channels + alphaChannelIndex] ?? 0,
  };
};

export const isSupportedMaskPngFile = async (file: File): Promise<boolean> => {
  try {
    decodePngMaskBytes(await file.arrayBuffer());
    return true;
  } catch {
    return false;
  }
};

const extensionForImage = (file: File): string => {
  switch (file.type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
};

export class R2ObjectStore implements ObjectStore {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly scenePublicBaseUrl: string,
  ) {}

  async putLevelAsset(kind: "scene" | "mask", levelId: string, file: File): Promise<string> {
    const extension = extensionForImage(file);
    const objectKey = `${kind}s/${levelId}.${extension}`;

    await this.bucket.put(objectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    return objectKey;
  }

  getSceneUrl(objectKey: string): string {
    return `${this.scenePublicBaseUrl.replace(/\/+$/, "")}/${objectKey}`;
  }

  async getMask(objectKey: string): Promise<MaskBitmap> {
    const object = await this.bucket.get(objectKey);

    if (!object) {
      throw new Error("Mask object not found.");
    }

    return decodePngMask(object);
  }
}
