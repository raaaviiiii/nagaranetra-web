/**
 * Three.js scene (CLAUDE.md §6).
 *
 * Real OSM building footprints and roads for a ~400 m radius around the household,
 * extruded to real heights. Not a stylised diorama, not photorealistic tiles.
 *
 * To be built here:
 *   loader.ts    parse the committed ward geometry from /data into buffer geometry
 *   Scene.tsx    canvas, camera, instanced meshes, LOD, the 1.72 m figure for scale
 *   scrubber.ts  linear time horizon; easing goes on the level, never on the clock
 *
 * Per-hazard visuals live in ../hazards and plug into this scene through one interface.
 */
export {};
