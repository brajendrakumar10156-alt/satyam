import React from 'react';
import { Braces, Wand2, ListFilter, Activity, Radio, Bell, Briefcase, Database } from 'lucide-react';

export const RightToolbar = ({
  isEditorOpen, setIsEditorOpen,
  isAutoPredictEnabled, handlePredictClick, darkMode,
  rightSidebar, setRightSidebar, t
}: any) => {
  return (
    <div className={`hidden md:flex w-10 shrink-0 border-l ${t.border} ${t.bg} flex-col items-center py-3 gap-2 transition-colors duration-200 z-20`}>
      {/* Editor Toggle Button at the top */}
      <button
        onClick={() => {
          setIsEditorOpen(!isEditorOpen);
        }}
        className={`w-8 h-8 rounded flex items-center justify-center relative transition-all ${
          isEditorOpen ? 'bg-green-500/15 text-green-400' : 'text-green-400/60 hover:bg-green-500/10 hover:text-green-400'
        }`}
        title="Pine/Python Strategy Editor"
      >
        <Braces size={16} />
        {isEditorOpen && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-green-400 rounded-l" />}
      </button>

      <div className="w-6 h-px bg-[#2a2e39]/30 my-1" />

      <button
        onClick={handlePredictClick}
        className={`w-8 h-8 rounded flex items-center justify-center relative transition-all ${isAutoPredictEnabled ? (darkMode ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-purple-100 text-purple-700 border border-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.4)]') : (darkMode ? 'text-purple-400/60 hover:bg-purple-500/10 hover:text-purple-400' : 'text-purple-700/60 hover:bg-purple-100 hover:text-purple-800')}`}
        title={isAutoPredictEnabled ? "Auto-Predict Active (Click to Disable)" : "Predict Next Candle (Auto-Loop)"}
      >
        <Wand2 size={16} />
        {isAutoPredictEnabled && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-purple-400 rounded-l" />}
      </button>

      <div className="w-6 h-px bg-[#2a2e39]/30 my-1" />

      {[
        {id: 'watchlist', icon: ListFilter, title: 'Watchlist', activeClass: 'bg-pink-500/15 text-pink-400', inactiveClass: 'text-pink-400/60 hover:bg-pink-500/10 hover:text-pink-400', marker: 'bg-pink-400'},
        {id: 'details', icon: Activity, title: 'Details', activeClass: 'bg-lime-500/15 text-lime-400', inactiveClass: 'text-lime-400/60 hover:bg-lime-500/10 hover:text-lime-400', marker: 'bg-lime-400'},
        {id: 'news', icon: Radio, title: 'News', activeClass: 'bg-zinc-500/15 text-zinc-400', inactiveClass: 'text-zinc-400/60 hover:bg-zinc-500/10 hover:text-zinc-400', marker: 'bg-zinc-400'},
        {id: 'alerts', icon: Bell, title: 'Alerts', activeClass: 'bg-amber-500/15 text-amber-400', inactiveClass: 'text-amber-400/60 hover:bg-amber-500/10 hover:text-amber-400', marker: 'bg-amber-400'},
        {id: 'bounties', icon: Briefcase, title: 'Bounties', activeClass: 'bg-slate-500/15 text-slate-400', inactiveClass: 'text-slate-400/60 hover:bg-slate-500/10 hover:text-slate-400', marker: 'bg-slate-400'},
        {id: 'orderbook', icon: Database, title: 'Order Book', activeClass: 'bg-gray-500/15 text-gray-400', inactiveClass: 'text-gray-400/60 hover:bg-gray-500/10 hover:text-gray-400', marker: 'bg-gray-400'}
      ].map(item => {
        const isActive = rightSidebar === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setRightSidebar(isActive ? null : item.id)}
            className={`w-8 h-8 rounded flex items-center justify-center relative transition-all ${
              isActive ? item.activeClass : item.inactiveClass
            }`}
            title={item.title}
          >
            <item.icon size={16} />
            {isActive && <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-4 ${item.marker} rounded-l`} />}
          </button>
        );
      })}
    </div>
  );
};
