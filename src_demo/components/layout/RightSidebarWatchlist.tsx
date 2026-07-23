import React from 'react';
import { X } from 'lucide-react';

export const RightSidebarWatchlist = ({
  t,
  livePrice,
  selectedCoin,
  setSelectedCoin,
  watchlist,
  setWatchlist,
  watchlistTickers,
  watchlistSearchInput,
  setWatchlistSearchInput,
  watchlistDropdownOpen,
  setWatchlistDropdownOpen,
  binanceCoins,
  showToast,
  setMarketStatus,
  coinIconUrl,
  handleCoinIconError
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Add Symbol (e.g. ETHUSDT)"
          value={watchlistSearchInput}
          onChange={(e) => {
            setWatchlistSearchInput(e.target.value.toUpperCase());
            setWatchlistDropdownOpen(true);
          }}
          onFocus={() => setWatchlistDropdownOpen(true)}
          className={`w-full px-3 py-1.5 rounded-lg border ${t.border} ${t.bg} ${t.text} text-[11px] outline-none focus:border-blue-500`}
        />
        {watchlistDropdownOpen && watchlistSearchInput && (
          <div className={`absolute top-full left-0 right-0 ${t.bg} border ${t.border} rounded-lg shadow-2xl z-[300] max-h-48 overflow-y-auto py-1`}>
            {binanceCoins
              .filter(c => c.includes(watchlistSearchInput))
              .slice(0, 15)
              .map(coin => (
                <div
                  key={coin}
                  onMouseDown={() => {
                    if (!watchlist.includes(coin)) {
                      setWatchlist(prev => [...prev, coin]);
                      if (showToast) showToast(`Added ${coin} to watchlist`);
                    }
                    setWatchlistSearchInput('');
                    setWatchlistDropdownOpen(false);
                  }}
                  className={`px-3 py-2 text-[11px] font-bold ${t.text} ${t.hover} cursor-pointer`}
                >
                  {coin}
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {watchlist.map(symbol => {
          const ticker = watchlistTickers[symbol];
          const price = ticker?.price ?? (symbol === selectedCoin ? livePrice : 0);
          const change = ticker?.change ?? 0;
          const isSelected = symbol === selectedCoin;
          return (
            <div
              key={symbol}
              onClick={() => {
                setSelectedCoin(symbol);
                if (setMarketStatus) setMarketStatus('Loading');
              }}
              className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                isSelected 
                  ? 'border-blue-500 bg-blue-500/10' 
                  : `border-transparent ${t.hover} ${t.sec}`
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <img 
                  src={coinIconUrl ? coinIconUrl(symbol) : ''}
                  data-tier="0"
                  onError={(e) => { if (handleCoinIconError) handleCoinIconError(e, symbol); }}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover bg-white shrink-0"
                />
                <span className={`font-black text-[11px] truncate ${isSelected ? 'text-blue-400' : t.text}`}>{symbol}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[11px] font-bold ${t.text}`}>
                  {price > 0 ? `$${price.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '...'}
                </span>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded text-white ${
                  change >= 0 ? 'bg-[#089981]' : 'bg-[#F23645]'
                }`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setWatchlist(prev => prev.filter(w => w !== symbol));
                    if (showToast) showToast(`Removed ${symbol} from watchlist`);
                  }}
                  className="text-gray-500 hover:text-red-400 p-0.5 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
