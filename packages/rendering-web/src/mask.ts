export function createBinaryMaskFromAlpha(source: ImageData, alphaThreshold: number): ImageData {
  const maskData = new Uint8ClampedArray(source.data.length);

  for (let index = 0; index < source.data.length; index += 4) {
    const alpha = source.data[index + 3] ?? 0;

    if (alpha >= alphaThreshold) {
      maskData[index] = 255;
      maskData[index + 1] = 255;
      maskData[index + 2] = 255;
      maskData[index + 3] = 255;
    }
  }

  return new ImageData(maskData, source.width, source.height);
}
