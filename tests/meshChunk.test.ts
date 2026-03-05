import { VoxelWorld, VoxelData } from '@/engine/VoxelWorld';
import { meshChunk }  from '@/engine/ChunkMesher';
import { MeshData } from '@/engine/utils';

const RED:   VoxelData = { color: [255, 0,   0  ], material: 0 };
const GREEN: VoxelData = { color: [0,   255, 0  ], material: 0 };
const BLUE:  VoxelData = { color: [0,   0,   255], material: 0 };

const originChunkCoords = { x: 0, y: 0, z: 0 };
const originGlobalCoords = { x: 0, y: 0, z: 0 };

// ── Helpers ──────────────────────────────────────────────────────────────────

function countQuads(data: MeshData): number {
  // Every quad = 4 vertices. vertexCount / 4 = quad count.
  return data.vertexCount / 4;
}

function countTris(data: MeshData): number {
  // Every triangle = 3 indices. indexCount / 3 = triangle count.
  return data.indices.length / 3;
}

function printResult(label: string, data: MeshData, expected: {
  quads?: number;
  tris?:  number;
  verts?: number;
}) {
  const quads = countQuads(data);
  const tris  = countTris(data);
  const verts = data.vertexCount;

  const quadPass  = expected.quads === undefined || quads === expected.quads;
  const trisPass  = expected.tris  === undefined || tris  === expected.tris;
  const vertsPass = expected.verts === undefined || verts === expected.verts;
  const pass = quadPass && trisPass && vertsPass;

  console.log(`\n──────────────────────────────────`);
  console.log(`Test: ${label}`);
  console.log(`  Vertices : ${verts}${expected.verts !== undefined ? `  (expected ${expected.verts}) ${vertsPass ? '✓' : '✗'}` : ''}`);
  console.log(`  Quads    : ${quads}${expected.quads !== undefined ? `  (expected ${expected.quads}) ${quadPass  ? '✓' : '✗'}` : ''}`);
  console.log(`  Triangles: ${tris}${expected.tris  !== undefined ? `  (expected ${expected.tris})  ${trisPass  ? '✓' : '✗'}` : ''}`);
  console.log(`  Result   : ${pass ? 'PASS ✓' : 'FAIL ✗'}`);
}

function testEmptyChunk() {
  const world = new VoxelWorld();
  // No voxels added — world is entirely empty

  const data = meshChunk(world, originChunkCoords);

  printResult('Empty chunk — no geometry', data, {
    verts: 0,
    quads: 0,
    tris:  0,
  });

  // A vertexCount of 0 is also used by the chunk lifecycle
  // to decide whether to remove the mesh from the scene.
  // This verifies that path works correctly.
}

function testSingleVoxel() {
  const world = new VoxelWorld();
  world.setVoxel(originGlobalCoords, RED);

  const data = meshChunk(world, originChunkCoords);

  printResult('Single voxel — 6 exposed faces', data, {
    verts: 24,   // 6 faces × 4 vertices
    quads: 6,    // 6 faces × 1 quad each
    tris:  12,   // 6 faces × 2 triangles
  });
}

function testTwoAdjacentVoxels() {
  const world = new VoxelWorld();
  world.setVoxel(originGlobalCoords, RED);
  world.setVoxel({x:1, y:0, z:0}, RED);

  // Each voxel has 6 faces = 12 total
  // Shared face between them = 2 faces culled (one each side)
  // Remaining: 10 exposed faces

  const data = meshChunk(world, originChunkCoords);

  printResult('Two adjacent same-color voxels — 6 quads after greedy merge', data, {
    quads: 6,
    verts: 24,
    tris:  12,
  });
}

function testTwoSeparatedVoxels() {
  const world = new VoxelWorld();
  world.setVoxel(originGlobalCoords, RED);
  world.setVoxel({x:2, y:0, z:0}, RED); // gap of 1 empty voxel between them

  const data = meshChunk(world, originChunkCoords);

  // 12 exposed faces — no culling since voxels don't touch.
  // Greedy merging: the gap between the two voxels breaks any
  // potential merge on +Y, -Y, +Z, -Z — the mask has an empty
  // cell between the two same-color faces so expansion stops.
  // Every face stays as its own quad.
  //   +X caps: 2 quads
  //   -X caps: 2 quads
  //   +Y:      2 quads (gap prevents merge)
  //   -Y:      2 quads
  //   +Z:      2 quads
  //   -Z:      2 quads
  //   Total:   12 exposed faces → 12 quads

  printResult('Two separated voxels — gap prevents greedy merge, 12 quads', data, {
    quads: 12,
    verts: 48,
    tris:  24,
  });
}

function testGreedyMerge2x2() {
  const world = new VoxelWorld();
  world.setVoxel(originGlobalCoords, RED);
  world.setVoxel({x:1, y:0, z:0}, RED);
  world.setVoxel({x:0, y:0, z:1}, RED);
  world.setVoxel({x:1, y:0, z:1}, RED);

  const data = meshChunk(world, originChunkCoords);

  // Top face (+Y):    1 merged 2×2 quad
  // Bottom face (-Y): 1 merged 2×2 quad
  // +X side:          1 merged 1×2 quad (two voxels tall in Z)
  // -X side:          1 merged 1×2 quad
  // +Z side:          1 merged 2×1 quad
  // -Z side:          1 merged 2×1 quad
  // Total:            6 quads

  printResult('2×2 flat plane — greedy merges top/bottom into 1 quad each', data, {
    quads: 6,
    verts: 24,
    tris:  12,
  });
}

