import { mapRenderedPointToImagePoint, type ImagePoint, type Rect } from "@lopaka/game-core";
import { describe, expect, it } from "vitest";

import { getContainedImageRect } from "../src/play/image-coordinates";

const IMAGE_WIDTH = 1280;
const IMAGE_HEIGHT = 720;

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function mapContainedClick(clientX: number, clientY: number, container: DOMRect): ImagePoint | null {
  const renderedRect = getContainedImageRect(container, IMAGE_WIDTH, IMAGE_HEIGHT);
  if (
    clientX < renderedRect.left ||
    clientX > renderedRect.left + renderedRect.width ||
    clientY < renderedRect.top ||
    clientY > renderedRect.top + renderedRect.height
  ) {
    return null;
  }

  return mapRenderedPointToImagePoint({
    clientX,
    clientY,
    renderedRect,
    imageSize: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
  });
}

describe("getContainedImageRect", () => {
  it("maps clicks in a square container to original image coordinates", () => {
    const container = domRect(10, 20, 1000, 1000);

    expect(getContainedImageRect(container, IMAGE_WIDTH, IMAGE_HEIGHT)).toEqual<Rect>({
      left: 10,
      top: 238.75,
      width: 1000,
      height: 562.5,
    });
    expect(mapContainedClick(260, 379.375, container)).toEqual({ x: 320, y: 180 });
  });

  it("maps clicks in a wide container to original image coordinates", () => {
    const container = domRect(100, 50, 1600, 720);

    expect(getContainedImageRect(container, IMAGE_WIDTH, IMAGE_HEIGHT)).toEqual<Rect>({
      left: 260,
      top: 50,
      width: 1280,
      height: 720,
    });
    expect(mapContainedClick(900, 410, container)).toEqual({ x: 640, y: 360 });
  });

  it("ignores clicks in object-fit contain letterbox areas", () => {
    const squareContainer = domRect(10, 20, 1000, 1000);
    const wideContainer = domRect(100, 50, 1600, 720);

    expect(mapContainedClick(500, 100, squareContainer)).toBeNull();
    expect(mapContainedClick(150, 410, wideContainer)).toBeNull();
  });
});
