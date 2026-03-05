// components/VoxelCanvas.tsx
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default function VoxelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Test geometry — replace with voxel chunk meshes
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0x4caf50 })
    );
    cube.position.set(.5,.5,.5);
    scene.add(cube);
    scene.add(grid);


    // Render loop
    let frameId: number;
    function tick() {
      frameId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    }
    tick();

    const handleResize = () => {
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
    }
  }, []);
    

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />;
}