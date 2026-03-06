'use client';
import { useState, useEffect } from 'react';
import { SketchPicker, ColorResult } from 'react-color';
import { Plane } from '@/engine/utils';
import './Panel.css';

interface PanelProps {
  onColorChange: (color: [number, number, number]) => void;
  onPlanesChange: (planes: Plane) => void;
}

const PLANES: { id: 0 | 1 | 2; label: string }[] = [
  { id: 0, label: 'XZ' },
  { id: 1, label: 'XY' },
  { id: 2, label: 'YZ' },
];

export default function Panel({ onColorChange, onPlanesChange }: PanelProps) {
  const [selectedColor, setSelectedColor] = useState('#ffffff');
  const [activePlanes, setActivePlanes] = useState<Plane>([true, true, true]);
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
        <span className="panel-label">Grid Planes</span>
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

    </div>
  );
}