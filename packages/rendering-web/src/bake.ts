export type BakeSceneInput = {
  backgroundCanvas: HTMLCanvasElement;
  chameleonCanvas: HTMLCanvasElement;
  maskCanvas: HTMLCanvasElement;
  imageWidth: number;
  imageHeight: number;
};

export type BakedLevel = {
  sceneBlob: Blob;
  maskBlob: Blob;
  imageWidth: number;
  imageHeight: number;
};

export async function bakeScene(input: BakeSceneInput): Promise<BakedLevel> {
  const sceneCanvas = document.createElement("canvas");
  sceneCanvas.width = input.imageWidth;
  sceneCanvas.height = input.imageHeight;

  const ctx = sceneCanvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is unavailable.");

  ctx.drawImage(input.backgroundCanvas, 0, 0);
  ctx.drawImage(input.chameleonCanvas, 0, 0);

  const sceneBlob = await canvasToBlob(sceneCanvas, "image/webp", 0.9);
  const maskBlob = await canvasToBlob(input.maskCanvas, "image/png");

  return {
    sceneBlob,
    maskBlob,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error(`Unable to encode ${type}.`));
      }
    }, type, quality);
  });
}
