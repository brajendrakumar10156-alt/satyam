import React from 'react';
import { RefreshCw } from 'lucide-react';

export const RightSidebarDetails = ({
  t,
  selectedCoin,
  selectedCoinStats,
  selectedExchange,
  fearGreedIndex,
  livePrice,
  priceColor,
  getBaseAsset,
  isPerpetualSymbol,
  futuresLoading,
  fundingRate,
  openInterest,
  formatShortNumber,
  fundamentalsLoading,
  fundamentalsError,
  coinFundamentals,
  formatUSD,
  coinIconUrl,
  handleCoinIconError,
  getFngColor
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4 border-b border-[#2a2e39]/20">
        <img 
          src={coinIconUrl ? coinIconUrl(selectedCoin) : ''} 
          data-tier="0"
          onError={(e) => { if (handleCoinIconError) handleCoinIconError(e, selectedCoin); }}
          className="w-12 h-12 rounded-full object-cover bg-white mb-2 shadow-lg"
          alt=""
        />
        <h4 className={`text-[14px] font-black ${t.text}`}>{selectedCoin}</h4>
        <span className={`text-[11px] ${t.muted}`}>Instrument Details</span>
      </div>

      {fearGreedIndex && (
        <div className={`p-3 rounded-lg border ${t.border} ${t.sec} space-y-2`}>
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
            <span>MARKET SENTIMENT</span>
            <span className="text-[9px] font-normal uppercase text-gray-500">Updates Daily</span>
          </div>
          <div className="flex justify-between items-end">
            <span className={`text-[12px] font-black`} style={{ color: getFngColor ? getFngColor(fearGreedIndex.value) : 'white' }}>
              {fearGreedIndex.classification}
            </span>
            <span className="text-[15px] font-mono font-black text-white">{fearGreedIndex.value}</span>
          </div>
          <div className="relative h-1.5 w-full rounded-full bg-gradient-to-r from-[#f23645] via-[#ffb300] to-[#00c853] overflow-hidden">
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white border border-black shadow"
              style={{ left: `${fearGreedIndex.value}%`, transform: 'translateX(-50%)' }}
            />
          </div>
        </div>
      )}

      {selectedCoinStats && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">24H Price Stats</div>
          <div className="space-y-1.5">
            {[
              { label: 'Current Price', value: `$${livePrice.toLocaleString()}`, color: priceColor },
              { label: '24h Change', value: `${selectedCoinStats.priceChangePercent >= 0 ? '+' : ''}${selectedCoinStats.priceChangePercent.toFixed(2)}%`, color: selectedCoinStats.priceChangePercent >= 0 ? '#089981' : '#F23645' },
              { label: '24h High', value: `$${selectedCoinStats.high.toLocaleString()}` },
              { label: '24h Low', value: `$${selectedCoinStats.low.toLocaleString()}` },
              { label: '24h Base Volume', value: `${selectedCoinStats.volume.toLocaleString(undefined, {maximumFractionDigits:0})} ${getBaseAsset ? getBaseAsset(selectedCoin) : ''}` },
              { label: '24h Quote Volume', value: `$${selectedCoinStats.quoteVolume.toLocaleString(undefined, {maximumFractionDigits:0})}` }
            ].map(stat => (
              <div key={stat.label} className="flex justify-between items-center py-1 border-b border-[#2a2e39]/5 text-[11px]">
                <span className={t.muted}>{stat.label}</span>
                <span className="font-bold font-mono" style={{ color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPerpetualSymbol && isPerpetualSymbol(selectedCoin) && (
        <div className="space-y-2 pt-1 border-t border-[#2a2e39]/10">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center justify-between">
            <span>Futures Derivatives</span>
            {futuresLoading && <RefreshCw size={10} className="animate-spin text-blue-500" />}
          </div>
          <div className="space-y-1.5">
            {[
              { 
                label: 'Funding Rate', 
                value: fundingRate !== null ? `${(fundingRate * 100).toFixed(4)}%` : 'N/A', 
                color: fundingRate > 0 ? '#F23645' : fundingRate < 0 ? '#089981' : undefined 
              },
              { 
                label: 'Open Interest', 
                value: openInterest !== null ? `${formatShortNumber ? formatShortNumber(openInterest) : openInterest} ${getBaseAsset ? getBaseAsset(selectedCoin) : ''}` : 'N/A' 
              }
            ].map(stat => (
              <div key={stat.label} className="flex justify-between items-center py-1 border-b border-[#2a2e39]/5 text-[11px]">
                <span className={t.muted}>{stat.label}</span>
                <span className="font-bold font-mono" style={{ color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-1 border-t border-[#2a2e39]/10">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Coin Fundamentals</div>
        {fundamentalsLoading ? (
          <div className="flex flex-col items-center py-4 text-gray-500 gap-1">
            <RefreshCw size={14} className="animate-spin text-blue-500" />
            <span className="text-[9px] font-bold">Fetching CoinGecko...</span>
          </div>
        ) : fundamentalsError ? (
          <div className={`p-2.5 text-center text-[10px] ${t.muted} border ${t.border} rounded-lg ${t.sec}`}>
            Fundamentals unavailable
          </div>
        ) : coinFundamentals ? (
          <div className="space-y-1.5">
            {[
              { label: 'Market Cap', value: formatUSD ? formatUSD(coinFundamentals.market_data?.market_cap?.usd) : '' },
              { label: 'Circulating Supply', value: `${formatShortNumber ? formatShortNumber(coinFundamentals.market_data?.circulating_supply) : ''} ${getBaseAsset ? getBaseAsset(selectedCoin) : ''}` },
              { label: 'Total Supply', value: coinFundamentals.market_data?.total_supply ? `${formatShortNumber ? formatShortNumber(coinFundamentals.market_data?.total_supply) : ''} ${getBaseAsset ? getBaseAsset(selectedCoin) : ''}` : 'N/A' },
              { label: 'Max Supply', value: coinFundamentals.market_data?.max_supply ? `${formatShortNumber ? formatShortNumber(coinFundamentals.market_data?.max_supply) : ''} ${getBaseAsset ? getBaseAsset(selectedCoin) : ''}` : 'Infinite' },
              { 
                label: 'All-Time High', 
                value: coinFundamentals.market_data?.ath?.usd 
                  ? `$${coinFundamentals.market_data.ath.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` 
                  : 'N/A' 
              },
              { 
                label: 'All-Time Low', 
                value: coinFundamentals.market_data?.atl?.usd 
                  ? `$${coinFundamentals.market_data.atl.usd.toLocaleString(undefined, { maximumFractionDigits: 6 })}` 
                  : 'N/A' 
              },
            ].map(stat => (
              <div key={stat.label} className="flex justify-between items-center py-1 border-b border-[#2a2e39]/5 text-[11px]">
                <span className={t.muted}>{stat.label}</span>
                <span className="font-bold font-mono text-[#e0e3eb]">{stat.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-2.5 text-center text-[10px] ${t.muted} border ${t.border} rounded-lg ${t.sec}`}>
            No fundamentals found
          </div>
        )}
      </div>

      {coinFundamentals && coinFundamentals.description?.en && (
        <div className={`p-3 rounded-lg border ${t.border} ${t.sec} space-y-1`}>
          <div className="text-[10px] font-bold text-gray-400 uppercase">PROJECT SUMMARY</div>
          <p className="text-[10px] text-gray-400 leading-normal">
            {(() => {
              const cleanDesc = coinFundamentals.description.en.replace(/<[^>]*>/g, '');
              const sentences = cleanDesc.match(/[^.!?]+[.!?]+(\s|$)/g);
              if (sentences && sentences.length > 0) {
                return sentences.slice(0, 3).join('').trim();
              }
              return cleanDesc.slice(0, 180) + (cleanDesc.length > 180 ? '...' : '');
            })()}
          </p>
        </div>
      )}

      {coinFundamentals && coinFundamentals.links && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#2a2e39]/10">
          {coinFundamentals.links.homepage?.[0] && (
            <a 
              href={coinFundamentals.links.homepage[0]} 
              target="_blank" 
              rel="noreferrer"
              className="text-[9.5px] font-extrabold px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/15 hover:bg-blue-500/20 transition-all shrink-0"
            >
              Website
            </a>
          )}
          {coinFundamentals.links.blockchain_site?.[0] && (
            <a 
              href={coinFundamentals.links.blockchain_site[0]} 
              target="_blank" 
              rel="noreferrer"
              className="text-[9.5px] font-extrabold px-2 py-1 rounded bg-[#ea39ff]/10 text-[#ea39ff] border border-[#ea39ff]/15 hover:bg-[#ea39ff]/20 transition-all shrink-0"
            >
              Explorer
            </a>
          )}
        </div>
      )}
    </div>
  );
};
