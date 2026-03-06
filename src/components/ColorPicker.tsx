'use client';
import { useState, useEffect } from 'react';
import { SketchPicker, ColorResult } from 'react-color';
import "./ColorPicker.css"

// Define the type for the component's props
interface ColorPickerProps {
  onColorChange: (color: [number, number, number]) => void;
}

export default function ColorPicker({ onColorChange }: ColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleColorChange = (color: ColorResult) => {
    setSelectedColor(color.hex);
    onColorChange([color.rgb.r, color.rgb.g, color.rgb.b]);
  };

  return (
    <div className="color-picker-wrapper">
      {isMounted && (
        <SketchPicker
          color={selectedColor}
          onChange={handleColorChange}
          disableAlpha
        />
      )}
    </div>
  );
}
