'use client';
import { useState, useEffect } from 'react';
import { SketchPicker, ColorResult } from 'react-color';
import { Plane, ChunkDimensions } from '@/engine/utils';
import './Panel.css';

interface PanelProps {
  onColorChange: (color: [number, number, number]) => void;
  onPlanesChange: (planes: Plane) => void;
  onDimensionsChange: (dims: ChunkDimensions) => void;
}

const PLANES: { id: 0 | 1 | 2; label: string }[] = [
  { id: 0, label: 'XZ' },
  { id: 1, label: 'XY' },
  { id: 2, label: 'YZ' },
];

const DIMS = ['x', 'y', 'z'] as const;
const MIN = 1;
const MAX = 64;

export default function Panel({ onColorChange, onPlanesChange, onDimensionsChange }: PanelProps) {
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [activePlanes, setActivePlanes] = useState<Plane>([true, true, true]);
  const [dims, setDims] = useState<ChunkDimensions>({ x: 1, y: 1, z: 1 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const handleColorChange = (color: ColorResult) => {
    setSelectedColor(color.hex);
    onColorChange([color.rgb.r, color.rgb.g, color.rgb.b]);
  };

  const togglePlane = (planeID: 0 | 1 | 2) => {
    const next: Plane = [...activePlanes];
    next[planeID] = next[planeID] ? false : true;
    setActivePlanes(next);
    onPlanesChange(next);
  };

  const handleDimChange = (axis: keyof ChunkDimensions, raw: string) => {
    const val = Math.min(MAX, Math.max(MIN, parseInt(raw) || MIN));
    const next = { ...dims, [axis]: val };
    setDims(next);
    onDimensionsChange(next);
  };

  return (
    <div className="panel">

      <div className="panel-section">
        <span className="panel-label">Color</span>
        {isMounted && (
          <SketchPicker
            color={selectedColor}
            onChange={handleColorChange}
            disableAlpha
          />
        )}
      </div>

      <div className="panel-divider" />

      <div className="panel-section">
        <span className="panel-label">Display Grid Planes</span>
        <div className="panel-plane-toggles">
          {PLANES.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => togglePlane(id)}
              className={`panel-plane-btn${activePlanes[id] ? ' active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-divider" />

      <div className="panel-section">
        <span className="panel-label">Chunk Size <span style={{opacity:0.4}}>× 16 voxels</span></span>
        <div className="panel-dims">
          {DIMS.map(axis => (
            <div key={axis} className="panel-dim-field">
              <label className="panel-dim-label">{axis.toUpperCase()}</label>
              <input
                type="number"
                min={MIN}
                max={MAX}
                defaultValue={dims[axis]}
                key={dims[axis]}               // re-mounts input when dims change externally
                onBlur={e => handleDimChange(axis, e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleDimChange(axis, (e.target as HTMLInputElement).value);
                }}
                className="panel-dim-input"
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}