import * as THREE from 'three';
import { CHUNK_SIZE, Plane } from './utils';

const HALF = CHUNK_SIZE / 2;
const COLOR_CENTER = 0x888888;
const COLOR_GRID   = 0x444444;

const setupChunkGrids = (scene: THREE.Scene): {
  setVisible: (visible: [boolean, boolean, boolean]) => void;
  dispose: () => void;
} => {
  // XZ plane (floor) — sits at y=0
  const floorGrid = new THREE.GridHelper(CHUNK_SIZE, CHUNK_SIZE, COLOR_CENTER, COLOR_GRID);
  floorGrid.position.set(HALF, 0, HALF);

  // XY plane (front face) — rotate around X, sits at z=0
  const frontGrid = new THREE.GridHelper(CHUNK_SIZE, CHUNK_SIZE, COLOR_CENTER, COLOR_GRID);
  frontGrid.rotation.x = Math.PI / 2;
  frontGrid.position.set(HALF, HALF, 0);

  // YZ plane (side face) — rotate around Z, sits at x=0
  const sideGrid = new THREE.GridHelper(CHUNK_SIZE, CHUNK_SIZE, COLOR_CENTER, COLOR_GRID);
  sideGrid.rotation.z = Math.PI / 2;
  sideGrid.position.set(0, HALF, HALF);

  const grids = [floorGrid, frontGrid, sideGrid];
  grids.forEach(g => scene.add(g));

  return {
    setVisible(visible: [boolean, boolean, boolean]) {
      grids[0].visible = visible[0];
      grids[1].visible = visible[1];
      grids[2].visible = visible[2];
    },
    dispose() {
      grids.forEach(g => {
        g.geometry.dispose();
        (g.material as THREE.Material).dispose();
        scene.remove(g);
      });
    }
  };
}

export {setupChunkGrids};