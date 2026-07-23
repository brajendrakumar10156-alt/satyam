import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, LogOut, RefreshCw, Search, Star, TrendingUp, HelpCircle, ArrowUpRight, ArrowDownRight, Eye } from 'lucide-react';
import { EXCHANGE_LIST, fetchExchangeSymbols } from './exchanges';
import { getLocalCoinList, saveLocalCoinList } from './db/indexedDB';

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? `http://${window.location.hostname}:8000`;
const PAGE_SIZE = 60;

// Helper to read watchlist from local storage by tab number
function readWatchList(tabId) {
  try {
    const key = tabId === '1' ? 'watchList' : `watchList_${tabId}`;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function parseSymbolParts(symbol) {
  const upper = String(symbol || '').toUpperCase();
  const quotes = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'BTC', 'ETH', 'BNB', 'EUR', 'USD'];
  for (const quote of quotes) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return { base: upper.slice(0, -quote.length), quote };
    }
  }
  return { base: upper, quote: '' };
}

function CoinSelectPage({ onOpenChart, onLogout }) {
  const [selectedExchange, setSelectedExchange] = useState(() => {
    const saved = localStorage.getItem('exchange');
    return EXCHANGE_LIST.some((exchange) => exchange.id === saved) ? saved : 'binance';
  });

  const [exchangeMode, setExchangeMode] = useState(() => {
    return localStorage.getItem('exchangeMode') || 'all';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [coins, setCoins] = useState([]);
  const [coinsLoading, setCoinsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('1'); // '1' to '5' are custom watchlists, 'all' is all pairs
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeCoinId, setActiveCoinId] = useState(null); // Selected coin ID (e.g. BTCUSDT-binance)

  // 5 independent, fully customizable watchlists (Zerodha Kite style)
  const [watchLists, setWatchLists] = useState({
    '1': readWatchList('1'),
    '2': readWatchList('2'),
    '3': readWatchList('3'),
    '4': readWatchList('4'),
    '5': readWatchList('5')
  });

  // Live tickers state
  const [tickerData, setTickerData] = useState({ buffer: new Float32Array(0), indexMap: new Map() });

  // Fetch live prices from Binance 24h ticker API
  useEffect(() => {
    let active = true;
    async function loadTickers() {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const data = await res.json();
        if (!active) return;
        if (Array.isArray(data)) {
          const buffer = new Float32Array(data.length * 7);
          const indexMap = new Map();
          for (let i = 0; i < data.length; i++) {
            const t = data[i];
            indexMap.set(t.symbol, i);
            buffer[i * 7 + 0] = parseFloat(t.lastPrice) || 0;
            buffer[i * 7 + 1] = parseFloat(t.priceChangePercent) || 0;
            buffer[i * 7 + 2] = parseFloat(t.highPrice) || 0;
            buffer[i * 7 + 3] = parseFloat(t.lowPrice) || 0;
            buffer[i * 7 + 4] = parseFloat(t.openPrice) || 0;
            buffer[i * 7 + 5] = parseFloat(t.volume) || 0;
            buffer[i * 7 + 6] = parseFloat(t.quoteVolume) || 0;
          }
          setTickerData({ buffer, indexMap });
        }
      } catch (e) {
        console.warn("Failed to load live tickers:", e);
      }
    }
    loadTickers();
    const intervalId = setInterval(loadTickers, 10000); // Poll every 10s for higher accuracy
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  // Helper to fetch price, change% and stats for any coin (live or fallback)
  const getTickerInfo = useMemo(() => {
    return (symbol) => {
      const clean = String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const idx = tickerData.indexMap.get(clean);
      if (idx !== undefined) {
        const base = idx * 7;
        return {
          price: tickerData.buffer[base + 0],
          change: tickerData.buffer[base + 1],
          high: tickerData.buffer[base + 2],
          low: tickerData.buffer[base + 3],
          open: tickerData.buffer[base + 4],
          volume: tickerData.buffer[base + 5],
          quoteVolume: tickerData.buffer[base + 6]
        };
      }
      // Deterministic mock prices so all non-binance pairs have realistic data
      const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mockPrice = ((seed * 7) % 350) + 1.45;
      const mockChange = (Math.sin(seed * 0.1) * 3.8);
      return {
        price: mockPrice,
        change: mockChange,
        high: mockPrice * 1.025,
        low: mockPrice * 0.975,
        open: mockPrice * (1 - mockChange / 100),
        volume: seed * 980,
        quoteVolume: seed * 980 * mockPrice
      };
    };
  }, [tickerData]);

  useEffect(() => {
    // Clear old symbol cache to ensure new proxied data loads correctly
    if (!localStorage.getItem('symbols_cache_reset_v2')) {
      EXCHANGE_LIST.forEach(ex => {
        localStorage.removeItem(`cadpro_symbols_cache_${ex.id}`);
        localStorage.removeItem(`satyam_ai_terminal_symbols_cache_${ex.id}`);
      });
      localStorage.setItem('symbols_cache_reset_v2', '1');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('exchange', selectedExchange);
    localStorage.setItem('exchangeMode', exchangeMode);

    let mounted = true;
    async function loadCoins() {
      setCoinsLoading(true);
      try {
        const cacheKey = `COIN_LIST_${exchangeMode}_${selectedExchange}`;
        
        // 1. Try Virtual RAM (IndexedDB)
        const cachedList = await getLocalCoinList(cacheKey);
        if (cachedList && cachedList.length > 0) {
          if (mounted) {
            setCoins(cachedList);
            if (!activeCoinId) setActiveCoinId(cachedList[0].id);
            setCoinsLoading(false); // Instant render!
          }
        }

        // 2. Background Sync
        const exchangeIds = exchangeMode === 'all' ? EXCHANGE_LIST.map((e) => e.id) : [selectedExchange];

        const exchangeResults = await Promise.allSettled(
          exchangeIds.map(async (id) => {
            const syms = await fetchExchangeSymbols(id);
            return { id, symbols: syms || [] };
          })
        );
        if (!mounted) return;

        const combined = [];
        for (const res of exchangeResults) {
          if (res.status === 'fulfilled') {
            const { id: exchangeId, symbols } = res.value;
            for (const sym of symbols) {
              const cleanSymbol = String(sym).toUpperCase();
              combined.push({
                id: `${cleanSymbol}-${exchangeId}`,
                symbol: cleanSymbol,
                exchange: exchangeId
              });
            }
          }
        }

        // Also add backend coins if applicable
        if (exchangeMode === 'all' || selectedExchange === 'binance') {
          try {
            const backendController = new AbortController();
            const backendTimeout = setTimeout(() => backendController.abort(), 1200);
            const res = await fetch(`${API_BASE}/coins`, { signal: backendController.signal });
            const data = await res.json();
            const backendCoins = data.coins || [];
            clearTimeout(backendTimeout);
            for (const sym of backendCoins) {
              const cleanSymbol = String(sym).toUpperCase();
              const exists = combined.some(c => c.symbol === cleanSymbol && c.exchange === 'binance');
              if (!exists) {
                combined.push({
                  id: `${cleanSymbol}-binance`,
                  symbol: cleanSymbol,
                  exchange: 'binance'
                });
              }
            }
          } catch (e) {
            console.warn("Backend coins fetch failed:", e);
          }
        }

        // Sort combined list alphabetically by symbol
        combined.sort((a, b) => a.symbol.localeCompare(b.symbol));
        
        // 3. Save updated list back to Virtual RAM
        await saveLocalCoinList(cacheKey, combined);
        
        if (mounted) {
          setCoins(combined);
          if (combined.length > 0 && !activeCoinId) {
            setActiveCoinId(combined[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load coins:', err);
        if (mounted) setCoins([]);
      } finally {
        if (mounted) setCoinsLoading(false);
      }
    }

    loadCoins();
    return () => {
      mounted = false;
    };
  }, [selectedExchange, exchangeMode]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchQuery, selectedExchange]);

  const filteredCoins = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    let result = coins;

    // Filter by active custom watchlist (tab 1-5) or show all
    if (activeTab !== 'all') {
      const activeWatchListSymbols = watchLists[activeTab] || [];
      result = result.filter((coin) => activeWatchListSymbols.includes(coin.symbol));
    }

    if (q) {
      result = result
        .filter((coin) => coin.symbol.includes(q))
        .sort((a, b) => {
          const aStarts = a.symbol.startsWith(q) ? 0 : 1;
          const bStarts = b.symbol.startsWith(q) ? 0 : 1;
          if (aStarts !== bStarts) return aStarts - bStarts;
          return a.symbol.localeCompare(b.symbol);
        });
    }

    return result;
  }, [activeTab, coins, searchQuery, watchLists]);

  const visibleCoins = filteredCoins.slice(0, visibleCount);

  // Toggle coin in the currently active watchlist
  function toggleWatchList(symbol, event) {
    event.stopPropagation();
    // Default to watchlist 1 if star clicked while in "All Pairs" tab
    const targetListKey = activeTab === 'all' ? '1' : activeTab;
    
    setWatchLists((prev) => {
      const list = prev[targetListKey] || [];
      const updated = list.includes(symbol)
        ? list.filter((item) => item !== symbol)
        : [...list, symbol];
        
      const newWatchLists = { ...prev, [targetListKey]: updated };
      
      const storageKey = targetListKey === '1' ? 'watchList' : `watchList_${targetListKey}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return newWatchLists;
    });
  }

  function openChart(symbol, exchangeId, quickSide = null) {
    localStorage.setItem('selectedCoin', symbol);
    localStorage.setItem('exchange', exchangeId || selectedExchange);
    localStorage.setItem('startRoute', 'chart');
    if (quickSide) {
      localStorage.setItem('quickTradingPanelSide', quickSide);
    } else {
      localStorage.removeItem('quickTradingPanelSide');
    }
    onOpenChart?.({ selectedExchange: exchangeId || selectedExchange, selectedCoin: symbol });
  }

  function handleScroll(event) {
    const el = event.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom && visibleCount < filteredCoins.length) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredCoins.length));
    }
  }

  // Get currently selected active coin info
  const activeCoinInfo = useMemo(() => {
    return coins.find(c => c.id === activeCoinId) || null;
  }, [coins, activeCoinId]);

  // Pre-seed mock Bid/Ask orderbook level data based on price
  const marketDepth = useMemo(() => {
    if (!activeCoinInfo) return null;
    const ticker = getTickerInfo(activeCoinInfo.symbol);
    const p = ticker.price;
    const seed = activeCoinInfo.symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const bids = [];
    const asks = [];
    let bidSum = 0;
    let askSum = 0;

    for (let i = 1; i <= 5; i++) {
      const bidPrice = p - (i * (p * 0.00015));
      const askPrice = p + (i * (p * 0.00015));
      const bidQty = ((seed * i * 4) % 18 + 2) / 10 + 0.02;
      const askQty = ((seed * i * 6) % 22 + 2) / 10 + 0.02;
      const bidOrders = (seed + i) % 3 + 1;
      const askOrders = (seed * i) % 3 + 1;

      bids.push({ price: bidPrice, qty: bidQty, orders: bidOrders });
      asks.push({ price: askPrice, qty: askQty, orders: askOrders });
      bidSum += bidQty;
      askSum += askQty;
    }

    return { bids, asks, bidSum, askSum };
  }, [activeCoinInfo, getTickerInfo]);

  // Calculate Bid/Ask Depth percentages
  const depthRatios = useMemo(() => {
    if (!marketDepth) return { bidPct: 50, askPct: 50 };
    const total = marketDepth.bidSum + marketDepth.askSum;
    if (total === 0) return { bidPct: 50, askPct: 50 };
    const bidPct = (marketDepth.bidSum / total) * 100;
    return { bidPct, askPct: 100 - bidPct };
  }, [marketDepth]);

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#1f1f1f] text-[#e0e0e0] flex font-sans select-none text-[13px]">
      
      {/* LEFT PANEL: Watchlist Sidebar */}
      <div className="w-[380px] md:w-[410px] shrink-0 border-r border-[#292929] bg-[#191919] flex flex-col z-10">
        
        {/* Search Bar */}
        <div className="p-3 bg-[#191919] border-b border-[#292929] relative">
          <input
            type="text"
            placeholder="Search eg: btc usdt, eth, sol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 px-3 pr-8 rounded bg-[#1e1e1e] border border-[#292929] text-white text-[12.5px] placeholder-[#666] outline-none focus:border-[#ff5722]/50 transition-colors"
          />
          <Search size={13} className="absolute right-6 top-1/2 -translate-y-1/2 text-[#555]" />
        </div>

        {/* Kite-style numeric Watchlist Tabs (WL 1 - 5 are customizable lists) */}
        <div className="flex border-b border-[#292929] text-[11px] bg-[#191919] text-[#808080] font-semibold divide-x divide-[#292929]/50">
          {[
            { id: '1', label: `1 (${watchLists['1'].length})` },
            { id: '2', label: `2 (${watchLists['2'].length})` },
            { id: '3', label: `3 (${watchLists['3'].length})` },
            { id: '4', label: `4 (${watchLists['4'].length})` },
            { id: '5', label: `5 (${watchLists['5'].length})` },
            { id: 'all', label: 'All Pairs' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'all') {
                  setExchangeMode('all');
                }
              }}
              className={`flex-1 py-2 text-center transition-all ${activeTab === tab.id ? 'text-[#ff5722] bg-[#222222] font-black border-b border-[#ff5722]' : 'hover:text-white hover:bg-[#1e1e1e]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Instruments Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#292929] bg-[#191919]" onScroll={handleScroll}>
          {coinsLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[#808080]">
              <RefreshCw className="w-4 h-4 animate-spin text-[#ff5722] mb-2" />
              <div className="text-[11.5px]">Fetching market instruments...</div>
            </div>
          ) : filteredCoins.length === 0 ? (
            <div className="py-20 text-center text-[#666] text-[12px] px-4">
              {activeTab !== 'all' ? `Watchlist ${activeTab} is empty. Use Star to add symbols.` : 'No matching symbols found.'}
            </div>
          ) : (
            visibleCoins.map((coin) => {
              const ticker = getTickerInfo(coin.symbol);
              const isUp = ticker.change >= 0;
              const isSelected = activeCoinId === coin.id;
              const inWatchlist = watchLists[activeTab === 'all' ? '1' : activeTab]?.includes(coin.symbol);
              const parts = parseSymbolParts(coin.symbol);

              return (
                <div
                  key={coin.id}
                  onClick={() => setActiveCoinId(coin.id)}
                  className={`relative flex items-center justify-between px-4 py-3 cursor-pointer group transition-all duration-150 border-l-[3px] ${isSelected ? 'bg-[#222222] border-l-[#ff5722]' : 'hover:bg-[#1d1d1d] border-l-transparent'}`}
                >
                  {/* Symbol & Exchange tag (Dynamic badges!) */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[13px] font-bold tracking-tight ${isUp ? 'text-[#4caf50]' : 'text-[#ef5350]'}`}>
                        {coin.symbol}
                      </span>
                      <span className="text-[8.5px] text-[#4184f3] font-black border border-[#4184f3]/20 px-1 rounded uppercase tracking-wider shrink-0 bg-[#4184f3]/5">
                        {coin.exchange}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#808080] font-semibold uppercase mt-0.5 tracking-wide">
                      {parts.base} Spot contract
                    </div>
                  </div>

                  {/* Pricing / Action buttons */}
                  <div className="flex items-center text-right shrink-0">
                    
                    {/* Default Pricing views */}
                    <div className="group-hover:hidden text-[12px] font-bold font-mono">
                      <div className={isUp ? 'text-[#4caf50]' : 'text-[#ef5350]'}>
                        {ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </div>
                      <div className="text-[10px] text-[#808080] font-semibold mt-0.5">
                        {isUp ? '+' : ''}{ticker.change.toFixed(2)}%
                      </div>
                    </div>

                    {/* Kite Hover Actions Overlay */}
                    <div className="hidden group-hover:flex items-center gap-1.5 bg-[#191919] p-0.5 rounded border border-[#292929] shadow-xl">
                      <button
                        onClick={(e) => { e.stopPropagation(); openChart(coin.symbol, coin.exchange, 'BUY'); }}
                        className="bg-[#387ed1] hover:bg-[#2b6ebf] text-white text-[10px] font-black px-2.5 py-1 rounded shadow-sm transition-colors"
                      >
                        B
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openChart(coin.symbol, coin.exchange, 'SELL'); }}
                        className="bg-[#df514c] hover:bg-[#c93f3a] text-white text-[10px] font-black px-2.5 py-1 rounded shadow-sm transition-colors"
                      >
                        S
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openChart(coin.symbol, coin.exchange); }}
                        className="bg-[#2a2a2a] hover:bg-[#383838] text-gray-200 p-1 rounded transition-colors"
                        title="Open Interactive Chart"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={(e) => toggleWatchList(coin.symbol, e)}
                        className={`p-1 rounded transition-colors ${inWatchlist ? 'text-amber-400' : 'text-[#666] hover:text-white'}`}
                        title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                      >
                        <Star size={12} fill={inWatchlist ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Left Side Status Footer */}
        <div className="p-3 bg-[#111] border-t border-[#292929] text-[10px] font-bold text-[#666] flex items-center justify-between uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#4caf50] rounded-full animate-pulse" />
            <span>Kite core connected</span>
          </div>
          <span>{coins.length} Pairs</span>
        </div>
      </div>

      {/* RIGHT PANEL: Details, Market Depth & Circuits Stats */}
      <div className="flex-1 bg-[#1f1f1f] flex flex-col overflow-y-auto">
        
        {/* Upper Dashboard Header */}
        <header className="border-b border-[#292929] px-6 py-3.5 bg-[#1a1a1a] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#ff5722] rounded-sm shrink-0" />
            <span className="font-extrabold text-[12.5px] text-white tracking-widest uppercase">SATYAM AI Terminal</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#262626] border border-[#333] px-2 py-1 rounded">
              <span className="text-[10px] text-[#808080] font-bold uppercase">Exchange filter:</span>
              <select
                value={exchangeMode}
                onChange={(e) => setExchangeMode(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-white outline-none border-none cursor-pointer"
              >
                <option value="single">Single Exchange</option>
                <option value="all">All Exchanges</option>
              </select>
            </div>

            {exchangeMode === 'single' && (
              <select
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="bg-[#262626] border border-[#333] text-[11px] font-bold py-1 px-2 rounded text-white outline-none cursor-pointer"
              >
                {EXCHANGE_LIST.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name.toUpperCase()}</option>
                ))}
              </select>
            )}

            <button
              onClick={onLogout}
              className="text-[#99] hover:text-white p-1 rounded bg-[#262626] border border-[#333] flex items-center gap-1.5 text-[11px] font-extrabold transition-colors"
            >
              <LogOut size={12} />
              SIGN OUT
            </button>
          </div>
        </header>

        {activeCoinInfo ? (
          <div className="p-6 max-w-[880px] space-y-6">
            
            {/* Summary Widget Block */}
            <div className="flex flex-wrap justify-between items-center bg-[#191919] border border-[#292929] p-5 rounded-md relative shadow-sm">
              <div className="absolute top-0 left-0 bottom-0 w-[4px] bg-[#ff5722]" />
              <div className="pl-2">
                <h2 className="text-[20px] font-black text-white tracking-tight flex items-center gap-2">
                  {activeCoinInfo.symbol}
                  <span className="text-[10px] text-[#4184f3] font-bold border border-[#4184f3]/25 px-1.5 py-0.5 rounded uppercase tracking-wider bg-[#4184f3]/5">
                    {activeCoinInfo.exchange} Spot
                  </span>
                </h2>
                <div className="text-[11px] text-[#808080] font-bold uppercase tracking-wider mt-1">
                  Contract Base Token: {parseSymbolParts(activeCoinInfo.symbol).base}
                </div>
              </div>

              {/* Price Details */}
              <div className="text-right">
                <div className={`text-[25px] font-black font-mono leading-none ${getTickerInfo(activeCoinInfo.symbol).change >= 0 ? 'text-[#4caf50]' : 'text-[#ef5350]'}`}>
                  ${getTickerInfo(activeCoinInfo.symbol).price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </div>
                <div className="flex items-center justify-end gap-1 mt-1.5">
                  {getTickerInfo(activeCoinInfo.symbol).change >= 0 ? <ArrowUpRight size={13} className="text-[#4caf50]" /> : <ArrowDownRight size={13} className="text-[#ef5350]" />}
                  <span className={`text-[12.5px] font-extrabold ${getTickerInfo(activeCoinInfo.symbol).change >= 0 ? 'text-[#4caf50]' : 'text-[#ef5350]'}`}>
                    {getTickerInfo(activeCoinInfo.symbol).change >= 0 ? '+' : ''}{getTickerInfo(activeCoinInfo.symbol).change.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Trading Buy/Sell buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => openChart(activeCoinInfo.symbol, activeCoinInfo.exchange, 'BUY')}
                className="flex-1 h-11 bg-[#387ed1] hover:bg-[#2b6ebf] text-white rounded font-bold text-[12.5px] tracking-wider transition-colors shadow-sm"
              >
                BUY MARKET ORDER (B)
              </button>
              <button
                onClick={() => openChart(activeCoinInfo.symbol, activeCoinInfo.exchange, 'SELL')}
                className="flex-1 h-11 bg-[#df514c] hover:bg-[#c93f3a] text-white rounded font-bold text-[12.5px] tracking-wider transition-colors shadow-sm"
              >
                SELL MARKET ORDER (S)
              </button>
              <button
                onClick={() => openChart(activeCoinInfo.symbol, activeCoinInfo.exchange)}
                className="px-6 h-11 bg-[#262626] hover:bg-[#333] text-gray-200 border border-[#333] rounded font-bold text-[12.5px] tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                <TrendingUp size={14} />
                Open Live Chart
              </button>
            </div>

            {/* Zerodha Kite Level-2 Market Depth Table */}
            {marketDepth && (
              <div className="bg-[#191919] border border-[#292929] rounded overflow-hidden">
                <div className="px-4 py-3 border-b border-[#292929] bg-[#1c1c1c] text-[11px] font-bold uppercase tracking-wider text-[#808080]">
                  Market Depth (Level-2 Orderbook)
                </div>
                
                <div className="grid grid-cols-2 divide-x divide-[#292929] text-[12px]">
                  {/* BIDS Column */}
                  <div>
                    <div className="grid grid-cols-[100px_1fr_60px] gap-2 px-3 py-2 border-b border-[#292929]/80 text-[#666] font-bold text-[10px] uppercase">
                      <div>Bid Price</div>
                      <div className="text-right">Orders</div>
                      <div className="text-right">Quantity</div>
                    </div>
                    <div className="divide-y divide-[#292929]/40 font-mono">
                      {marketDepth.bids.map((b, idx) => {
                        const widthPct = Math.min(100, (b.qty / marketDepth.bidSum) * 160);
                        return (
                          <div key={idx} className="grid grid-cols-[100px_1fr_60px] gap-2 px-3 py-2 relative text-[#4caf50] font-bold">
                            <div className="absolute left-0 top-0 bottom-0 bg-[#4caf50]/5 pointer-events-none" style={{ width: `${widthPct}%` }} />
                            <div className="z-10">${b.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                            <div className="text-right text-[#666] z-10">{b.orders}</div>
                            <div className="text-right text-[#e0e0e0] font-semibold z-10">{b.qty.toFixed(3)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-[100px_1fr_60px] gap-2 px-3 py-2 border-t border-[#292929] bg-[#161616] text-[#666] font-bold text-[11px]">
                      <div>Total</div>
                      <div />
                      <div className="text-right text-[#4caf50] font-black">{marketDepth.bidSum.toFixed(3)}</div>
                    </div>
                  </div>

                  {/* ASKS Column */}
                  <div>
                    <div className="grid grid-cols-[100px_1fr_60px] gap-2 px-3 py-2 border-b border-[#292929]/80 text-[#666] font-bold text-[10px] uppercase">
                      <div>Ask Price</div>
                      <div className="text-right">Orders</div>
                      <div className="text-right">Quantity</div>
                    </div>
                    <div className="divide-y divide-[#292929]/40 font-mono">
                      {marketDepth.asks.map((a, idx) => {
                        const widthPct = Math.min(100, (a.qty / marketDepth.askSum) * 160);
                        return (
                          <div key={idx} className="grid grid-cols-[100px_1fr_60px] gap-2 px-3 py-2 relative text-[#ef5350] font-bold">
                            <div className="absolute right-0 top-0 bottom-0 bg-[#ef5350]/5 pointer-events-none" style={{ width: `${widthPct}%` }} />
                            <div className="z-10">${a.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                            <div className="text-right text-[#666] z-10">{a.orders}</div>
                            <div className="text-right text-[#e0e0e0] font-semibold z-10">{a.qty.toFixed(3)}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-[100px_1fr_60px] gap-2 px-3 py-2 border-t border-[#292929] bg-[#161616] text-[#666] font-bold text-[11px]">
                      <div>Total</div>
                      <div />
                      <div className="text-right text-[#ef5350] font-black">{marketDepth.askSum.toFixed(3)}</div>
                    </div>
                  </div>
                </div>

                {/* Bid/Ask volume percentage ratio slider */}
                <div className="px-4 py-3 bg-[#161616] border-t border-[#292929]">
                  <div className="h-1.5 w-full rounded overflow-hidden flex bg-gray-800">
                    <div className="bg-[#4caf50]" style={{ width: `${depthRatios.bidPct}%` }} />
                    <div className="bg-[#ef5350]" style={{ width: `${depthRatios.askPct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#808080] font-semibold mt-1.5 uppercase">
                    <span>Bids: {depthRatios.bidPct.toFixed(1)}%</span>
                    <span>Asks: {depthRatios.askPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Exchange stats grid */}
            <div className="bg-[#191919] border border-[#292929] rounded overflow-hidden">
              <div className="px-4 py-3 border-b border-[#292929] bg-[#1c1c1c] text-[11px] font-bold uppercase tracking-wider text-[#808080]">
                24h Summary Statistics
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 text-[11.5px] divide-x divide-[#292929]/40">
                <div className="space-y-3 pl-2">
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">Open Price</div>
                    <div className="text-[#e0e0e0] font-bold font-mono mt-1">${getTickerInfo(activeCoinInfo.symbol).open.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">24h High</div>
                    <div className="text-[#4caf50] font-bold font-mono mt-1">${getTickerInfo(activeCoinInfo.symbol).high.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

                <div className="space-y-3 pl-4">
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">24h Volume</div>
                    <div className="text-[#e0e0e0] font-bold font-mono mt-1">{getTickerInfo(activeCoinInfo.symbol).volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">24h Low</div>
                    <div className="text-[#ef5350] font-bold font-mono mt-1">${getTickerInfo(activeCoinInfo.symbol).low.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

                <div className="space-y-3 pl-4">
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">Turnover value</div>
                    <div className="text-[#e0e0e0] font-bold font-mono mt-1">{getTickerInfo(activeCoinInfo.symbol).quoteVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">Lower Circuit</div>
                    <div className="text-[#666] font-bold font-mono mt-1">${(getTickerInfo(activeCoinInfo.symbol).price * 0.9).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>

                <div className="space-y-3 pl-4">
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">Avg. Trade Price</div>
                    <div className="text-[#e0e0e0] font-bold font-mono mt-1">${((getTickerInfo(activeCoinInfo.symbol).high + getTickerInfo(activeCoinInfo.symbol).low) / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    <div className="text-[#666] font-bold text-[10px] uppercase">Upper Circuit</div>
                    <div className="text-[#666] font-bold font-mono mt-1">${(getTickerInfo(activeCoinInfo.symbol).price * 1.1).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#666]">
            <HelpCircle size={28} className="text-[#333] mb-2" />
            <div className="text-[12px] font-bold">Select a symbol from the watchlist to show depth</div>
          </div>
        )}

      </div>
    </div>
  );
}

export default CoinSelectPage;
