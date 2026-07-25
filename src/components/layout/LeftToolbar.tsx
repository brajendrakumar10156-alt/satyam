import { useUIStore } from '../../store/uiStore';
import React, { useState, useRef } from 'react';
import { 
  Crosshair, TrendingUp, AlignJustify, Square, Brush, Trash2, 
  MousePointer2, Circle, MousePointer, Play, Wand2, Eraser, 
  Spline, Route, Activity, ArrowUpRight, Info, MoveHorizontal, Compass, 
  SplitSquareHorizontal, Minus, ArrowRight, MoveVertical, Plus, 
  ListTree, Sliders, Baseline, Columns, Grid3x3, Box, GitPullRequest, GitMerge, 
  PenTool, Disc, Triangle, Type, FileText, Tag, MessageSquareText, Signpost, ArrowUp, ArrowDown, Star, Heart, 
  Waypoints, Focus, TrendingDown, Maximize, Ruler, ZoomIn, ZoomOut, Magnet, Lock, Eye, EyeOff, Rocket, Zap, Unlock, Shapes, Monitor,
  MoreHorizontal, ChevronUp, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';

export const LeftToolbar = ({
  horizontal = false,
  t,
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
  
  const { darkMode } = useUIStore();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        { id: 'trend_fib_extension', title: 'Trend-Based Fib Extension', icon: Sliders },
        { id: 'fib_channel', title: 'Fib Channel', icon: Baseline },
        { id: 'fib_time_zone', title: 'Fib Time Zone', icon: Columns },
        { id: 'gann_box', title: 'Gann Box', icon: Grid3x3 },
        { id: 'gann_square', title: 'Gann Square', icon: Box },
        { id: 'pitchfork', title: 'Pitchfork', icon: GitPullRequest },
        { id: 'schiff_pitchfork', title: 'Schiff Pitchfork', icon: GitMerge },
      ]
    },
    {
      id: 'shapes',
      title: 'Geometric Shapes',
      defaultIcon: Shapes,
      theme: {
        baseText: 'text-emerald-400/60',
        text: 'text-emerald-400',
        hover: 'hover:bg-emerald-500/10 hover:text-emerald-400',
        active: 'bg-emerald-500/15 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
      },
      items: [
        { id: 'brush', title: 'Brush', icon: Brush },
        { id: 'highlighter', title: 'Highlighter', icon: PenTool },
        { id: 'rectangle', title: 'Rectangle', icon: Square },
        { id: 'circle', title: 'Circle', icon: Disc },
        { id: 'ellipse', title: 'Ellipse', icon: Circle },
        { id: 'path', title: 'Path (Polyline)', icon: Route },
        { id: 'triangle', title: 'Triangle', icon: Triangle },
      ]
    },
    {
      id: 'annotation',
      title: 'Annotation & Text',
      defaultIcon: Type,
      theme: {
        baseText: 'text-amber-400/60',
        text: 'text-amber-400',
        hover: 'hover:bg-amber-500/10 hover:text-amber-400',
        active: 'bg-amber-500/15 border-amber-400 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
      },
      items: [
        { id: 'text', title: 'Text Note', icon: Type },
        { id: 'anchored_text', title: 'Anchored Text', icon: FileText },
        { id: 'callout', title: 'Callout', icon: Tag },
        { id: 'balloon', title: 'Balloon', icon: MessageSquareText },
        { id: 'price_label', title: 'Price Label', icon: Signpost },
        { id: 'arrow_up', title: 'Arrow Up', icon: ArrowUp },
        { id: 'arrow_down', title: 'Arrow Down', icon: ArrowDown },
      ]
    },
    {
      id: 'icons',
      title: 'Icons & Markers',
      defaultIcon: Star,
      theme: {
        baseText: 'text-rose-400/60',
        text: 'text-rose-400',
        hover: 'hover:bg-rose-500/10 hover:text-rose-400',
        active: 'bg-rose-500/15 border-rose-400 text-rose-400 shadow-[0_0_15px_rgba(251,113,133,0.15)]'
      },
      items: [
        { id: 'star', title: 'Star Marker', icon: Star },
        { id: 'heart', title: 'Heart Marker', icon: Heart },
        { id: 'flag', title: 'Flag Pin', icon: Signpost },
        { id: 'target', title: 'Target Spot', icon: Disc },
      ]
    },
    {
      id: 'patterns',
      title: 'Harmonic Patterns',
      defaultIcon: Waypoints,
      theme: {
        baseText: 'text-purple-400/60',
        text: 'text-purple-400',
        hover: 'hover:bg-purple-500/10 hover:text-purple-400',
        active: 'bg-purple-500/15 border-purple-400 text-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.15)]'
      },
      items: [
        { id: 'head_shoulders', title: 'Head & Shoulders', icon: Activity },
        { id: 'abcd_pattern', title: 'ABCD Pattern', icon: Waypoints },
        { id: 'elliott_impulse', title: 'Elliott Impulse Wave (1-2-3-4-5)', icon: TrendingUp },
        { id: 'elliott_correction', title: 'Elliott Correction Wave (A-B-C)', icon: TrendingDown },
        { id: 'triangle_pattern', title: 'Triangle Pattern', icon: Triangle },
      ]
    },
    {
      id: 'prediction',
      title: 'Projection & Risk',
      defaultIcon: Focus,
      theme: {
        baseText: 'text-teal-400/60',
        text: 'text-teal-400',
        hover: 'hover:bg-teal-500/10 hover:text-teal-400',
        active: 'bg-teal-500/15 border-teal-400 text-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.15)]'
      },
      items: [
        { id: 'long_position', title: 'Long Position Risk/Reward', icon: TrendingUp },
        { id: 'short_position', title: 'Short Position Risk/Reward', icon: TrendingDown },
        { id: 'forecast', title: 'Price Forecast', icon: Maximize },
        { id: 'bars_pattern', title: 'Bars Pattern Copy', icon: Columns },
        { id: 'date_price_range', title: 'Date & Price Range Box', icon: Box },
      ]
    }
  ];

  const handleScroll = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 120;
    if (direction === 'up') scrollRef.current.scrollBy({ top: -amount, behavior: 'smooth' });
    if (direction === 'down') scrollRef.current.scrollBy({ top: amount, behavior: 'smooth' });
    if (direction === 'left') scrollRef.current.scrollBy({ left: -amount, behavior: 'smooth' });
    if (direction === 'right') scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const themeConfig = {
    bg: darkMode ? 'bg-[#131722]/95 backdrop-blur-md' : 'bg-white/95 backdrop-blur-md',
    border: darkMode ? 'border-[#2a2e39]' : 'border-gray-200',
    text: darkMode ? 'text-[#d1d4dc]' : 'text-[#131722]',
    muted: darkMode ? 'text-[#787b86]' : 'text-gray-500',
    hover: darkMode ? 'hover:bg-[#2a2e39] hover:text-white' : 'hover:bg-gray-100 hover:text-black',
  };
  const theme = t || themeConfig;

  return (
    <div className={`relative ${horizontal ? 'w-full h-11 flex-row border-b px-2 py-1' : 'w-12 h-full flex-col border-r py-2'} ${theme.border} ${theme.bg} flex items-center shrink-0 z-40 select-none`}>
      
      {/* Slide Arrow - Up / Left */}
      <button 
        onClick={() => handleScroll(horizontal ? 'left' : 'up')}
        className={`w-7 h-4 flex items-center justify-center text-xs opacity-50 hover:opacity-100 transition-opacity ${horizontal ? 'mr-1' : 'mb-1'}`}
        title="Scroll Slide Previous"
      >
        {horizontal ? <ChevronLeft size={14} /> : <ChevronUp size={14} />}
      </button>

      {/* Auto-Adjusting Scrollable Tools Container */}
      <div 
        ref={scrollRef}
        className={`flex ${horizontal ? 'flex-row overflow-x-auto max-w-[calc(100vw-140px)]' : 'flex-col overflow-y-auto max-h-[calc(100vh-140px)]'} scrollbar-none items-center gap-1.5 px-0.5`}
      >
        {categories.map((cat) => {
          const activeSubToolId = selectedTools ? selectedTools[cat.id] : cat.items[0].id;
          const activeSubTool = cat.items.find(item => item.id === activeSubToolId) || cat.items[0];
          const IconComponent = activeSubTool.icon;
          const isCurrentCatActive = activeTool === activeSubToolId;
          const isFlyoutOpen = activeFlyout === cat.id;

          return (
            <div key={cat.id} className="relative w-9 h-9 flex items-center justify-center shrink-0 group/cat">
              <button
                onClick={() => {
                  setActiveTool(isCurrentCatActive ? null : activeSubToolId);
                  setActiveFlyout(isFlyoutOpen ? null : cat.id);
                }}
                className={`w-9 h-9 border-l-2 border-transparent rounded-r-xl rounded-l-[3px] flex items-center justify-center transition-all relative ${
                  isCurrentCatActive ? (cat.theme?.active || 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20') : `${cat.theme?.baseText || theme.muted} group-hover/cat:opacity-100 ${cat.theme?.hover || theme.hover}`
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
                  <div className={`absolute ${horizontal ? 'top-10 left-0' : 'top-0 left-10'} w-52 backdrop-blur-xl ${darkMode ? 'bg-[#1c2030]/95 text-white border-[#2b3045]' : 'bg-white/95 text-[#131722] border-gray-200'} border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1 animate-fade-in`}>
                    <div className="px-3 py-1.5 border-b border-inherit text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                      {cat.title}
                    </div>
                    {cat.id === 'cursor' && setIsCursorStudioOpen && (
                      <button onClick={() => { setIsCursorStudioOpen(true); setActiveFlyout(null); }} className="w-[calc(100%-16px)] mx-2 my-1.5 flex items-center justify-center gap-1.5 py-1 px-2.5 rounded border border-[#2962ff]/40 text-[#2962ff] hover:bg-[#2962ff]/10 text-[10.5px] font-extrabold transition-all">
                        <Plus size={11} className="text-[#2962ff]" />
                        <span>Cursor Studio</span>
                      </button>
                    )}
                    {cat.id === 'trend' && setIsTrendStudioOpen && (
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
                            if (setSelectedTools) setSelectedTools(prev => ({ ...prev, [cat.id]: item.id }));
                            setActiveTool(item.id);
                            setActiveFlyout(null);
                            if (showToast) showToast(`Selected: ${item.title}`);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[11.5px] font-semibold transition-colors ${isSubActive ? (cat.theme?.active || 'bg-[#2962ff] text-white') : `${theme.text} ${cat.theme?.hover || theme.hover}`}`}
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

        <div className={`${horizontal ? 'h-7 w-px mx-1' : 'w-7 h-px my-0.5'} ${theme.border} bg-[#2a2e39]`} />
        
        {/* Utility Tools */}
        <button onClick={() => { setActiveTool(prev => prev === 'ruler' ? null : 'ruler'); if (showToast) showToast("Ruler (Measurement) Activated"); }} className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${activeTool === 'ruler' ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${theme.muted} ${theme.hover}`}`} title="Measure (Ruler)">
          <Ruler size={18} strokeWidth={2} />
        </button>

        {/* Magnet */}
        <button onClick={() => { if (setIsMagnetEnabled) setIsMagnetEnabled(!isMagnetEnabled); if (showToast) showToast(`Magnet Mode ${!isMagnetEnabled ? 'ON' : 'OFF'}`); }} className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isMagnetEnabled ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${theme.muted} ${theme.hover}`}`} title="Magnet Mode">
          <Magnet size={18} strokeWidth={2} />
        </button>
        
        {/* Lock */}
        <button onClick={() => { if (setIsDrawingLocked) setIsDrawingLocked(!isDrawingLocked); if (showToast) showToast(`Drawing Tools ${!isDrawingLocked ? 'LOCKED' : 'UNLOCKED'}`); }} className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDrawingLocked ? 'bg-[#2962ff] text-white shadow-lg shadow-blue-500/20' : `${theme.muted} ${theme.hover}`}`} title={isDrawingLocked ? "Unlock Drawing Tools" : "Lock Drawing Tools"}>
          <Lock size={18} strokeWidth={2} />
        </button>

        {/* 🚀 Rendering Engine Toggle */}
        <button
          onClick={handleEngineToggle}
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative transition-all duration-300 ${
            renderEngine === 'webgpu'
              ? 'bg-purple-500/20 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
              : renderEngine === 'webgl' 
              ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
              : `${theme.muted} ${theme.hover}`
          }`}
          title={renderEngine === 'webgpu' ? 'Rendering: WebGPU (Acer Aspire 7 Dedicated GPU)' : renderEngine === 'webgl' ? 'Rendering: WebGL (GPU Accelerated)' : 'Rendering: Canvas 2D'}
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
        <button onClick={() => { if (setIsDrawingHidden) setIsDrawingHidden(!isDrawingHidden); if (showToast) showToast(`Drawings ${!isDrawingHidden ? 'HIDDEN' : 'VISIBLE'}`); }} className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${isDrawingHidden ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : `${theme.muted} ${theme.hover}`}`} title={isDrawingHidden ? "Show All Drawings" : "Hide All Drawings"}>
          {isDrawingHidden ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
        </button>

        {/* Dynamic More Menu Popover */}
        <div className="relative shrink-0">
          <button 
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isMoreMenuOpen ? 'bg-blue-600 text-white' : `${theme.muted} ${theme.hover}`}`}
            title="More Toolbar Controls"
          >
            <MoreHorizontal size={18} strokeWidth={2} />
          </button>

          {isMoreMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
              <div className={`absolute ${horizontal ? 'top-10 right-0' : 'bottom-0 left-10'} w-48 backdrop-blur-xl ${darkMode ? 'bg-[#1c2030]/95 text-white border-[#2b3045]' : 'bg-white/95 text-[#131722] border-gray-200'} border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-50 py-1.5 px-1 animate-fade-in flex flex-col gap-1`}>
                <div className="px-2 py-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-b border-inherit mb-1">
                  System Tool Options
                </div>
                <button onClick={() => { if (setDrawings) setDrawings([]); if (showToast) showToast("Cleared all drawings"); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 size={14} />
                  <span>Clear All Drawings</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Slide Arrow - Down / Right */}
      <button 
        onClick={() => handleScroll(horizontal ? 'right' : 'down')}
        className={`w-7 h-4 flex items-center justify-center text-xs opacity-50 hover:opacity-100 transition-opacity ${horizontal ? 'ml-1' : 'mt-1'}`}
        title="Scroll Slide Next"
      >
        {horizontal ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>

    </div>
  );
};
