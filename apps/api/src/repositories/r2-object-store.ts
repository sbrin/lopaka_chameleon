import { decode as decodePng } from "fast-png";

import type { MaskBitmap } from "../services/hit-test-service";

export interface ObjectStore {
  putLevelAsset(kind: "scene" | "mask", levelId: string, file: File): Promise<string>;
  getSceneUrl(objectKey: string): string;
  getMask(objectKey: string): Promise<MaskBitmap>;
}

const decodePngMask = async (body: R2ObjectBody): Promise<MaskBitmap> => {
  const png = decodePng(await body.arrayBuffer());
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

export class R2ObjectStore implements ObjectStore {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly scenePublicBaseUrl: string,
  ) {}

  async putLevelAsset(kind: "scene" | "mask", levelId: string, file: File): Promise<string> {
    const extension = file.type === "image/jpeg" ? "jpg" : "png";
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
