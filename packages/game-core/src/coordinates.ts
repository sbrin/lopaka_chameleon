export type ImageSize = { width: number; height: number };
export type Rect = { left: number; top: number; width: number; height: number };
export type ImagePoint = { x: number; y: number };

export type RenderedPointInput = {
  clientX: number;
  clientY: number;
  renderedRect: Rect;
  imageSize: ImageSize;
};

export function mapRenderedPointToImagePoint(
  input: RenderedPointInput,
): ImagePoint {
  const xRatio =
    (input.clientX - input.renderedRect.left) / input.renderedRect.width;
  const yRatio =
    (input.clientY - input.renderedRect.top) / input.renderedRect.height;

  return {
    x: Math.round(xRatio * input.imageSize.width),
    y: Math.round(yRatio * input.imageSize.height),
  };
}
