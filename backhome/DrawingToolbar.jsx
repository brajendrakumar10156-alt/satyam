import React from 'react';
import CursorMenu from './CursorMenu.jsx';

export default function DrawingToolbar() {
  return (
    <div className="flex gap-6 p-6 bg-gray-900 min-h-screen">
      {/* Left Sidebar */}
      <div className="flex flex-col gap-3 p-4 bg-gray-800 rounded-lg w-16">
        <div className="text-xs text-gray-500 text-center font-bold uppercase mb-2">Tools</div>
        
        {/* Cursor Menu - Will show icon and menu */}
        <CursorMenu />

        {/* Other tool buttons */}
        <button className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-gray-950 border border-gray-700 rounded-lg h-96 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-lg mb-2">📊 Canvas Area</p>
            <p className="text-gray-500 text-sm">Click the crosshair icon to select a cursor tool</p>
          </div>
        </div>

        {/* Info Panel */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-white font-bold text-sm mb-3">How to Use:</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li>✓ Click the <span className="text-blue-400">crosshair icon</span> in the left sidebar</li>
            <li>✓ Select a cursor tool (Cross, Dot, Arrow, Demo, Eraser)</li>
            <li>✓ Toggle "Values tooltip on long press"</li>
            <li>✓ Open browser console (F12) to see logs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

