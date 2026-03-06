import * as THREE from 'three';
import { VoxelWorld } from './VoxelWorld';
import { ChunkDimensions, Plane } from './utils';

export type RaycastHit = {
  voxel: [number, number, number]; // grid coords of hit voxel
  face:  [number, number, number]; // normal of the face that was hit
} | null;

const inBounds = (x: number, y: number, z: number, dims: ChunkDimensions): boolean => {
    return x >= 0 && x < dims.x &&
         y >= 0 && y < dims.y &&
         z >= 0 && z < dims.z;
}

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
    const worldSize = world.getWorldSize();
    if (inBounds(x, y, z, worldSize)) {
        // Check current voxel before stepping
        if (world.getVoxel({x:x, y:y, z:z})) {
            return { voxel: [x, y, z], face };
        }
    } else if (
        (stepX > 0 && x >= worldSize.x) || (stepX < 0 && x < 0) ||
        (stepY > 0 && y >= worldSize.y) || (stepY < 0 && y < 0) ||
        (stepZ > 0 && z >= worldSize.z) || (stepZ < 0 && z < 0)
    ) {
        break;
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
  world: VoxelWorld,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  activePlanes: Plane,
): [number, number, number] | null => {

  let closest: [number, number, number] | null = null;
  let closestT = Infinity;
  const worldSize = world.getWorldSize();

  if (activePlanes[0]) {
    const t = -origin.y / direction.y;
    if (t > 0 && t < closestT) {
      const x = Math.floor(origin.x + t * direction.x);
      const z = Math.floor(origin.z + t * direction.z);
      if (inBounds(x, 0, z, worldSize)) {
        closest = [x, 0, z];
        closestT = t;
      }
    }
  }

  if (activePlanes[1]) {
    const t = -origin.z / direction.z;
    if (t > 0 && t < closestT) {
      const x = Math.floor(origin.x + t * direction.x);
      const y = Math.floor(origin.y + t * direction.y);
      if (inBounds(x, y, 0, worldSize)) {
        closest = [x, y, 0];
        closestT = t;
      }
    }
  }

  if (activePlanes[2]) {
    const t = -origin.x / direction.x;
    if (t > 0 && t < closestT) {
      const y = Math.floor(origin.y + t * direction.y);
      const z = Math.floor(origin.z + t * direction.z);
      if (inBounds(0, y, z, worldSize)) {
        closest = [0, y, z];
        closestT = t;
      }
    }
  }

  return closest;
};

export { mouseToNDC, getRayFromCamera, inBounds, dda, rayPlaneIntersection };