import * as THREE from 'three';
import { CHUNK_SIZE, Plane, ChunkDimensions } from './utils';

const VOXELS_PER_CHUNK = 16;
const COLOR_CENTER = 0x888888;
const COLOR_GRID   = 0x444444;

const setupChunkGrids = (scene: THREE.Scene, initialDims: ChunkDimensions = { x: 1, y: 1, z: 1 }) => {
  let grids: THREE.LineSegments[] = [];
  let currentVisible: [boolean, boolean, boolean] = [true, true, true];

  const rebuild = (dims: ChunkDimensions) => {
    grids.forEach(g => {
      g.geometry.dispose();
      (g.material as THREE.Material).dispose();
      scene.remove(g);
    });
    grids = [];

    // World-space dimensions
    const wx = dims.x * VOXELS_PER_CHUNK;
    const wy = dims.y * VOXELS_PER_CHUNK;
    const wz = dims.z * VOXELS_PER_CHUNK;

    // XZ — floor, spans wx × wz, sits at y=0
    // grid lines in X and Z directions, no rotation needed
    const xzPoints: number[] = [];
    for (let i = 0; i <= dims.z * VOXELS_PER_CHUNK; i++) {
      xzPoints.push(0, 0, i,  wx, 0, i);
    }
    for (let i = 0; i <= dims.x * VOXELS_PER_CHUNK; i++) {
      xzPoints.push(i, 0, 0,  i, 0, wz);
    }
    const xzGeo = new THREE.BufferGeometry();
    xzGeo.setAttribute('position', new THREE.Float32BufferAttribute(xzPoints, 3));
    const xzGrid = new THREE.LineSegments(xzGeo, new THREE.LineBasicMaterial({ color: COLOR_GRID }));

    // XY — front face, spans wx × wy, sits at z=0
    const xyPoints: number[] = [];
    for (let i = 0; i <= wy; i++) {
      xyPoints.push(0, i, 0,  wx, i, 0);
    }
    for (let i = 0; i <= wx; i++) {
      xyPoints.push(i, 0, 0,  i, wy, 0);
    }
    const xyGeo = new THREE.BufferGeometry();
    xyGeo.setAttribute('position', new THREE.Float32BufferAttribute(xyPoints, 3));
    const xyGrid = new THREE.LineSegments(xyGeo, new THREE.LineBasicMaterial({ color: COLOR_GRID }));

    // YZ — side face, spans wz × wy, sits at x=0
    const yzPoints: number[] = [];
    for (let i = 0; i <= wy; i++) {
      yzPoints.push(0, i, 0,  0, i, wz);
    }
    for (let i = 0; i <= wz; i++) {
      yzPoints.push(0, 0, i,  0, wy, i);
    }
    const yzGeo = new THREE.BufferGeometry();
    yzGeo.setAttribute('position', new THREE.Float32BufferAttribute(yzPoints, 3));
    const yzGrid = new THREE.LineSegments(yzGeo, new THREE.LineBasicMaterial({ color: COLOR_GRID }));

    grids = [xzGrid, xyGrid, yzGrid];
    grids.forEach((g, i) => {
      g.visible = currentVisible[i]; // respect current visibility
      scene.add(g);
    });
  };

  rebuild(initialDims);

  return {
    setVisible(visible: [boolean, boolean, boolean]) {
      currentVisible = visible;
      grids.forEach((g, i) => g.visible = visible[i]);
    },
    resize(dims: ChunkDimensions) {
      rebuild(dims);
    },
    dispose() {
      grids.forEach(g => {
        g.geometry.dispose();
        (g.material as THREE.Material).dispose();
        scene.remove(g);
      });
    }
  };
};

export {setupChunkGrids};