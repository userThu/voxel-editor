import * as THREE from 'three';
import { VoxelWorld } from './VoxelWorld';

export type RaycastHit = {
  voxel: [number, number, number]; // grid coords of hit voxel
  face:  [number, number, number]; // normal of the face that was hit
  // face is always one of the 6 unit vectors:
  // [1,0,0] [-1,0,0] [0,1,0] [0,-1,0] [0,0,1] [0,0,-1]
} | null;

const mouseToNDC = (
  event: MouseEvent,
  canvas: HTMLCanvasElement
): { ndcX: number; ndcY: number } => {
  const rect = canvas.getBoundingClientRect();

  // Mouse position relative to canvas
  const pixelX = event.clientX - rect.left;
  const pixelY = event.clientY - rect.top;

  // Convert to -1..+1 range
  // X: left=-1, right=+1
  // Y: top=+1, bottom=-1  (WebGL Y is flipped vs screen Y)
  const ndcX =  (pixelX / rect.width)  * 2 - 1;
  const ndcY = -(pixelY / rect.height) * 2 + 1;

  return { ndcX, ndcY };
}

const getRayFromCamera = (
  ndcX: number,
  ndcY: number,
  camera: THREE.PerspectiveCamera
): { origin: THREE.Vector3; direction: THREE.Vector3 } => {

  // A point at NDC z=-1 is on the near clipping plane (just in front of camera)
  // Unprojecting it gives the world-space position on the near plane
  // that corresponds to this screen pixel
  const nearPoint = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);

  // A point at NDC z=+1 is on the far clipping plane
  const farPoint  = new THREE.Vector3(ndcX, ndcY,  1).unproject(camera);

  const origin    = camera.position.clone();
  const direction = farPoint.sub(nearPoint).normalize();

  return { origin, direction };
}

const dda = (
  world: VoxelWorld,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  maxDistance: number
): RaycastHit => {

  // Current voxel — floor of origin position
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  // Step direction: which way we move in each axis (+1 or -1)
  const stepX = direction.x >= 0 ? 1 : -1;
  const stepY = direction.y >= 0 ? 1 : -1;
  const stepZ = direction.z >= 0 ? 1 : -1;

  // tDelta: how far along the ray (in t units) we travel
  // to cross one full voxel width in each axis.
  // Infinity when direction component is 0 (ray never crosses that axis)
  const tDeltaX = Math.abs(1 / direction.x);
  const tDeltaY = Math.abs(1 / direction.y);
  const tDeltaZ = Math.abs(1 / direction.z);

  // tMax: how far along the ray until we hit the first boundary
  // in each axis from our starting position
  const tMaxX = stepX > 0
    ? (Math.ceil(origin.x)  - origin.x) * tDeltaX
    : (origin.x - Math.floor(origin.x)) * tDeltaX;
  const tMaxY = stepY > 0
    ? (Math.ceil(origin.y)  - origin.y) * tDeltaY
    : (origin.y - Math.floor(origin.y)) * tDeltaY;
  const tMaxZ = stepZ > 0
    ? (Math.ceil(origin.z)  - origin.z) * tDeltaZ
    : (origin.z - Math.floor(origin.z)) * tDeltaZ;

  let tMaxXCurrent = tMaxX;
  let tMaxYCurrent = tMaxY;
  let tMaxZCurrent = tMaxZ;

  if (isNaN(tMaxXCurrent)) tMaxXCurrent = Infinity;
  if (isNaN(tMaxYCurrent)) tMaxYCurrent = Infinity;
  if (isNaN(tMaxZCurrent)) tMaxZCurrent = Infinity;

  // Face normal of the last crossed boundary.
  // This tells us which face of the hit voxel was entered from.
  let face: [number, number, number] = [0, 0, 0];

  // Step through voxels until we exceed maxDistance
  while (Math.min(tMaxXCurrent, tMaxYCurrent, tMaxZCurrent) < maxDistance) {

    // Check current voxel before stepping
    if (world.getVoxel({x:x, y:y, z:z})) {
      return { voxel: [x, y, z], face };
    }

    // Step to the nearest next boundary
    if (tMaxXCurrent < tMaxYCurrent && tMaxXCurrent < tMaxZCurrent) {
      x += stepX;
      tMaxXCurrent += tDeltaX;
      face = [-stepX, 0, 0]; // entered from the X direction
    } else if (tMaxYCurrent < tMaxZCurrent) {
      y += stepY;
      tMaxYCurrent += tDeltaY;
      face = [0, -stepY, 0];
    } else {
      z += stepZ;
      tMaxZCurrent += tDeltaZ;
      face = [0, 0, -stepZ];
    }
  }

  return null; // no voxel hit within maxDistance
}

const rayPlaneIntersection = (
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  planeY: number = 0
): [number, number, number] | null => {

  // Ray is parallel to the plane — no intersection
  if (Math.abs(direction.y) < 0.0001) return null;

  const t = (planeY - origin.y) / direction.y;

  // Plane is behind the camera
  if (t < 0) return null;

  // World position of intersection
  const x = origin.x + t * direction.x;
  const z = origin.z + t * direction.z;

  // Return the grid cell containing this point
  return [Math.floor(x), 0, Math.floor(z)];
}

const handleRaycastHit = (
  hit: RaycastHit,
  world: VoxelWorld,
  activeColor: [number, number, number],
  action: 'place' | 'remove'
) => {
  if (!hit) return;

  if (action === 'remove') {
    // Remove the voxel that was hit directly
    world.setVoxel({x:hit.voxel[0], y:hit.voxel[1], z:hit.voxel[2]}, null);
  }

  if (action === 'place') {
    // Place adjacent to the hit face using the face normal
    // The face normal points away from the hit voxel toward empty space —
    // exactly where the new voxel should go
    world.setVoxel(
      {
        x: hit.voxel[0] + hit.face[0],
        y: hit.voxel[1] + hit.face[1],
        z: hit.voxel[2] + hit.face[2],
      },
      { color: activeColor, material: 0 }
    );
  }
}

export { mouseToNDC, getRayFromCamera, rayPlaneIntersection, dda, handleRaycastHit };