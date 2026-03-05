import {Coords, RGBColor} from "./utils";

const CHUNK_SIZE = 16;

export type VoxelData = {
  color: RGBColor;
  material: number;
};

class Chunk {
  // Fixed-size flat array — 16³ = 4096 slots
  // Index via encodeLocal(x, y, z)
  // null = empty voxel
  readonly voxels = new Array<VoxelData | null>(CHUNK_SIZE ** 3).fill(null);
}

class VoxelWorld {
  private chunks = new Map<string, Chunk>();
  private dirtyChunks = new Set<string>();

  /*
    Takes in chunk coordinates and encodes it as `key`
    Maps the key to corresponding Chunk instance in internal
    state representation
  */
  private getChunk(c: Coords): Chunk {
    const key = encodeChunk(c);
    if (!this.chunks.has(key)) {
      this.chunks.set(key, new Chunk());
    }
    return this.chunks.get(key)!;
  }

  setVoxel(worldCoords: Coords, data: VoxelData | null) {
    const chunkCoords = worldToChunk(worldCoords);
    const chunk = this.getChunk(chunkCoords);

    const localCoords = worldToLocal(worldCoords);
    const encoded = encodeLocal(localCoords);
    chunk.voxels[encoded] = data;

    this.markDirty(chunkCoords, localCoords);
  }

  getVoxel(worldCoords: Coords): VoxelData | null {
    const key = encodeChunk(worldToChunk(worldCoords));
    const chunk = this.chunks.get(key);
    if (!chunk) return null;  // chunk doesn't exist = empty
    return chunk.voxels[encodeLocal(worldToLocal(worldCoords))];
  }

  private markDirty(chunkCoords: Coords, localCoords: Coords) {
    this.dirtyChunks.add(encodeChunk(chunkCoords));

    // If on a chunk border, the neighbor's mesh is also affected
    // because face culling reads across chunk boundaries.
    const { x: lx, y: ly, z: lz } = localCoords;
    const { x: cx, y: cy, z: cz } = chunkCoords;
    if (lx === 0)             this.dirtyChunks.add(encodeChunk({x:cx-1, y:cy, z:cz}));
    if (lx === CHUNK_SIZE-1)  this.dirtyChunks.add(encodeChunk({x:cx+1, y:cy, z:cz}));
    if (ly === 0)             this.dirtyChunks.add(encodeChunk({x:cx, y:cy-1, z:cz}));
    if (ly === CHUNK_SIZE-1)  this.dirtyChunks.add(encodeChunk({x:cx, y:cy+1, z:cz}));
    if (lz === 0)             this.dirtyChunks.add(encodeChunk({x:cx, y:cy, z:cz-1}));
    if (lz === CHUNK_SIZE-1)  this.dirtyChunks.add(encodeChunk({x:cx, y:cy, z:cz+1}));
  }

  popDirtyChunks(): string[] {
    const dirty = [...this.dirtyChunks];
    this.dirtyChunks.clear();
    return dirty;
  }

  requeueDirtyChunk(chunkKey: string): void {
    this.dirtyChunks.add(chunkKey);
  }
}

function encodeChunk(cc: Coords): string {
  return `${cc.x},${cc.y},${cc.z}`;
}

// {x,y,z}, where each variable is 4 bits
function encodeLocal(c: Coords): number {
  return (c.x << 8) | (c.y << 4) | c.z;
}

// World coords -> chunk coords
function worldToChunk(c: Coords): Coords {
  return {
    x: Math.floor(c.x / CHUNK_SIZE), 
    y: Math.floor(c.y / CHUNK_SIZE), 
    z: Math.floor(c.z / CHUNK_SIZE)
  };
}

// World coords -> local coords within chunk (always 0-15)
function worldToLocal(c: Coords): Coords {
  // Double-mod to handle negative world coordinates
  return {
    x: ((c.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    y: ((c.y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
    z: ((c.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE,
  }
}

export { VoxelWorld, CHUNK_SIZE}