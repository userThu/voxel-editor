import * as THREE from 'three';

// The three possible world axes, used as indices into [x, y, z] arrays
export type Coords = {
    x: number;
    y: number;
    z: number;
};

export type Axis = 0 | 1 | 2; // 0=X, 1=Y, 2=Z

export type FaceDirection = [-1 | 0 | 1, -1 | 0 | 1, -1 | 0 | 1]; // [X,Y,Z] e.g. [1,0,0] for +X

export type SweepAndPlaneAxes = {
  sweepAxis: Axis;  // axis perpendicular to the face — we step along this
  uAxis: Axis;      // first axis of the 2D slice plane
  vAxis: Axis;      // second axis of the 2D slice plane
};

export type RGBColor = [number, number, number];

export type MeshData = {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
};

export const FACES: FaceDirection[] = [
  [1,0,0], // +X
  [-1,0,0], // -X
  [0,1,0], // +Y
  [0,-1,0], // -Y
  [0,0,1], // +Z
  [0,0,-1] // -Z
];

/*
    Given a face direction, returns which world axis to sweep along
    and which two axes form the 2D slice plane.
*/
const getSweepAndPlaneAxes = (dir: FaceDirection): SweepAndPlaneAxes => {
  // Find which axis is non-zero — that's the sweep axis.
  // dir is always one of the 6 unit vectors so exactly one
  // component is non-zero.
  if (dir[0] === 1 || dir[0] === -1) {
    // +X or -X face: sweep along X, slice is Y×Z
    return { sweepAxis: 0, uAxis: 1, vAxis: 2 };
  }
  if (dir[1] === 1 || dir[1] === -1) {
    // +Y or -Y face: sweep along Y, slice is X×Z
    return { sweepAxis: 1, uAxis: 2, vAxis: 0 };
  }
  // +Z or -Z face: sweep along Z, slice is X×Y
  return { sweepAxis: 2, uAxis: 1, vAxis: 0 };
}

/*
    Converts abstract slice coordinates (sweep, u, v) back into concrete world 
    coordinates (x, y, z), offset by the chunk's world position.
*/
const sliceToWorld = (
  axes: SweepAndPlaneAxes,
  sweep: number,     // position along the sweep axis (0 to CHUNK_SIZE-1)
  u: number,         // position along the U axis in the slice
  v: number,         // position along the V axis in the slice
  coriginCoords: Coords, // world coordinates of chunk origin
): Coords => {
  // local position within chunk
  const pos: [number, number, number] = [0, 0, 0];

  pos[axes.sweepAxis] = sweep;
  pos[axes.uAxis] = u;
  pos[axes.vAxis] = v;

  // Add chunk offset to convert from local to world coordinates
  return {
    x: pos[0] + coriginCoords.x,
    y: pos[1] + coriginCoords.y,
    z: pos[2] + coriginCoords.z,
  };
}

/*
    Given the world position of a quad's origin, its face direction, and the 
    width and height of the greedy-merged rectangle, returns the four 3D corner 
    positions of the quad.
*/
const buildQuadCorners = (
  originVoxel: Coords,  // world position of origin voxel
  face: FaceDirection, // face direction e.g. [0,1,0]
  axes: SweepAndPlaneAxes,
  width: number,                        // greedy rect width  (along uAxis)
  height: number                        // greedy rect height (along vAxis)
): [Coords, Coords, Coords, Coords] => {

  // --- Step 1: Face offset ---
  // Positive face directions sit on the far side of the voxel (+1 offset).
  // Negative face directions sit on the near side (no offset).
  
  // face[axes.sweepAxis] = 1 -> faceOffset = 1, face[axes.sweepAxis]=-1 -> 0
  const sweep = axes.sweepAxis;
  const faceOffset = face[axes.sweepAxis] > 0 ? 1 : 0; 

  // Base position of the face on the sweep axis
  const base: [number, number, number] = [originVoxel.x, originVoxel.y, originVoxel.z];
  base[axes.sweepAxis] += faceOffset;

  // --- Step 2: Build the four corners ---
  // Corner layout on the 2D slice plane:
  //
  //   c3 ──── c2
  //   │        │
  //   c0 ──── c1
  //
  // c0 = origin (no offset in U or V)
  // c1 = width along v
  // c2 = width along U + height along V
  // c3 = height along u

  const c0: [number,number,number] = [...base];
  const c1: [number,number,number] = [...base];
  const c2: [number,number,number] = [...base];
  const c3: [number,number,number] = [...base];

  if (sweep === 0) { // X
    c0[axes.vAxis] += width;
    c3[axes.vAxis] += width;
    c2[axes.uAxis] += height;
    c3[axes.uAxis] += height;
  } else if (sweep === 1) { // Y
    c1[axes.vAxis] += width;
    c2[axes.vAxis] += width;
    c0[axes.uAxis] += height;
    c1[axes.uAxis] += height;
  } else { // Z
    c1[axes.vAxis] += width;
    c2[axes.vAxis] += width;
    c2[axes.uAxis] += height;
    c3[axes.uAxis] += height;
  }
  

  // --- Step 3: Winding order ---
  // Positive face direction → counter-clockwise is [c0, c1, c2, c3]
  // Negative face direction → must reverse to maintain counter-clockwise
  //                           winding when viewed from the outside
  //
  // The indices emitted by the mesher are always:
  //   triangle 1: [vi+0, vi+1, vi+2]
  //   triangle 2: [vi+0, vi+2, vi+3]
  //
  // So winding is controlled entirely by the corner order here.

  if (face[axes.sweepAxis] > 0) {
    // counter-clockwise for positive face
    return [
        {x: c0[0], y: c0[1], z: c0[2]}, 
        {x: c1[0], y: c1[1], z: c1[2]}, 
        {x: c2[0], y: c2[1], z: c2[2]}, 
        {x: c3[0], y: c3[1], z: c3[2]}
    ];  
  } else {
    // reversed for negative face
    return [
        {x: c1[0], y: c1[1], z: c1[2]}, 
        {x: c0[0], y: c0[1], z: c0[2]}, 
        {x: c3[0], y: c3[1], z: c3[2]},
        {x: c2[0], y: c2[1], z: c2[2]} 
    ];  
  }
}

const parseColor = (key: string): RGBColor => {
    const colors = key.split(',').map(color_str => Number(color_str));
    return [colors[0], colors[1], colors[2]] as RGBColor;
}

const disposeScene = (scene: THREE.Scene): void => {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      object.material.dispose();
    }
  });
}

export {getSweepAndPlaneAxes, sliceToWorld, buildQuadCorners, parseColor, disposeScene}