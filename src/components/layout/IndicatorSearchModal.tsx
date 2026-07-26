import React from 'react';
import { Search } from 'lucide-react';
import { INDICATOR_LIBRARY } from '../../tradingFeatures';

interface IndicatorSearchModalProps {
  indicatorSearchQuery: string;
  setIndicatorSearchQuery: (val: string) => void;
  indicatorCategorySubTab: string;
  setIndicatorCategorySubTab: (val: string) => void;
  selectedIndicatorTab: string;
  setSelectedIndicatorTab: (val: string) => void;
  visualIndicators: any[];
  setVisualIndicators: React.Dispatch<React.SetStateAction<any[]>>;
  showToast: (msg: string) => void;
  injectIndicator: (ind: any, type: string) => void;
  closeModal: () => void;
  t: any;
}

export const IndicatorSearchModal: React.FC<IndicatorSearchModalProps> = ({
  indicatorSearchQuery,
  setIndicatorSearchQuery,
  indicatorCategorySubTab,
  setIndicatorCategorySubTab,
  selectedIndicatorTab,
  setSelectedIndicatorTab,
  visualIndicators,
  setVisualIndicators,
  showToast,
  injectIndicator,
  closeModal,
  t
}) => {
  return (
    <div className="flex flex-col h-[70vh] md:h-[500px] min-h-0 min-w-0">
      {/* Search bar row */}
      <div className="p-3 border-b border-[#2a2e39]/50 flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Search indicators, metrics and strategies..." 
          value={indicatorSearchQuery}
          onChange={(e) => setIndicatorSearchQuery(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder-gray-500 font-medium"
        />
      </div>

      {/* Tabs Selector row */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#2a2e39]/30 text-[11px] font-bold text-gray-400 select-none shrink-0 overflow-x-auto">
        {['Indicators', 'Strategies', 'Profiles', 'Patterns'].map(sub => (
          <button 
            key={sub} 
            onClick={() => setIndicatorCategorySubTab(sub)} 
            className={`px-3 py-1 rounded-full transition-all ${indicatorCategorySubTab === sub ? 'bg-white text-black' : 'hover:bg-gray-800 hover:text-white'}`}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* Body grid */}
      <div className="flex flex-1 min-h-0 min-w-0">
        {/* Left Sidebar */}
        <div className="w-[180px] md:w-[220px] border-r border-[#2a2e39]/50 overflow-y-auto p-2 flex flex-col gap-3.5 select-none shrink-0 font-semibold">
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider px-2.5 mb-1.5">Personal</div>
            {['My scripts', 'Purchased'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setSelectedIndicatorTab(tab)} 
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : `text-gray-400 ${t.hover}`}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div>
            <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider px-2.5 mb-1.5">Built-In</div>
            {['Technicals', 'Fundamentals'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setSelectedIndicatorTab(tab)} 
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : `text-gray-400 ${t.hover}`}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div>
            <div className="text-[10px] text-gray-500 uppercase font-extrabold tracking-wider px-2.5 mb-1.5">Community</div>
            {["Editors' picks", 'Top', 'Trending', 'Store'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setSelectedIndicatorTab(tab)} 
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11.5px] transition-colors ${selectedIndicatorTab === tab ? 'bg-blue-500/10 text-blue-400 font-bold' : `text-gray-400 ${t.hover}`}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Right Results list */}
        <div className="flex-1 overflow-y-auto dark-scrollbar p-3 space-y-1">
          {/* Filter results based on left tab selection and search query */}
          {selectedIndicatorTab === 'Technicals' && indicatorCategorySubTab === 'Indicators' && (
            <>
              <div className="text-[10.5px] text-gray-500 font-extrabold px-1.5 py-1 uppercase tracking-wider select-none">Active Technical Indicators</div>
              {visualIndicators
                .filter(ind => ind.name.toLowerCase().includes(indicatorSearchQuery.toLowerCase()))
                .map(ind => (
                  <div key={ind.id} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-800/40 transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ind.color }} />
                      <span className="font-extrabold text-[12px] text-gray-200">{ind.name}</span>
                      <span className="text-[10px] text-gray-500 font-mono">({ind.type.toUpperCase()})</span>
                    </div>
                    <button 
                      onClick={() => {
                        setVisualIndicators(prev => prev.map(p => p.id === ind.id ? { ...p, visible: !p.visible } : p));
                        showToast(`${ind.name} ${!ind.visible ? 'enabled' : 'disabled'}`);
                      }}
                      className={`px-3 py-1 rounded text-[11px] font-bold transition-all ${ind.visible ? 'bg-green-500/15 text-green-400 hover:bg-green-500/25' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                    >
                      {ind.visible ? 'Active' : 'Add'}
                    </button>
                  </div>
                ))}
            </>
          )}

          {/* Pine strategies */}
          {(selectedIndicatorTab !== 'Technicals' || indicatorCategorySubTab === 'Strategies') && (
            <>
              <div className="text-[10.5px] text-gray-500 font-extrabold px-1.5 py-1 uppercase tracking-wider select-none">Pine Script Strategies ({selectedIndicatorTab})</div>
              {INDICATOR_LIBRARY
                .filter(ind => ind.name.toLowerCase().includes(indicatorSearchQuery.toLowerCase()))
                .map(ind => (
                  <div key={ind.name} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-gray-800/40 transition-colors group font-bold">
                    <div className="flex flex-col">
                      <span className="text-[12px] text-gray-200">{ind.name}</span>
                      <span className="text-[10px] text-gray-500 font-medium line-clamp-1">{ind.desc}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => { injectIndicator(ind, 'pine'); closeModal(); }}
                        className="px-2.5 py-1 rounded bg-[#7C5CFF]/15 text-[#7C5CFF] hover:bg-[#7C5CFF]/25 text-[11px] font-bold transition-all"
                      >
                        + Pine
                      </button>
                      <button 
                        onClick={() => { injectIndicator(ind, 'python'); closeModal(); }}
                        className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 text-[11px] font-bold transition-all"
                      >
                        + Python
                      </button>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