function testGreedyMerge4x1Row() {
  const world = new VoxelWorld();
  for (let x = 0; x < 4; x++) {
    world.setVoxel({x: x, y: 0, z: 0}, GREEN);
  }

  const data = meshChunk(world, originChunkCoords);

  // +Y: 1 merged 4×1 quad
  // -Y: 1 merged 4×1 quad
  // +Z: 1 merged 4×1 quad
  // -Z: 1 merged 4×1 quad
  // +X: 1 end cap quad
  // -X: 1 end cap quad
  // Total: 6 quads

  printResult('4×1 row — 4 faces merge to single quads, 2 end caps', data, {
    quads: 6,
    verts: 24,
    tris:  12,
  });
}

function testAdjacentDifferentColors() {
  const world = new VoxelWorld();
  world.setVoxel(originGlobalCoords, RED);
  world.setVoxel({x:1, y:0, z:0}, BLUE);

  const data = meshChunk(world, originChunkCoords);

  // 10 exposed faces after culling the shared interior pair.
  // Greedy merging: coplanar faces on +Y, -Y, +Z, -Z are adjacent
  // but have different colors — the mask key differs so expansion
  // stops at the color boundary. No merging occurs.
  //   +X cap:  1 quad
  //   -X cap:  1 quad
  //   +Y:      2 quads (RED and BLUE cannot merge)
  //   -Y:      2 quads
  //   +Z:      2 quads
  //   -Z:      2 quads
  //   Total:   10 exposed faces → 10 quads

  printResult('Adjacent different-color voxels — color boundary prevents merge, 10 quads', data, {
    quads: 10,
    verts: 40,
    tris:  20,
  });
}

function testSolid2x2x2Cube() {
  const world = new VoxelWorld();
  for (let x = 0; x < 2; x++)
  for (let y = 0; y < 2; y++)
  for (let z = 0; z < 2; z++)
    world.setVoxel({x: x, y:y, z:z}, GREEN);

  const data = meshChunk(world, originChunkCoords);

  // 8 voxels × 6 faces = 48 total faces
  // Interior shared faces:
  //   X direction: 1 shared plane of 2×2 = 4 face pairs = 8 faces culled
  //   Y direction: 8 faces culled
  //   Z direction: 8 faces culled
  //   Total culled: 24
  // Remaining: 24 exposed faces
  // After greedy merge: 6 sides × 1 merged 2×2 quad = 6 quads

  printResult('Solid 2×2×2 cube — 24 interior faces culled, 6 merged outer quads', data, {
    quads: 6,
    verts: 24,
    tris:  12,
  });
}

function testVoxelOnChunkBorder() {
  const world = new VoxelWorld();
  world.setVoxel({x:15, y:15, z:15}, RED); // corner of chunk (0,0,0)

  const data = meshChunk(world, originChunkCoords);

  // Isolated voxel — all 6 faces exposed
  // Neighbors outside this chunk are empty (no chunk exists there)
  // Should behave identically to Test 2

  printResult('Voxel on chunk border — all 6 faces exposed', data, {
    quads: 6,
    verts: 24,
    tris:  12,
  });
}

function testCrossBoundaryFaceCulling() {
  const world = new VoxelWorld();
  world.setVoxel({x:15, y:0, z:0}, RED);  // rightmost voxel of chunk (0,0,0)
  world.setVoxel({x:16, y:0, z:0}, RED);  // leftmost  voxel of chunk (1,0,0)

  // Mesh both chunks
  const dataA = meshChunk(world, originChunkCoords); // chunk containing x=15
  const dataB = meshChunk(world, {x:1, y:0, z:0}); // chunk containing x=16

  // Each voxel is otherwise isolated — 5 exposed faces each
  // The shared face between x=15 (+X) and x=16 (-X) must be culled

  printResult('Cross-chunk voxel A (x=15) — +X face culled by neighbor', dataA, {
    quads: 5,   // 6 - 1 culled +X face
    verts: 20,
    tris:  10,
  });

  printResult('Cross-chunk voxel B (x=16) — -X face culled by neighbor', dataB, {
    quads: 5,   // 6 - 1 culled -X face
    verts: 20,
    tris:  10,
  });
}

function runAllTests() {
  console.log('═══════════════════════════════════');
  console.log('  meshChunk() Print Tests');
  console.log('═══════════════════════════════════');

  testEmptyChunk();
  testSingleVoxel();
  testTwoAdjacentVoxels();
  testTwoSeparatedVoxels();
  testGreedyMerge2x2();
  testGreedyMerge4x1Row();
  testAdjacentDifferentColors();
  testSolid2x2x2Cube();
  testVoxelOnChunkBorder();
  testCrossBoundaryFaceCulling();

  console.log('\n═══════════════════════════════════\n');
}

runAllTests();