export type PoseAsset = {
  id: string;
  name: string;
  modelSrc: string;
  defaultRotation: number;
  fixedDisplayHeightRatio: number;
};

export const poses: PoseAsset[] = [
  {
    id: "og-standing",
    name: "Standing",
    modelSrc: "/models/chameleon-mvp.glb",
    defaultRotation: 0,
    fixedDisplayHeightRatio: 0.22,
  },
];
