import type { Rect } from "@lopaka/game-core";

export function getContainedImageRect(container: DOMRect, imageWidth: number, imageHeight: number): Rect {
  if (imageWidth <= 0 || imageHeight <= 0 || container.width <= 0 || container.height <= 0) {
    return {
      left: container.left,
      top: container.top,
      width: 0,
      height: 0,
    };
  }

  const scale = Math.min(container.width / imageWidth, container.height / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;

  return {
    left: container.left + (container.width - width) / 2,
    top: container.top + (container.height - height) / 2,
    width,
    height,
  };
}
