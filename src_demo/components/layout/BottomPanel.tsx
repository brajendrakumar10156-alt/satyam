import React from 'react';

export const BottomPanel = ({
  darkMode,
  themeConfig,
  lowerBoxState,
  setLowerBoxState,
  activeTab,
  setActiveTab
}) => {
  const t = themeConfig;

  if (lowerBoxState === 'hidden') return null;

  return (
    <div 
      className={`w-full ${t.bg} flex flex-col min-h-0 transition-all duration-300 border-t ${t.border} shadow-lg z-10`}
    >
      <div className={`min-h-[42px] flex items-center justify-between px-3 md:px-4 shrink-0 ${t.bg} transition-colors duration-200 gap-2`}>
        {/* Extracted Bottom Panel Content goes here */}
        <div className={`font-bold text-[13px] ${t.text}`}>Strategy Tester</div>
      </div>
    </div>
  );
};
