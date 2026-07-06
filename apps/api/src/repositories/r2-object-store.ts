import type { MaskBitmap } from "../services/hit-test-service";

export interface ObjectStore {
  putLevelAsset(kind: "scene" | "mask", levelId: string, file: File): Promise<string>;
  getSceneUrl(objectKey: string): string;
  getMask(objectKey: string): Promise<MaskBitmap>;
}

type JsonMask = {
  width: number;
  height: number;
  alpha: number[];
};

const parseJsonMask = async (body: R2ObjectBody): Promise<MaskBitmap> => {
  const mask = (await body.json()) as JsonMask;

  if (
    !Number.isInteger(mask.width) ||
    mask.width <= 0 ||
    !Number.isInteger(mask.height) ||
    mask.height <= 0 ||
    !Array.isArray(mask.alpha) ||
    mask.alpha.length !== mask.width * mask.height
  ) {
    throw new Error("Invalid mask object.");
  }

  return {
    width: mask.width,
    height: mask.height,
    alphaAt: (x: number, y: number) => mask.alpha[y * mask.width + x] ?? 0,
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

    return parseJsonMask(object);
  }
}
