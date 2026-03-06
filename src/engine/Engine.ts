import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setupChunkGrids } from './Grids';
import { meshChunk } from './ChunkMesher';
import { VoxelWorld } from './VoxelWorld';
import { buildChunkMesh } from './ChunkMesh';
import { Tool, Plane, ChunkDimensions } from './utils';
import { setupHoverHighlight, setupMouseEvents, updateCursor } from './InputLogic';

class Engine {
  // States
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  chunkGrids: ReturnType<typeof setupChunkGrids>;
  hoverHighlight: ReturnType<typeof setupHoverHighlight>;
  // Input states
  activeTool: Tool = 'move';
  activeColor: [number, number, number] = [255, 0, 0];
  activePlanes: Plane = [true, true, true];
  // Internal variables
  private frameId: number = 0;
  private chunkMeshes = new Map<string, THREE.Mesh>();
  private cleanupMouse: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Initialize Three.js modules
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.scene    = new THREE.Scene();
    this.camera   = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    // Initialize Renderer settings
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Initialize Scene settings
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    this.scene.add(new THREE.DirectionalLight(0xffffff, 0.8));
    this.scene.background = new THREE.Color(0xfffcf2);

    // Initialize Camera settings
    this.camera.position.set(24, 16, 24);
    this.camera.lookAt(0, 0, 0);

    this.controls.enableDamping    = true;
    this.controls.dampingFactor    = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance      = 5;
    this.controls.maxDistance      = 200;

    // Initialize Grid + Cursor Highlight settings
    this.chunkGrids     = setupChunkGrids(this.scene);
    this.hoverHighlight = setupHoverHighlight(this.scene);
    this.chunkGrids.setVisible([true, true, true]);
  }

  // Called once world and canvas are ready
  init(canvas: HTMLCanvasElement, world: VoxelWorld): void {
    // Wrap refs as objects setupMouseEvents expects
    const activeToolRef   = { current: this.activeTool };
    const activeColorRef  = { current: this.activeColor };
    const activePlanesRef = { current: this.activePlanes };

    // Keep refs in sync when handlers mutate state
    Object.defineProperty(activeToolRef,   'current', { get: () => this.activeTool,   set: v => { this.activeTool = v; }   });
    Object.defineProperty(activeColorRef,  'current', { get: () => this.activeColor,  set: v => { this.activeColor = v; }  });
    Object.defineProperty(activePlanesRef, 'current', { get: () => this.activePlanes, set: v => { this.activePlanes = v; } });

    this.cleanupMouse = setupMouseEvents(
      canvas, this.camera, world,
      activeToolRef, activeColorRef, activePlanesRef,
      this.hoverHighlight
    );
  }

  handleToolChange(tool: Tool, canvas: HTMLCanvasElement): void {
    this.activeTool = tool;
    this.controls.mouseButtons = {
      LEFT:   tool === 'move' ? THREE.MOUSE.PAN : null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.ROTATE,
    };
    updateCursor(canvas, tool);
  }

  handleColorChange(color: [number, number, number]): void {
    this.activeColor = color;
  }

  handlePlanesChange(planes: Plane): void {
    this.activePlanes = planes;
    this.chunkGrids.setVisible(planes);
  }

  handleDimensionsChange(dims: ChunkDimensions, world: VoxelWorld): void {
    this.chunkGrids.resize(dims);
    world.setWorldSize({ x: dims.x * 16, y: dims.y * 16, z: dims.z * 16 });
  }

  handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  start(world: VoxelWorld): void {
    const tick = () => {
      this.frameId = requestAnimationFrame(tick);
      this.controls.update();

      const deadline = performance.now() + 2;
      for (const chunkKey of world.popDirtyChunks()) {
        if (performance.now() > deadline) {
          world.requeueDirtyChunk(chunkKey);
          break;
        }
        const [cx, cy, cz] = chunkKey.split(',').map(Number);
        const meshData = meshChunk(world, { x: cx, y: cy, z: cz });

        if (meshData.vertexCount === 0) {
          if (this.chunkMeshes.has(chunkKey)) {
            this.scene.remove(this.chunkMeshes.get(chunkKey)!);
            this.chunkMeshes.delete(chunkKey);
          }
          continue;
        }
        buildChunkMesh(this.scene, this.chunkMeshes, chunkKey, meshData);
      }

      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private stop(): void {
    cancelAnimationFrame(this.frameId);
  }

  dispose(): void {
    this.stop();
    this.cleanupMouse?.();
    this.chunkGrids.dispose();
    this.hoverHighlight.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
  }
}

export { Engine };