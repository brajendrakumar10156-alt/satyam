import React from 'react';
import { X } from 'lucide-react';
import { RightSidebarWatchlist } from './RightSidebarWatchlist';
import { RightSidebarDetails } from './RightSidebarDetails';

export const RightSidebar = (props) => {
  const { rightSidebar, setRightSidebar, themeConfig: t, OrderBookPanel } = props;

  if (!rightSidebar) return null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden w-[300px] border-l shrink-0 transition-colors duration-200 hidden lg:flex" style={{ borderColor: t.border.replace('border-', ''), backgroundColor: t.bg.replace('bg-', '') }}>
      <div className={`h-11 border-b ${t.border} flex items-center justify-between px-3 ${t.sec} shrink-0`}>
        <span className={`font-bold text-[11px] uppercase tracking-wider ${t.text}`}>
          {rightSidebar === 'watchlist' && 'Watchlist'}
          {rightSidebar === 'details' && 'Instrument Details'}
          {rightSidebar === 'news' && 'Market News'}
          {rightSidebar === 'alerts' && 'Active Alerts'}
          {rightSidebar === 'bounties' && 'Bounties'}
          {rightSidebar === 'orderbook' && 'Order Book & Trades'}
        </span>
        <button onClick={() => setRightSidebar(null)} className={t.muted}><X size={14} /></button>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto dark-scrollbar p-3 space-y-4 ${t.bg}`}>
        {rightSidebar === 'orderbook' && OrderBookPanel && (
          <OrderBookPanel livePrice={props.livePrice} selectedCoin={props.selectedCoin} selectedExchange={props.selectedExchange} />
        )}
        
        {rightSidebar === 'watchlist' && (
          <RightSidebarWatchlist {...props} t={t} />
        )}

        {rightSidebar === 'details' && props.selectedCoinStats && (
          <RightSidebarDetails {...props} t={t} />
        )}

        {/* Other panels (News, Alerts, Bounties) can be extracted similarly later when activated */}
        {rightSidebar === 'news' && (
          <div className="text-[11px] text-gray-500 text-center pt-10">News Component extracted...</div>
        )}
      </div>
    </div>
  );
};
