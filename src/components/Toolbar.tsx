// components/Toolbar.tsx
import { useState } from 'react';
import { Tool } from '@/engine/utils';

type Props = {
  onToolChange: (tool: Tool) => void;
};

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'move',  label: 'Move',  icon: '✥' },
  { id: 'place',  label: 'Place',  icon: '✏️' },
  { id: 'remove', label: 'Remove', icon: '⬜' },
];

export default function Toolbar({ onToolChange }: Props) {
  const [activeTool, setActiveTool] = useState<Tool>('move');

  const handleToolClick = (tool: Tool) => {
    setActiveTool(tool);
    onToolChange(tool);
  };

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 10,
    }}>
      {TOOLS.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => handleToolClick(id)}
          title={label}
          style={{
            width: 44,
            height: 44,
            fontSize: 20,
            cursor: 'pointer',
            border: '2px solid',
            borderRadius: 8,
            background: activeTool === id ? '#4caf50' : '#1e1e2e',
            borderColor: activeTool === id ? '#81c784' : '#444',
            color: '#fff',
          }}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}