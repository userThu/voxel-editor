'use client';
import { useEffect, useRef } from 'react';
import { VoxelWorld } from './VoxelWorld';
import { Tool, Plane, ChunkDimensions } from './utils';
import { Engine } from './Engine.js';
import Panel from '@/components/Panel';
import Toolbar from '@/components/Toolbar';

export default function VoxelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const worldRef = useRef<VoxelWorld | null>(null);
  if (!worldRef.current) worldRef.current = new VoxelWorld();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const world = worldRef.current!;
    const engine = new Engine(canvas);
    engineRef.current = engine;

    engine.init(canvas, world);
    // Render loop
    engine.start(worldRef.current!);

    // Handle window resize
    window.addEventListener('resize', engine.handleResize);

    // Clean-up upon dismount
    return () => {
        engine.dispose();
        window.removeEventListener('resize', engine.handleResize);
    }
  }, []);
    
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
        <Toolbar
          onToolChange={(tool: Tool) =>
            engineRef.current!.handleToolChange(tool, canvasRef.current!)}
        />
        <Panel
          onColorChange={(color) => engineRef.current!.handleColorChange(color)}
          onPlanesChange={(planes: Plane) => engineRef.current!.handlePlanesChange(planes)}
          onDimensionsChange={(dims: ChunkDimensions) =>
            engineRef.current!.handleDimensionsChange(dims, worldRef.current!)}
        />
    </div>
  )
}