// components/VoxelCanvas.tsx
'use client';
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VoxelWorld } from './VoxelWorld';
import { buildChunkMesh } from './ChunkMesh';
import { meshChunk } from './ChunkMesher';
import { disposeScene, Tool, Plane } from './utils';
import { setupMouseEvents, setupHoverHighlight, updateCursor } from './Tools';
import {setupChunkGrids} from './Grids';
import Panel from '@/components/Panel';
import Toolbar from '@/components/Toolbar';

export default function VoxelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = new VoxelWorld();
  const chunkMeshes = new Map<string, THREE.Mesh>();

  const activeToolRef = useRef<Tool>('move');
  const controlsRef = useRef<OrbitControls | null>(null);
  const activeColorRef = useRef<[number, number, number]>([255, 255, 255]);
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

  useEffect(() => {
    const canvas = canvasRef.current!;
    // Creates WebGL context, binding to `canvas`
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const scene = new THREE.Scene();
    // (fov: vertical FOV, aspect: ratio of canvas width to height, near: anything closer than `near` units to camera is clipped, far: opposite of near)
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    const chunkGrids = setupChunkGrids(scene);
    chunkGridsRef.current = chunkGrids;

    // Renderer init
    renderer.setSize(canvas.clientWidth, canvas.clientHeight); // Sets WebGL viewport to canvas dimensions
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Physical pixels to CSS pixel

    // Scene init
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.8));
    scene.background = new THREE.Color(0xfffcf2);
    
    chunkGrids.setVisible([true, true, true]);

    // Camera init
    camera.position.set(24, 16, 24); // Places camera at world/three coordinates
    camera.lookAt(0, 0, 0); // Rotates camera to face specified coordinates
    
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 5;
    controls.maxDistance = 200;
    controls.enabled = true;
    controlsRef.current = controls;

    // Controls init
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Lighting init
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // (color, intensity)
    scene.add(ambientLight);

    // Mouse events
    const hoverHighlight = setupHoverHighlight(scene);
    const cleanupMouse = setupMouseEvents(
      canvas, camera, world,
      activeToolRef, activeColorRef, activePlanesRef,
      hoverHighlight
    );
    
    // Render loop
    let frameId: number;
    function tick() {
      frameId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);

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
            scene.remove(chunkMeshes.get(chunkKey)!);
            chunkMeshes.delete(chunkKey);
          }
          continue;
        }

        buildChunkMesh(scene, chunkMeshes, chunkKey,meshData);
      }
      renderer.render(scene, camera);
    }
    tick();

    const handleResize = () => {
      console.log("resized");
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Clean-up upon dismount
    frameId = requestAnimationFrame(tick);
    return () => {
        cleanupMouse();
        chunkGrids.dispose();
        hoverHighlight.dispose();
        cancelAnimationFrame(frameId);
        renderer.dispose();
        controls.dispose();
        disposeScene(scene);
        window.removeEventListener('resize', handleResize);
    }
  }, []);
    
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
        <Toolbar onToolChange={handleToolChange} />
        <Panel onColorChange={handleColorChange} onPlanesChange={handlePlanesChange}/>
    </div>
  )
}