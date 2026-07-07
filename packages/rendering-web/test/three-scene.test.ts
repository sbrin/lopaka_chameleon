import { beforeEach, describe, expect, it, vi } from "vitest";

const loaderCalls: string[] = [];

vi.mock("three", () => {
  class FakeScene {
    readonly children: unknown[] = [];

    add(child: unknown): void {
      this.children.push(child);
    }
  }

  class FakeColor {
    constructor(readonly value: string) {}
  }

  class FakeObject3D {
    readonly position = { sub: vi.fn() };
    readonly rotation = { y: 0 };
    readonly scale = { multiplyScalar: vi.fn() };
    traverse(callback: (child: unknown) => void): void {
      callback(this);
    }
  }

  class FakeBox3 {
    setFromObject(): this {
      return this;
    }

    getCenter(): { x: number; y: number; z: number; multiplyScalar: (value: number) => unknown } {
      return {
        x: 0,
        y: 0,
        z: 0,
        multiplyScalar: vi.fn(),
      };
    }

    getSize(): { x: number; y: number; z: number } {
      return { x: 10, y: 20, z: 30 };
    }
  }

  return {
    AmbientLight: class {
      constructor(readonly color: string, readonly intensity: number) {}
    },
    Box3: FakeBox3,
    Color: FakeColor,
    DirectionalLight: class {
      readonly position = { set: vi.fn() };
      constructor(readonly color: string, readonly intensity: number) {}
    },
    Mesh: FakeObject3D,
    MeshBasicMaterial: class {
      constructor(readonly options: unknown) {}
    },
    MeshStandardMaterial: class {
      constructor(readonly options: unknown) {}
    },
    Object3D: FakeObject3D,
    OrthographicCamera: class {
      readonly position = { set: vi.fn() };
      lookAt(): void {}
    },
    Scene: FakeScene,
    WebGLRenderer: class {
      constructor(readonly options: unknown) {}
      dispose(): void {}
      render(): void {}
      setClearColor(): void {}
      setSize(): void {}
    },
  };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    async loadAsync(src: string): Promise<{ scene: unknown }> {
      loaderCalls.push(src);
      return { scene: {} };
    }
  },
}));

import { renderChameleonScene } from "../src/three-scene";

describe("renderChameleonScene", () => {
  beforeEach(() => {
    loaderCalls.length = 0;
  });

  it("loads the configured GLB model source when a pose model is provided", async () => {
    await renderChameleonScene({
      canvas: makeCanvas(),
      maskCanvas: makeCanvas(),
      poseId: "og-standing",
      modelSrc: "/models/chameleon-mvp.glb",
      rotation: 25,
      color: "#6f8f66",
      fixedDisplayHeightRatio: 0.22,
    });

    expect(loaderCalls).toEqual(["/models/chameleon-mvp.glb"]);
  });
});

function makeCanvas(): HTMLCanvasElement {
  return {
    width: 320,
    height: 180,
    getContext: () => fakeCanvasContext(),
  } as unknown as HTMLCanvasElement;
}

function fakeCanvasContext(): CanvasRenderingContext2D {
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    bezierCurveTo: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}
