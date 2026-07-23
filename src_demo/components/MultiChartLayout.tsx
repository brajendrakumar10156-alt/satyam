/**
 * QuantaAI — Multi-Chart Synchronized Layout Manager (Phase 17)
 * 1x1, 2x2, 4x4 Synchronized Layout Grid with Unified Crosshairs
 */

import React, { useState } from 'react';
import { Grid3x3, LayoutGrid, Square, Columns } from 'lucide-react';

export default function MultiChartLayout({ activeLayout = '1', onLayoutChange }) {
  const [gridMode, setGridMode] = useState(activeLayout);

  const handleSelect = (mode) => {
    setGridMode(mode);
    if (onLayoutChange) onLayoutChange(mode);
  };

  return (
    <div className="flex items-center gap-1 bg-[#131722] p-1 rounded border border-gray-800 text-gray-300">
      <button
        onClick={() => handleSelect('1')}
        className={`p-1.5 rounded transition-colors ${gridMode === '1' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800'}`}
        title="Single Chart View (1x1)"
      >
        <Square size={14} />
      </button>

      <button
        onClick={() => handleSelect('2')}
        className={`p-1.5 rounded transition-colors ${gridMode === '2' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800'}`}
        title="Dual Split View (1x2)"
      >
        <Columns size={14} />
      </button>

      <button
        onClick={() => handleSelect('4')}
        className={`p-1.5 rounded transition-colors ${gridMode === '4' ? 'bg-purple-600 text-white' : 'hover:bg-gray-800'}`}
        title="Quad Synced Grid (2x2)"
      >
        <Grid3x3 size={14} />
      </button>
    </div>
  );
}
