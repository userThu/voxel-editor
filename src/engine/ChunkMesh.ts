// core/ChunkMesh.ts
import * as THREE from 'three';
import { MeshData } from "../engine/utils"

const material = new THREE.MeshLambertMaterial({
  vertexColors: true,  // use our per-vertex color data
});

function buildChunkMesh(data: MeshData): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position',
    new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal',
    new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color',
    new THREE.BufferAttribute(data.colors, 3));
  geometry.setIndex(
    new THREE.BufferAttribute(data.indices, 1));

  return new THREE.Mesh(geometry, material);
}

// To update an existing chunk mesh without creating a new Three.js object:
function updateChunkMesh(mesh: THREE.Mesh, data: MeshData) {
  const geo = mesh.geometry as THREE.BufferGeometry;
  // position
  (geo.attributes.position as THREE.BufferAttribute).array = data.positions;
  (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  // normal
  (geo.attributes.normal as THREE.BufferAttribute).array = data.normals;
  (geo.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
  // color
  (geo.attributes.color as THREE.BufferAttribute).array = data.colors;
  (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  // index
  (geo.index as THREE.BufferAttribute).array = data.indices;
  (geo.index as THREE.BufferAttribute).needsUpdate = true;
  geo.computeBoundingSphere(); // needed for frustum culling
}

export {buildChunkMesh, updateChunkMesh};