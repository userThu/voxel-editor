import { umask } from "process";
import {VoxelWorld, CHUNK_SIZE} from "./VoxelWorld";
import {Coords, parseColor, MeshData, FACES, getSweepAndPlaneAxes, sliceToWorld, buildQuadCorners} from "./utils";

export const meshChunk = (world: VoxelWorld, chunkCoords: Coords): MeshData => {
  const coriginCoords = {
    x: chunkCoords.x * CHUNK_SIZE,
    y: chunkCoords.y * CHUNK_SIZE,
    z: chunkCoords.z * CHUNK_SIZE,
  };

  // Pre-allocate — worst case is CHUNK_SIZE³ * 6 faces * 4 verts
  // In practice, never reached. We'll slice the used portion after.
  const maxVerts = CHUNK_SIZE ** 3 * 6 * 4;
  const positions = new Float32Array(maxVerts * 3);
  const normals   = new Float32Array(maxVerts * 3);
  const colors    = new Float32Array(maxVerts * 3);
  const indices   = new Uint32Array(maxVerts * 6); // 6 indices per quad

  let vertexOffset = 0;
  let indexOffset  = 0;

  // ---- GREEDY MESHING ----
  // Run once per face direction
  for (const face of FACES) {
    const [dx, dy, dz] = face;

    // Determine which two axes form the 2D slice plane
    // u: row, v: col
    // and which axis is the sweep axis
    // For +X/-X: sweep along X, slice is Y×Z
    // For +Y/-Y: sweep along Y, slice is X×Z
    // For +Z/-Z: sweep along Z, slice is X×Y

    const sweepAndPlaneAxes = getSweepAndPlaneAxes(face);
    // if (face[1] === -1) {
    //     console.log(`sweep:${sweepAndPlaneAxes.sweepAxis} u:${sweepAndPlaneAxes.uAxis} v:${sweepAndPlaneAxes.vAxis}`);
    //   }

    // Iterate through every slice of the chunk in the direction of sweepAxis
    for (let sweep = 0; sweep < CHUNK_SIZE; sweep++) {
      // Build the 2D mask for this slice
      // mask[u][v] = voxel color key, or null if face not visible

      // TODO: mask coordinates are on different axes
      const mask: (string | null)[][] = Array.from(
        { length: CHUNK_SIZE }, () => new Array(CHUNK_SIZE).fill(null)
      );

      for (let u = 0; u < CHUNK_SIZE; u++) {
        for (let v = 0; v < CHUNK_SIZE; v++) {
          const objVoxelCoords = sliceToWorld(sweepAndPlaneAxes, sweep, u, v, coriginCoords);
        //   if (face[1] === -1 && sweep === 0) {
        //     console.log(`(u,v): (${u},${v})\nobjVoxelCoords: (x:${objVoxelCoords.x}, y:${objVoxelCoords.y}, z:${objVoxelCoords.z})`);
        //   }

          const voxel = world.getVoxel(objVoxelCoords);
          if (!voxel) continue;

          // Face is only visible if the neighbor in face direction is empty
          const neighbor = world.getVoxel({
            x: objVoxelCoords.x + dx, 
            y: objVoxelCoords.y + dy, 
            z: objVoxelCoords.z + dz
          });
          if (neighbor) continue; // hidden face — skip

          // Encode as a string key for mask comparison
          // Two faces can merge only if same color+material
          mask[u][v] = `${voxel.color[0]},${voxel.color[1]},${voxel.color[2]},${voxel.material}`;
        }
      }

    //   if (face[2] === 1 && sweep === 0) {
    //     console.log(mask);
    //   }

      // Now greedily consume the mask
      const consumed: boolean[][] = Array.from({ length: CHUNK_SIZE }, () =>
        new Array(CHUNK_SIZE).fill(false)
      );

      for (let u = 0; u < CHUNK_SIZE; u++) {
        for (let v = 0; v < CHUNK_SIZE; v++) {
          const tryKey = mask[u][v];
          if (consumed[u][v] || tryKey === null) continue;
          const key: string = tryKey;

          // Expand right (+v) as far as matching
          let width = 1;
          while (v + width < CHUNK_SIZE &&
                 !consumed[u][v + width] &&
                 mask[u][v+ width] === key) {
            width++;
          }

          // Expand down (+v) — entire row [u..u+width) must match
          let height = 1;
          outer: while (u + height < CHUNK_SIZE) {
            for (let k = 0; k < width; k++) {
              if (consumed[u+height][v+k] || mask[u+height][v+k] !== key) {
                break outer;
              }
            }
            height++;
          }

        //   if (face[1] === -1 && sweep === 0) {
        //     console.log(`(u,v): (${u},${v})\nheight: ${height}\nwidth: ${width}`);
        //   }

          // Mark consumed
          for (let ku = 0; ku < height;  ku++) {
            for (let kv = 0; kv < width;  kv++) {
              consumed[u + ku][v + kv] = true;
            }
          }

          // Emit one quad for this width × height rectangle
          const anchorVoxelCoords = sliceToWorld(sweepAndPlaneAxes, sweep, u, v, coriginCoords);
          const [r,g,b] = parseColor(key);
        //   if (face[1] === -1 && sweep === 0) {
        //     console.log(`anchorVoxelCoords: (x:${anchorVoxelCoords.x}, y:${anchorVoxelCoords.y}, z:${anchorVoxelCoords.z})`);
        //   }

          // 4 corners of the quad
          const quadCorners = buildQuadCorners(anchorVoxelCoords, face, sweepAndPlaneAxes, width, height);

          const vi = vertexOffset;
          for (const {x: px, y: py, z: pz} of quadCorners) {
            // if (face[1] === -1 && sweep === 0) {
            //     console.log(`px: ${px}, py: ${py}, pz: ${pz}`);
            // }
            positions[vertexOffset*3]   = px;
            positions[vertexOffset*3+1] = py;
            positions[vertexOffset*3+2] = pz;
            normals[vertexOffset*3]     = dx;
            normals[vertexOffset*3+1]   = dy;
            normals[vertexOffset*3+2]   = dz;
            colors[vertexOffset*3]      = r / 255;
            colors[vertexOffset*3+1]    = g / 255;
            colors[vertexOffset*3+2]    = b / 255;
            vertexOffset++;
          }

          // 2 triangles = 6 indices (vi, vi+1, vi+2, vi, vi+2, vi+3)
          indices[indexOffset++] = vi;
          indices[indexOffset++] = vi + 1;
          indices[indexOffset++] = vi + 2;
          indices[indexOffset++] = vi;
          indices[indexOffset++] = vi + 2;
          indices[indexOffset++] = vi + 3;
        }
      }
    }
  }

  return {
    positions: positions.slice(0, vertexOffset * 3),
    normals:   normals.slice(0, vertexOffset * 3),
    colors:    colors.slice(0, vertexOffset * 3),
    indices:   indices.slice(0, indexOffset),
    vertexCount: vertexOffset,
  };
}