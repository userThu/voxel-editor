// components/Toolbar.tsx
import { useState, useEffect } from 'react';
import { Tool } from '@/engine/utils';
import './Toolbar.css';

type Props = {
  onToolChange: (tool: Tool) => void;
};

const TOOLS: { id: Tool; label: string; icon: string; shortcut: string }[] = [
  { id: 'move',   label: 'Move',   icon: '✥', shortcut: 'Space' },
  { id: 'place',  label: 'Place',  icon: '✏️', shortcut: 'B' },
  { id: 'remove', label: 'Remove', icon: '⌫', shortcut: 'E' },
];

const shortcuts: Record<string, Tool> = {
  ' ': 'move',
  b: 'place',
  e: 'remove',
};

export default function Toolbar({ onToolChange }: Props) {
  const [activeTool, setActiveTool] = useState<Tool>('move');

  const onKeyDown = (event: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    const tool = shortcuts[event.key.toLowerCase()];
    if (tool) handleToolClick(tool);
  };

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToolClick = (tool: Tool) => {
    setActiveTool(tool);
    onToolChange(tool);
  };

   return (
  <div className="toolbar">
    {TOOLS.map(({ id, label, icon, shortcut }, i) => (
      <div key={id}>
        {i > 0 && <div className="toolbar-divider" />}
        <button
          onClick={() => handleToolClick(id)}
          className={`toolbar-btn${activeTool === id ? ' active' : ''}`}
          aria-label={label}
        >
          {icon}
          <span className="toolbar-tooltip">
            {label}
            <span className="shortcut">{shortcut}</span>
          </span>
        </button>
      </div>
    ))}
  </div>
);
}