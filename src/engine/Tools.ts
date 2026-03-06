

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VoxelWorld } from './VoxelWorld';
import { Tool } from './utils';
import { dda, getRayFromCamera, RaycastHit, mouseToNDC, rayPlaneIntersection, inBounds } from './Raycasting';

const faceRotations: Record<string, [number, number, number]> = {
    "0,1,0":  [- Math.PI / 2, 0, 0], // top
    "0,-1,0": [  Math.PI / 2, 0, 0], // bottom
    "1,0,0":  [0,   Math.PI / 2, 0], // right
    "-1,0,0": [0, - Math.PI / 2, 0], // left
    "0,0,1":  [0, 0, 0],             // front
    "0,0,-1": [0,   Math.PI, 0],     // back
  };

const updateCursor = (canvas: HTMLCanvasElement, tool: Tool): void => {
  const cursors: Record<Tool, string> = {
    move:  'grab',
    place:  'crosshair',
    remove: 'cell',
  };
  canvas.style.cursor = cursors[tool];
}

// Handles mouse click and move events when the active tool is not move
function setupMouseEvents(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  world: VoxelWorld,
  activeToolRef: React.RefObject<Tool>,
  activeColorRef: React.RefObject<[number, number, number]>,
  hoverHighlight: ReturnType<typeof setupHoverHighlight>
): () => void {

  const onMouseDown = (e: MouseEvent) => {
    // Move tool — OrbitControls handles this entirely, do nothing
    if (activeToolRef.current === 'move') return;
    if (e.button !== 0) return; // Only respond to left click

    const { ndcX, ndcY } = mouseToNDC(e, canvas);
    const { origin, direction } = getRayFromCamera(ndcX, ndcY, camera);

    if (activeToolRef.current === 'place') {
      const hit = dda(world, origin, direction, 50);
      if (hit) {
        const px = hit.voxel[0] + hit.face[0];
        const py = hit.voxel[1] + hit.face[1];
        const pz = hit.voxel[2] + hit.face[2];
        if (inBounds(px, py, pz)) {
            world.setVoxel({ x: px, y: py, z: pz }, { color: activeColorRef.current, material: 0 });
        }
      } else {
        const groundPos = rayPlaneIntersection(origin, direction, 0);
        if (groundPos) {
          world.setVoxel(
          {x:groundPos[0],
          y:groundPos[1],
          z:groundPos[2]},
          { color: activeColorRef.current, material: 0 }
          );
        }
      }
      
    }

    if (activeToolRef.current === 'remove') {
      const hit = dda(world, origin, direction, 50);
      if (hit) {
        world.setVoxel({x:hit.voxel[0], y:hit.voxel[1], z:hit.voxel[2]}, null);
      }
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    // Hover highlight only visible during draw or erase
    if (activeToolRef.current === 'move') {
      hoverHighlight.update(null, null, null);
      return;
    }

    const { ndcX, ndcY } = mouseToNDC(e, canvas);
    const { origin, direction } = getRayFromCamera(ndcX, ndcY, camera);
    const hit = dda(world, origin, direction, 50);
    const groundPos = rayPlaneIntersection(origin, direction, 0);

    hoverHighlight.update(hit, groundPos, activeColorRef.current);
  };

  const onContextMenu = (e: Event) => e.preventDefault();

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('contextmenu', onContextMenu);

  // Return cleanup function
  return () => {
    canvas.removeEventListener('mousedown', onMouseDown);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };
}

function setupHoverHighlight(scene: THREE.Scene): {
  update: (hit: RaycastHit, groundPos: [number, number, number] | null, color: [number, number, number] | null) => void;
  dispose: () => void;
} {
  const ghostGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.15,
    depthTest: true,
    side: THREE.FrontSide,
  });
  const ghostBlock = new THREE.Mesh(ghostGeo, ghostMat);
  ghostBlock.visible = false;
  scene.add(ghostBlock);

  const faceGeo = new THREE.PlaneGeometry(1.01, 1.01);
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.4,
    depthTest: false,
    side: THREE.FrontSide,
  });
  const faceHighlight = new THREE.Mesh(faceGeo, faceMat);
  faceHighlight.visible = false;
  scene.add(faceHighlight);

  return {
    update(
        hit: RaycastHit, 
        groundPos: [number, number, number] | null, 
        color: [number, number, number] | null
    ) {
      if (hit) {
        // Show face highlight on the struck face, hide ghost
        ghostBlock.visible = false;
        faceHighlight.visible = true;

        const [vx, vy, vz] = hit.voxel;
        const [nx, ny, nz] = hit.face;

        // Center the quad on the hit face
        faceHighlight.position.set(
          vx + 0.5 + nx * 0.501, // offset slightly off the surface to avoid z-fighting
          vy + 0.5 + ny * 0.501,
          vz + 0.5 + nz * 0.501,
        );

        const key = `${nx},${ny},${nz}`;
        const rot = faceRotations[key] ?? [0, 0, 0];
        faceHighlight.rotation.set(...rot);
      } else if (groundPos) {
        faceHighlight.visible = false;
        ghostBlock.visible = true;
        ghostBlock.position.set(
          groundPos[0] + 0.5,
          groundPos[1] + 0.5,
          groundPos[2] + 0.5,
        );
        if (color) {
          ghostMat.color.setRGB(...color);
        }
      } else {
        ghostBlock.visible = false;
        faceHighlight.visible = false;
      }
    },
    dispose() {
      ghostGeo.dispose();
      ghostMat.dispose();
      faceGeo.dispose();
      faceMat.dispose();
      scene.remove(ghostBlock);
      scene.remove(faceHighlight);
    }
  };
}

export { setupMouseEvents, setupHoverHighlight, updateCursor };