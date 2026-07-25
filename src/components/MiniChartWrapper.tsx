import React, { useRef, useState, useEffect, useMemo } from 'react';
import { createChart } from 'lightweight-charts';
import { fetchExchangeCandles } from '../exchanges';

export default function MiniChartWrapper({ coin: propCoin, interval, darkMode }) {
  const containerRef = useRef(null);
  const chartInstRef = useRef(null);
  const seriesRef = useRef(null);
  const [candles, setCandles] = useState([]);
  
  const [localCoin, setLocalCoin] = useState(propCoin);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(propCoin);

  useEffect(() => {
    setLocalCoin(propCoin);
    setInputValue(propCoin);
  }, [propCoin]);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const data = await fetchExchangeCandles('binance', localCoin, interval, 150);
        if (active && data?.length) setCandles(data);
      } catch (e) {
        console.error(e);
      }
    };
    loadData();
    return () => { active = false; };
  }, [localCoin, interval]);

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;
    const container = containerRef.current;
    
    const chart = createChart(container, {
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
        kinematicScroll: { mouse: true },

      layout: {
        background: { type: 'solid', color: darkMode ? '#131722' : '#ffffff' },
        textColor: darkMode ? '#c9d1d9' : '#131722',
      },
      grid: {
        vertLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
        horzLines: { color: darkMode ? 'rgba(42,46,57,0.6)' : '#e0e3eb' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });
    
    chartInstRef.current = chart;
    const candSeries = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#F23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#F23645',
    });
    seriesRef.current = candSeries;
    
    candSeries.setData(candles);
    chart.timeScale().fitContent();

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      chart.resize(rect.width, rect.height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, darkMode]);

  const handleSaveCoin = () => {
    setIsEditing(false);
    if (inputValue.trim() !== '') {
      setLocalCoin(inputValue.toUpperCase());
    } else {
      setInputValue(localCoin);
    }
  };

  return (
    <div className="w-full h-full relative border border-[#2a2e39]/30 rounded overflow-hidden group">
      <div ref={containerRef} className="w-full h-full absolute inset-0" />
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-1 py-1 drop-shadow-md transition-all">
        {!isEditing ? (
          <div 
            className={`text-[10px] font-bold ${darkMode ? 'text-[#d1d4dc]' : 'text-gray-700'} uppercase tracking-wider cursor-pointer hover:text-blue-400 flex items-center gap-1`}
            onClick={() => setIsEditing(true)}
            title="Click to change coin"
          >
            <Search size={10} className="text-gray-400" />
            <span>{localCoin}</span>
            <span className="text-gray-500 font-medium">· {interval}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Search size={10} className="text-blue-400" />
            <input 
              autoFocus
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveCoin();
                if (e.key === 'Escape') {
                  setInputValue(localCoin);
                  setIsEditing(false);
                }
              }}
              onBlur={handleSaveCoin}
              className={`w-[60px] text-[10px] font-bold bg-transparent outline-none uppercase ${darkMode ? 'text-white' : 'text-black'}`}
              placeholder="Coin..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
