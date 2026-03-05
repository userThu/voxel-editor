// components/VoxelCanvas.tsx
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VoxelWorld, VoxelData } from './VoxelWorld';
import { buildChunkMesh, updateChunkMesh } from './ChunkMesh';
import { meshChunk } from './ChunkMesher';
import { disposeScene } from './utils';

const RED:   VoxelData = { color: [255, 0,   0  ], material: 0 };
const GREEN: VoxelData = { color: [0,   255, 0  ], material: 0 };
const BLUE:  VoxelData = { color: [0,   0,   255], material: 0 };

export default function VoxelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = new VoxelWorld();
  for (let x = 0; x < 2; x++)
  for (let y = 0; y < 2; y++)
  for (let z = 0; z < 2; z++)
    world.setVoxel({x: x, y:y, z:z}, GREEN);
  const chunkMeshes = new Map<string, THREE.Mesh>();

  useEffect(() => {
    const canvas = canvasRef.current!;
    // Creates WebGL context, binding to `canvas`
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const scene = new THREE.Scene();
    // (fov: vertical FOV, aspect: ratio of canvas width to height, near: anything closer than `near` units to camera is clipped, far: opposite of near)
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const controls = new OrbitControls(camera, renderer.domElement);
    const grid = new THREE.GridHelper(16, 16, 0x444444, 0x222222);

    // Renderer init
    renderer.setSize(canvas.clientWidth, canvas.clientHeight); // Sets WebGL viewport to canvas dimensions
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Physical pixels to CSS pixel

    // Scene init
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.8));
    scene.background = new THREE.Color(0xfffcf2);

    grid.position.set(8,0,8);
    scene.add(grid);

    // Camera init
    camera.position.set(24, 16, 24); // Places camera at world/three coordinates
    camera.lookAt(0, 0, 0); // Rotates camera to face specified coordinates
    
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 5;
    controls.maxDistance = 200;

    // Lighting init
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // (color, intensity)
    scene.add(ambientLight);
    
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

        if (chunkMeshes.has(chunkKey)) {
          updateChunkMesh(chunkMeshes.get(chunkKey)!, meshData);
        } else {
          const mesh = buildChunkMesh(meshData);
          scene.add(mesh);
          chunkMeshes.set(chunkKey, mesh);
        }
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
        cancelAnimationFrame(frameId);
        renderer.dispose();
        controls.dispose();
        disposeScene(scene);
        window.removeEventListener('resize', handleResize);
    }
  }, []);
    
  return <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />;
}