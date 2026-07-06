export type BackgroundAsset = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
};

export const backgrounds: BackgroundAsset[] = [
  {
    id: "studio-desk",
    name: "Studio Desk",
    src: "/backgrounds/studio-desk.svg",
    width: 1280,
    height: 720,
  },
  {
    id: "garden-path",
    name: "Garden Path",
    src: "/backgrounds/garden-path.svg",
    width: 1280,
    height: 720,
  },
];
