# Chameleon Models

Runtime model assets for Lopaka Chameleon.

## MVP Asset

- Runtime path: `/models/chameleon-mvp.glb`
- Source page: <https://makerworld.com/en/models/2947243-meccha-chameleon-characters-all-og-poses-no-ai#profileId-3331505>
- Source download location on the project owner's machine: `/Users/sun/Downloads/AllPoses_stls`
- Selected source file: `obj_2_Pose01.step.stl`
- Converted file: `chameleon-mvp.glb`
- Runtime pose id: `og-standing`

Downloaded source files:

- `obj_1_Pose04.step.stl`
- `obj_2_Pose01.step.stl`
- `obj_3_Pose03.step.stl`
- `obj_4_Pose02.step.stl`
- `obj_5_Pose05.step.stl`
- `obj_6_Pose06.step.stl`
- `obj_7_Pose07.step.stl`
- `obj_8_Pose08_blender.stl`

The source STL files are not committed here. The committed runtime asset was converted from the selected STL with:

```bash
assimp export /Users/sun/Downloads/AllPoses_stls/obj_2_Pose01.step.stl apps/web/public/models/chameleon-mvp.glb
```

The app keeps working with the built-in shaded silhouette renderer until a later renderer task loads the GLB model directly.
