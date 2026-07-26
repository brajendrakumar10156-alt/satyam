import React from 'react';
import { Calendar } from 'lucide-react';

export const ChartBottomBar = ({ darkMode, applyTimeRange, showToast }: any) => {
  return (
    <div className={`shrink-0 w-full flex items-center justify-between px-2 py-0.5 ${darkMode ? 'bg-[#131722]' : 'bg-[#ffffff]'} border-t ${darkMode ? 'border-[#2a2e39]' : 'border-gray-200'} select-none z-20`}>
      {/* Left: Date Range */}
      <div className="flex items-center gap-1 text-[10px] font-bold text-[#787b86]">
        {['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'].map(range => (
          <button 
            key={range} 
            onClick={() => applyTimeRange(range)} 
            className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`}
          >
            {range}
          </button>
        ))}
        <button onClick={() => showToast("Select date range...")} className={`hover:text-black dark:hover:text-[#d1d4dc] transition-colors p-0.5 ml-1`} title="Select custom range">
          <Calendar size={11} />
        </button>
      </div>
      
      {/* Right: Time and Options */}
      <div className="flex items-center gap-2 text-[10.5px] font-bold text-[#787b86]">
        <span className="font-mono">{new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} <span className="opacity-70">UTC</span></span>
        <span className={`h-3 w-px ${darkMode ? 'bg-[#2a2e39]' : 'bg-gray-300'} mx-1`} />
        <button className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`} title="Percentage Scale">%</button>
        <button className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`} title="Logarithmic Scale">log</button>
        <button className={`px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'hover:bg-[#2a2e39] hover:text-[#d1d4dc]' : 'hover:bg-gray-100 hover:text-black'}`} title="Auto Scale">auto</button>
      </div>
    </div>
  );
};
