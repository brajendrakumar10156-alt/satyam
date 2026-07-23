import React from 'react';
import { 
  Crosshair, TrendingUp, AlignJustify, Square, Brush, Trash2, 
  MousePointer2, Circle, MousePointer, Play, Wand2, Eraser, 
  Spline, Route, Activity, ArrowUpRight, Info, MoveHorizontal, Compass, 
  SplitSquareHorizontal, Minus, ArrowRight, MoveVertical, Plus, 
  ListTree, Sliders, Baseline, Columns, Grid3x3, Box, GitPullRequest, GitMerge, 
  PenTool, Disc, Triangle, Type, FileText, Tag, MessageSquareText, Signpost, ArrowUp, ArrowDown, Star, Heart, 
  Waypoints, Focus, TrendingDown, Maximize, Ruler, ZoomIn, ZoomOut, Magnet, Lock, Eye, EyeOff, Rocket, Zap, Unlock, Shapes
} from 'lucide-react';

export const LeftToolbar = ({
  horizontal = false,
  t,
  darkMode,
  activeTool,
  setActiveTool,
  showToast,
  setDrawings,
  selectedTools,
  setSelectedTools,
  activeFlyout,
  setActiveFlyout,
  setIsCursorStudioOpen,
  setIsTrendStudioOpen,
  chartInstance,
  isMagnetEnabled,
  setIsMagnetEnabled,
  isDrawingLocked,
  setIsDrawingLocked,
  isDrawingHidden,
  setIsDrawingHidden,
  renderEngine,
  handleEngineToggle,
  keepDrawing,
  setKeepDrawing,
  lockDrawings,
  setLockDrawings
}) => {
  const categories = [
    {
      id: 'cursor',
      title: 'Cursors',
      defaultIcon: MousePointer2,
      theme: {
        baseText: 'text-sky-400/60',
        text: 'text-sky-400',
        hover: 'hover:bg-sky-500/10 hover:text-sky-400',
        active: 'bg-sky-500/15 border-sky-400 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
      },
      items: [
        { id: 'crosshair', title: 'Crosshair', icon: MousePointer2 },
        { id: 'dot', title: 'Dot', icon: Circle },
        { id: 'arrow', title: 'Arrow', icon: MousePointer },
        { id: 'demonstration', title: 'Demonstration', icon: Play },
        { id: 'magic', title: 'Magic', icon: Wand2 },
        { id: 'eraser', title: 'Eraser', icon: Eraser },
      ]
    },
    {
      id: 'trend',
      title: 'Trend Lines',
      defaultIcon: Spline,
      theme: {
        baseText: 'text-cyan-400/60',
        text: 'text-cyan-400',
        hover: 'hover:bg-cyan-500/10 hover:text-cyan-400',
        active: 'bg-cyan-500/15 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
      },
      items: [
        { id: 'trendline', title: 'Classic (Trend Line)', icon: Spline },
        { id: 'polyline', title: 'Poly-Line', icon: Route },
        { id: 'curve', title: 'Curve', icon: Activity },
        { id: 'ray', title: 'Ray', icon: ArrowUpRight },
        { id: 'infoline', title: 'Info Line', icon: Info },
        { id: 'extendedline', title: 'Extended Line', icon: MoveHorizontal },
        { id: 'trendangle', title: 'Trend Angle', icon: Compass },
        { id: 'channel', title: 'Parallel Channel', icon: SplitSquareHorizontal },
        { id: 'regression_trend', title: 'Regression Trend', icon: TrendingUp },
        { id: 'horizontal_line', title: 'Horizontal Line', icon: Minus },
        { id: 'horizontal_ray', title: 'Horizontal Ray', icon: ArrowRight },
        { id: 'vertical_line', title: 'Vertical Line', icon: MoveVertical },
        { id: 'crossline', title: 'Cross Line', icon: Plus },
      ]
    },
    {
      id: 'gann_fib',
      title: 'Gann & Fibonacci',
      defaultIcon: GitPullRequest,
      theme: {
        baseText: 'text-indigo-400/60',
        text: 'text-indigo-400',
        hover: 'hover:bg-indigo-500/10 hover:text-indigo-400',
        active: 'bg-indigo-500/15 border-indigo-400 text-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.15)]'
      },
      items: [
        { id: 'fibonacci', title: 'Fib Retracement', icon: ListTree },
        { id: 'fib_extension', title: 'Trend-Based Fib Extension', icon: Sliders },
        { id: 'fib_fan', title: 'Fib Speed Resistance Fan', icon: Baseline },
        { id: 'fib_timezone', title: 'Fibonacci Time Zone', icon: Columns },
        { id: 'gann_fan', title: 'Gann Fan', icon: Activity },
        { id: 'gann_square', title: 'Gann Square', icon: Grid3x3 },
        { id: 'gann_box', title: 'Gann Box', icon: Box },
        { id: 'pitchfork', title: 'Pitchfork', icon: GitPullRequest },
        { id: 'schiff_pitchfork', title: 'Schiff Pitchfork', icon: GitMerge },
      ]
    },
    {
      id: 'shape',
      title: 'Shapes',
      defaultIcon: PenTool,
      theme: {
        baseText: 'text-yellow-400/60',
        text: 'text-yellow-400',
        hover: 'hover:bg-yellow-500/10 hover:text-yellow-400',
        active: 'bg-yellow-500/15 border-yellow-400 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.15)]'
      },
      items: [
        { id: 'rectangle', title: 'Rectangle', icon: Square },
        { id: 'circle', title: 'Circle', icon: Circle },
        { id: 'ellipse', title: 'Ellipse', icon: Disc },
        { id: 'triangle', title: 'Triangle', icon: Triangle },
        { id: 'brush', title: 'Brush', icon: PenTool },
        { id: 'curve', title: 'Curve', icon: Spline },
      ]
    },
    {
      id: 'annotation',
      title: 'Annotations & Icons',
      defaultIcon: MessageSquareText,
      theme: {
        baseText: 'text-teal-400/60',
        text: 'text-teal-400',
        hover: 'hover:bg-teal-500/10 hover:text-teal-400',
        active: 'bg-teal-500/15 border-teal-400 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
      },
      items: [
        { id: 'text', title: 'Text', icon: Type },
        { id: 'note', title: 'Note', icon: FileText },
        { id: 'price_note', title: 'Price Note', icon: Tag },
        { id: 'callout', title: 'Callout', icon: MessageSquareText },
        { id: 'signpost', title: 'Signpost', icon: Signpost },
        { id: 'icon_up', title: 'Up Arrow ⬆️', icon: ArrowUp },
        { id: 'icon_down', title: 'Down Arrow ⬇️', icon: ArrowDown },
        { id: 'icon_star', title: 'Star ⭐', icon: Star },
        { id: 'icon_heart', title: 'Heart ❤️', icon: Heart },
      ]
    },
    {
      id: 'pattern',
      title: 'Patterns',
      defaultIcon: Waypoints,
      theme: {
        baseText: 'text-rose-400/60',
        text: 'text-rose-400',
        hover: 'hover:bg-rose-500/10 hover:text-rose-400',
        active: 'bg-rose-500/15 border-rose-400 text-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.15)]'
      },
      items: [
        { id: 'xabcd', title: 'XABCD Pattern', icon: Waypoints },
        { id: 'abcd', title: 'ABCD Pattern', icon: Route },
        { id: 'triangle_pat', title: 'Triangle Pattern', icon: Triangle },
        { id: 'head_shoulders', title: 'Head & Shoulders', icon: Activity },
        { id: 'elliott_wave', title: 'Elliott Impulse Wave (1-2-3-4-5)', icon: TrendingUp },
      ]
    },
    {
      id: 'forecast',
      title: 'Prediction & Measurement',
      defaultIcon: Focus,
      theme: {
        baseText: 'text-red-400/60',
        text: 'text-red-500',
        hover: 'hover:bg-red-500/10 hover:text-red-500',
        active: 'bg-red-500/15 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
      },
      items: [
        { id: 'long_position', title: 'Long Position', icon: TrendingUp },
        { id: 'short_position', title: 'Short Position', icon: TrendingDown },
        { id: 'price_range', title: 'Price Range', icon: MoveVertical },
        { id: 'date_range', title: 'Date Range', icon: MoveHorizontal },
        { id: 'date_price_range', title: 'Date & Price Range', icon: Maximize },
      ]
    }
  ];

  if (horizontal) {
    return (
      <div className={`md:hidden flex items-center justify-around gap-0.5 px-1 py-1 border-t ${t.border} ${t.bg} shrink-0 overflow-x-auto mobile-scroll-x`}>
        <button onClick={() => { setActiveTool(null); showToast("Cursor Selected"); }} className={`p-2.5 min-w-[44px] rounded transition-all ${!activeTool ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : `${t.text} hover:bg-blue-500/10 hover:text-blue-500`}`}>
          <Crosshair size={18} />
        </button>
        <button onClick={() => { setActiveTool('trendline'); showToast("Trend Line Selected"); }} className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'trendline' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : `${t.text} hover:bg-cyan-400/10 hover:text-cyan-400`}`}>
          <TrendingUp size={18} />
        </button>
        <button onClick={() => { setActiveTool('fibonacci'); showToast("Fib Retracement Selected"); }} className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'fibonacci' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : `${t.text} hover:bg-indigo-400/10 hover:text-indigo-400`}`}>
          <AlignJustify size={18} />
        </button>
        <button onClick={() => { setActiveTool('rectangle'); showToast("Rectangle Selected"); }} className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'rectangle' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : `${t.text} hover:bg-amber-500/10 hover:text-amber-500`}`}>
          <Square size={18} />
        </button>
        <button onClick={() => { setActiveTool('brush'); showToast("Brush Selected"); }} className={`p-2.5 min-w-[44px] rounded transition-all ${activeTool === 'brush' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : `${t.text} hover:bg-amber-500/10 hover:text-amber-500`}`}>
          <Brush size={18} />
        </button>
        <button onClick={() => { setDrawings([]); showToast("Cleared all drawings"); }} className={`p-2.5 min-w-[44px] rounded transition-all text-red-400 hover:bg-red-500/10 hover:text-red-500`}>
          <Trash2 size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={`hidden md:flex w-12 shrink-0 border-r ${t.border} ${t.bg} flex-col items-center py-2.5 gap-1.5 z-40 relative select-none`}>
      {categories.map((cat) => {
        const activeSubToolId = selectedTools[cat.id];
        const activeSubTool = cat.items.find(item => item.id === activeSubToolId) || cat.items[0];
        const IconComponent = activeSubTool.icon;
        const isCurrentCatActive = activeTool === activeSubToolId;
        const isFlyoutOpen = activeFlyout === cat.id;

        return (
          <div key={cat.id} className="relative w-9 h-9 flex items-center justify-center group/cat">
            <button
              onClick={() => {
                setActiveTool(isCurrentCatActive ? null : activeSubToolId);
                setActiveFlyout(isFlyoutOpen ? null : cat.id);
              }}
              className={`w-9 h-9 border-l-2 border-transparent rounded-r-xl rounded-l-[3px] flex items-center justify-center transition-all relative ${
                isCurrentCatActive ? (cat.theme?.active || 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20') : `${cat.theme?.baseText || t.muted} group-hover/cat:opacity-100 ${cat.theme?.hover || t.hover}`
              }`}
              title={`${cat.title}: ${activeSubTool.title}`}
            >
              <IconComponent size={18} strokeWidth={2} />
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFlyout(isFlyoutOpen ? null : cat.id);
                }}
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 text-[6px] font-bold opacity-60 group-hover/cat:opacity-100 flex items-end justify-end pointer-events-auto leading-[6px] select-none transition-colors ${isCurrentCatActive ? cat.theme?.text : cat.theme?.baseText || 'text-gray-500'} group-hover/cat:${cat.theme?.text || 'text-blue-500'}`}
              >
                ◢
              </span>
            </button>

            {isFlyoutOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setActiveFlyout(null)} />
                <div className={`absolute top-0 left-10 w-52 backdrop-blur-xl ${darkMode ? 'bg-[#1c2030]/90 text-white' : 'bg-white/95 text-[#131722] shadow-gray-400/50'} border ${t.border} rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1 animate-fade-in`}>
                  <div className="px-3 py-1.5 border-b border-inherit text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    {cat.title}
                  </div>
                  {cat.id === 'cursor' && (
                    <button onClick={() => { setIsCursorStudioOpen(true); setActiveFlyout(null); }} className="w-[calc(100%-16px)] mx-2 my-1.5 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded border border-[#2962ff]/40 text-[#2962ff] hover:bg-[#2962ff]/10 text-[10.5px] font-extrabold transition-all">
                      <Plus size={11} className="text-[#2962ff]" />
                      <span>Cursor Studio</span>
                    </button>
                  )}
                  {cat.id === 'trend' && (
                    <button onClick={() => { setIsTrendStudioOpen(true); setActiveFlyout(null); }} className="w-[calc(100%-16px)] mx-2 my-1.5 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded border border-[#2962ff]/40 text-[#2962ff] hover:bg-[#2962ff]/10 text-[10.5px] font-extrabold transition-all">
                      <Plus size={11} className="text-[#2962ff]" />
                      <span>Trend Studio</span>
                    </button>
                  )}
                  {cat.items.map((item) => {
                    const SubIcon = item.icon;
                    const isSubActive = activeTool === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedTools(prev => ({ ...prev, [cat.id]: item.id }));
                          setActiveTool(item.id);
                          setActiveFlyout(null);
                          showToast(`Selected: ${item.title}`);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${isSubActive ? (cat.theme?.active || 'bg-[#2962ff] text-white') : `${t.text} ${cat.theme?.hover || t.hover}`}`}
                      >
                        <SubIcon size={13} />
                        <span>{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}

      <div className={`w-7 h-px my-0.5 ${t.border} bg-[#2a2e39]`} />
      
      {/* Utility Tools */}
      <button onClick={() => { setActiveTool(prev => prev === 'ruler' ? null : 'ruler'); showToast("Ruler (Measurement) Activated"); }} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${activeTool === 'ruler' ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${t.muted} ${t.hover}`}`} title="Measure (Ruler)">
        <Ruler size={18} strokeWidth={2} />
      </button>

      {/* Magnet */}
      <button onClick={() => { setIsMagnetEnabled(!isMagnetEnabled); showToast(`Magnet Mode ${!isMagnetEnabled ? 'ON' : 'OFF'}`); }} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isMagnetEnabled ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${t.muted} ${t.hover}`}`} title="Magnet Mode">
        <Magnet size={18} strokeWidth={2} />
      </button>
      
      {/* Lock */}
      <button onClick={() => { setIsDrawingLocked(!isDrawingLocked); showToast(`Drawing Tools ${!isDrawingLocked ? 'LOCKED' : 'UNLOCKED'}`); }} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDrawingLocked ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${t.muted} ${t.hover}`}`} title={isDrawingLocked ? "Unlock Drawing Tools" : "Lock Drawing Tools"}>
        <Lock size={18} strokeWidth={2} />
      </button>

      {/* 🚀 Rendering Engine Toggle */}
      <button
        onClick={handleEngineToggle}
        className={`w-9 h-9 rounded-lg flex items-center justify-center relative transition-all duration-300 ${
          renderEngine === 'webgpu'
            ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
            : renderEngine === 'webgl' 
            ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
            : `${t.muted} ${t.hover}`
        }`}
        title={renderEngine === 'webgpu' ? 'Rendering: WebGPU (Extreme Performance)' : renderEngine === 'webgl' ? 'Rendering: WebGL (GPU Accelerated)' : 'Rendering: Canvas 2D'}
      >
        {renderEngine === 'webgpu' ? (
          <Rocket size={18} strokeWidth={2} className="drop-shadow-[0_0_4px_rgba(168,85,247,0.6)]" />
        ) : (
          <Zap size={18} strokeWidth={2} className={renderEngine === 'webgl' ? 'drop-shadow-[0_0_4px_rgba(16,185,129,0.6)]' : ''} />
        )}
        
        {renderEngine === 'webgpu' ? (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_4px_rgba(168,85,247,0.8)]" />
        ) : renderEngine === 'webgl' ? (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
        ) : null}
      </button>

      {/* Hide Drawings */}
      <button onClick={() => { setIsDrawingHidden(!isDrawingHidden); showToast(`Drawings ${!isDrawingHidden ? 'HIDDEN' : 'VISIBLE'}`); }} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDrawingHidden ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : `${t.muted} ${t.hover}`}`} title={isDrawingHidden ? "Show All Drawings" : "Hide All Drawings"}>
        {isDrawingHidden ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
      </button>

      <div className={`w-7 h-px my-0.5 ${t.border} bg-[#2a2e39]`} />

      {/* Trash */}
      <div className="relative w-9 h-9 flex items-center justify-center group/cat mt-auto mb-2">
        <button onClick={() => { setDrawings([]); showToast("Cleared all drawings"); }} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors text-red-500/70 hover:bg-red-500/10 hover:text-red-500`} title="Remove All Drawings">
          <Trash2 size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
