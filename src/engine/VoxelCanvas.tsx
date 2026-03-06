// components/VoxelCanvas.tsx
'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VoxelWorld } from './VoxelWorld';
import { buildChunkMesh } from './ChunkMesh';
import { meshChunk } from './ChunkMesher';
import { Tool, Plane, ChunkDimensions } from './utils';
import { setupEngine } from './Engine';
import { setupMouseEvents, updateCursor } from './Tools';
import {setupChunkGrids} from './Grids';
import Panel from '@/components/Panel';
import Toolbar from '@/components/Toolbar';

export default function VoxelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<VoxelWorld | null>(null);
  if (!worldRef.current) worldRef.current = new VoxelWorld();
  const world = worldRef.current;
  const chunkMeshes = new Map<string, THREE.Mesh>();
  
  const activeToolRef = useRef<Tool>('move');
  const controlsRef = useRef<OrbitControls | null>(null);
  const activeColorRef = useRef<[number, number, number]>([255, 0, 0]);
  const activePlanesRef = useRef<Plane>([true, true, true]);
  const chunkGridsRef = useRef<ReturnType<typeof setupChunkGrids> | null>(null);

  const handlePlanesChange = useCallback((planes: Plane) => {
    activePlanesRef.current = planes;
    if (chunkGridsRef.current) {
        chunkGridsRef.current.setVisible(planes);
    }
  }, []);

  const handleToolChange = useCallback((tool: Tool) => {
    activeToolRef.current = tool;
    if (controlsRef.current) {
        const isMove = tool === 'move';
        if (isMove) {
            console.log("wat");
          controlsRef.current.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          };
        } else {
          controlsRef.current.mouseButtons = {
            LEFT: null,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          };
        }
    }
    if (canvasRef.current) {
        updateCursor(canvasRef.current, tool);
    }
  }, []);

  const handleColorChange = useCallback((color: [number, number, number]) => {
    activeColorRef.current = color;
  }, []);

  const handleDimensionsChange = useCallback((dims: ChunkDimensions) => {
    if (chunkGridsRef.current) {
      chunkGridsRef.current.resize(dims);
      world.setWorldSize({x:dims.x*16, y:dims.y*16, z:dims.z*16});
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = setupEngine(canvas);

    // Initialize references
    chunkGridsRef.current = engine.chunkGrids;
    controlsRef.current = engine.controls;

    // Initialize instances that require references
    chunkGridsRef.current.setVisible([true, true, true]);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    const cleanupMouse = setupMouseEvents(
      canvas, engine.camera, world,
      activeToolRef, activeColorRef, activePlanesRef,
      engine.hoverHighlight
    );
    
    // Render loop
    let frameId: number;
    function tick() {
      frameId = requestAnimationFrame(tick);
      engine.controls.update();
      engine.renderer.render(engine.scene, engine.camera);

      const deadline = performance.now() + 2;
      for (const chunkKey of world.popDirtyChunks()) {
        if (performance.now() > deadline) {
          // Ran out of frame budget — re-queue remainder
          world.requeueDirtyChunk(chunkKey);
          break;
        }
        const [cx, cy, cz]= chunkKey.split(',').map(Number);
        const meshData = meshChunk(world, {x:cx, y:cy, z:cz});

        if (meshData.vertexCount === 0) {
          // Chunk is empty — remove mesh from scene and state
          if (chunkMeshes.has(chunkKey)) {
            engine.scene.remove(chunkMeshes.get(chunkKey)!);
            chunkMeshes.delete(chunkKey);
          }
          continue;
        }

        buildChunkMesh(engine.scene, chunkMeshes, chunkKey,meshData);
      }
      engine.renderer.render(engine.scene, engine.camera);
    }
    tick();

    window.addEventListener('resize', engine.handleResize);

    // Clean-up upon dismount
    frameId = requestAnimationFrame(tick);
    return () => {
        cleanupMouse();
        engine.cleanup();
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', engine.handleResize);
    }
  }, []);
    
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
        <Toolbar onToolChange={handleToolChange} />
        <Panel onColorChange={handleColorChange} onPlanesChange={handlePlanesChange} onDimensionsChange={handleDimensionsChange}/>
    </div>
  )
}