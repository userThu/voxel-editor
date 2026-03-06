// core/ChunkMesh.ts
import * as THREE from 'three';
import { MeshData } from "../engine/utils"

const material = new THREE.MeshLambertMaterial({
  vertexColors: true,  // use our per-vertex color data
});

function buildChunkMesh(
  scene: THREE.Scene,
  chunkMeshes: Map<string, THREE.Mesh>,
  chunkKey: string,
  data: MeshData,
) {
  // Remove and dispose existing mesh if present
  if (chunkMeshes.has(chunkKey)) {
    const existing = chunkMeshes.get(chunkKey)!;
    existing.geometry.dispose();
    scene.remove(existing);
    // Do not dispose material — it is shared across all chunks
    chunkMeshes.delete(chunkKey);
  }

  // Empty chunk — no mesh needed
  if (data.vertexCount === 0) return;

  // Build fresh geometry at the correct size
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal',
    new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color',
    new THREE.BufferAttribute(data.colors, 3));
  geometry.setIndex(
    new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  chunkMeshes.set(chunkKey, mesh);
}

export {buildChunkMesh};