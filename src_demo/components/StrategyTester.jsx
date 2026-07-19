import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import { Settings, BarChart2, List, Activity, Info, Calendar, Download, AlertCircle } from 'lucide-react';

export default function StrategyTester({ onClose }) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [activeOverviewSubTab, setActiveOverviewSubTab] = useState('Returns');
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const TABS = ['Overview', 'Performance Summary', 'List of Trades', 'Properties'];
  const OVERVIEW_SUB_TABS = ['Overview', 'Returns', 'Benchmarking', 'Risk-adjusted performance'];

  // Mock Performance Data
  const stats = {
    totalPnl: -498.13,
    totalPnlPct: -4.98,
    maxDrawdown: 975.92,
    maxDrawdownPct: 9.64,
    profitableTrades: 79,
    totalTrades: 285,
    winRate: 27.72,
    profitFactor: 0.896,
  };

  // Mock Trade History Data
  const mockTrades = Array.from({ length: 50 }, (_, i) => ({
    id: 285 - i,
    type: i % 3 === 0 ? 'Short' : 'Long',
    signal: 'EMA 9/21 Cross',
    time: new Date(Date.now() - i * 3600000 * 24).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
    price: 64000 + (Math.random() * 2000 - 1000),
    size: (Math.random() * 0.5 + 0.1).toFixed(3),
    pnl: (Math.random() * 200 - 120), // Biased slightly negative for realism
  }));

  // Initial Equity Curve Rendering
  useEffect(() => {
    if (activeTab !== 'Overview') return;
    
    // Slight delay to ensure container is fully rendered before attaching chart
    const timer = setTimeout(() => {
      if (chartContainerRef.current && !chartInstanceRef.current) {
        chartInstanceRef.current = createChart(chartContainerRef.current, {
          layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: '#848e9c',
          },
          grid: {
            vertLines: { color: 'rgba(42, 46, 57, 0.4)' },
            horzLines: { color: 'rgba(42, 46, 57, 0.4)' },
          },
          rightPriceScale: {
            borderColor: 'rgba(42, 46, 57, 0.6)',
          },
          timeScale: {
            borderColor: 'rgba(42, 46, 57, 0.6)',
            timeVisible: true,
          },
          crosshair: {
            mode: 1, // Magnet
          },
        });

        // Add Equity Curve Series
        const equitySeries = chartInstanceRef.current.addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });

        // Add Buy & Hold Benchmark Series
        const benchmarkSeries = chartInstanceRef.current.addLineSeries({
          color: '#F0B90B', // Yellow/Gold
          lineWidth: 1.5,
          lineStyle: 2, // Dashed
          priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
        });

        // Generate dummy equity curve data over 60 days
        const equityData = [];
        const benchmarkData = [];
        let currentEquity = 10000;
        let currentBench = 10000;
        const now = Date.now();
        
        for (let i = 60; i >= 0; i--) {
          const time = (now - i * 86400000) / 1000;
          currentEquity += (Math.random() * 400 - 210); // trending slightly down
          currentBench += (Math.random() * 350 - 150); // trending slightly up
          
          equityData.push({ time, value: currentEquity });
          benchmarkData.push({ time, value: currentBench });
        }

        equitySeries.setData(equityData);
        benchmarkSeries.setData(benchmarkData);
        chartInstanceRef.current.timeScale().fitContent();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [activeTab]);

  return (
    <div className="flex flex-col w-full h-full bg-[#131722] text-[#d1d4dc] font-sans overflow-hidden relative">
      {/* HEADER TABS */}
      <div className="flex items-center justify-between px-4 border-b border-[#2a2e39] bg-[#131722] shrink-0 sticky top-0 z-20">
        <div className="flex space-x-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-[13px] font-semibold transition-colors border-b-2 ${
                activeTab === tab 
                ? 'text-[#2962FF] border-[#2962FF]' 
                : 'text-[#848e9c] border-transparent hover:text-[#d1d4dc]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#848e9c] flex items-center gap-1">
            <Calendar size={12} /> Jun 8, 2026 - Jul 18, 2026
          </span>
          <button onClick={onClose} className="p-1 hover:bg-[#2a2e39] rounded text-[#848e9c] transition-colors">
            X
          </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#131722]">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'Overview' && (
          <div className="flex flex-col h-full p-4">
            {/* KEY STATS GRID */}
            <div className="grid grid-cols-4 gap-6 mb-4 shrink-0">
              <div className="flex flex-col">
                <span className="text-[12px] text-[#848e9c] mb-1 font-medium">Total PnL</span>
                <span className={`text-xl font-bold ${stats.totalPnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {stats.totalPnl > 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} USDT <span className="text-sm font-semibold">{stats.totalPnlPct.toFixed(2)}%</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] text-[#848e9c] mb-1 font-medium">Max drawdown</span>
                <span className="text-xl font-bold text-[#d1d4dc]">
                  {stats.maxDrawdown.toFixed(2)} USDT <span className="text-sm text-[#848e9c] font-semibold">{stats.maxDrawdownPct.toFixed(2)}%</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] text-[#848e9c] mb-1 font-medium">Profitable trades</span>
                <span className="text-xl font-bold text-[#d1d4dc]">
                  {stats.winRate.toFixed(2)}% <span className="text-sm text-[#848e9c] font-semibold">{stats.profitableTrades}/{stats.totalTrades}</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] text-[#848e9c] mb-1 font-medium">Profit factor</span>
                <span className="text-xl font-bold text-[#d1d4dc]">
                  {stats.profitFactor.toFixed(3)}
                </span>
              </div>
            </div>

            {/* CHART AREA */}
            <div className="flex-1 min-h-[300px] relative border border-[#2a2e39] rounded bg-[#0b0e14]">
              {/* Legend overlay */}
              <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 text-[11px] font-mono pointer-events-none">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-[#2962FF]" /> <span className="text-[#848e9c]">Strategy Equity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-[#F0B90B] border-dashed border-t" /> <span className="text-[#848e9c]">Buy & Hold</span>
                </div>
              </div>
              
              <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />
            </div>

            {/* BOTTOM BUTTONS */}
            <div className="flex items-center gap-2 mt-4 shrink-0 overflow-x-auto custom-scrollbar pb-1">
              {OVERVIEW_SUB_TABS.map(st => (
                <button
                  key={st}
                  onClick={() => setActiveOverviewSubTab(st)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                    activeOverviewSubTab === st 
                    ? 'bg-[#2962FF] text-white' 
                    : 'bg-[#2a2e39] text-[#848e9c] hover:bg-[#363a45] hover:text-[#d1d4dc]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PERFORMANCE SUMMARY TAB */}
        {activeTab === 'Performance Summary' && (
          <div className="p-4">
            <table className="w-full text-left border-collapse text-[12px]">
              <thead className="border-b border-[#2a2e39] text-[#848e9c]">
                <tr>
                  <th className="py-3 px-2 font-normal w-1/3">Metric</th>
                  <th className="py-3 px-2 font-normal text-right">All Trades</th>
                  <th className="py-3 px-2 font-normal text-right">Long Trades</th>
                  <th className="py-3 px-2 font-normal text-right">Short Trades</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b3139]">
                {[
                  { label: 'Net Profit', all: '-498.13 (-4.98%)', long: '-215.40 (-2.15%)', short: '-282.73 (-2.83%)', bad: true },
                  { label: 'Gross Profit', all: '4,289.50', long: '2,100.20', short: '2,189.30' },
                  { label: 'Gross Loss', all: '4,787.63', long: '2,315.60', short: '2,472.03', bad: true },
                  { label: 'Commission Paid', all: '142.50', long: '70.25', short: '72.25' },
                  { label: 'Total Trades', all: '285', long: '142', short: '143' },
                  { label: 'Profitable Trades', all: '79 (27.72%)', long: '41 (28.87%)', short: '38 (26.57%)' },
                  { label: 'Profit Factor', all: '0.896', long: '0.907', short: '0.885', bad: true },
                  { label: 'Average Trade', all: '-1.76', long: '-1.51', short: '-1.97', bad: true },
                  { label: 'Sharpe Ratio', all: '-0.09', long: '-0.07', short: '-0.11', bad: true },
                  { label: 'Sortino Ratio', all: '-0.14', long: '-0.11', short: '-0.18', bad: true },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#2a2e39]/30 transition-colors group">
                    <td className="py-2.5 px-2 text-[#848e9c]">{row.label}</td>
                    <td className={`py-2.5 px-2 text-right font-mono ${row.bad && row.all.includes('-') ? 'text-[#f6465d]' : 'text-[#d1d4dc]'}`}>{row.all}</td>
                    <td className={`py-2.5 px-2 text-right font-mono ${row.bad && row.long.includes('-') ? 'text-[#f6465d]' : 'text-[#d1d4dc]'}`}>{row.long}</td>
                    <td className={`py-2.5 px-2 text-right font-mono ${row.bad && row.short.includes('-') ? 'text-[#f6465d]' : 'text-[#d1d4dc]'}`}>{row.short}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* LIST OF TRADES TAB */}
        {activeTab === 'List of Trades' && (
          <div className="p-0">
            <table className="w-full text-left border-collapse text-[12px] min-w-[800px]">
              <thead className="bg-[#1e222d] sticky top-0 z-10 border-b border-[#2a2e39] text-[#848e9c]">
                <tr>
                  <th className="py-2.5 px-4 font-normal">Trade #</th>
                  <th className="py-2.5 px-2 font-normal">Type</th>
                  <th className="py-2.5 px-2 font-normal">Signal</th>
                  <th className="py-2.5 px-2 font-normal">Date / Time</th>
                  <th className="py-2.5 px-2 font-normal text-right">Price</th>
                  <th className="py-2.5 px-2 font-normal text-right">Contracts</th>
                  <th className="py-2.5 px-4 font-normal text-right">Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b3139]">
                {mockTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-[#2a2e39]/40 transition-colors">
                    <td className="py-2 px-4 text-[#848e9c] font-mono">#{t.id}</td>
                    <td className={`py-2 px-2 font-bold ${t.type === 'Long' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{t.type}</td>
                    <td className="py-2 px-2 text-[#d1d4dc] truncate max-w-[150px]">{t.signal}</td>
                    <td className="py-2 px-2 text-[#848e9c]">{t.time}</td>
                    <td className="py-2 px-2 text-right text-[#d1d4dc] font-mono">{t.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-2 px-2 text-right text-[#d1d4dc] font-mono">{t.size}</td>
                    <td className={`py-2 px-4 text-right font-mono font-bold ${t.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      {t.pnl > 0 ? '+' : ''}{t.pnl.toFixed(2)} USDT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PROPERTIES TAB */}
        {activeTab === 'Properties' && (
          <div className="p-6 max-w-2xl mx-auto h-full flex flex-col justify-center">
            <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl p-6">
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Settings size={18} className="text-[#2962FF]" /> Strategy Properties
              </h2>
              
              <div className="space-y-5 text-[13px]">
                <div className="flex items-center justify-between">
                  <label className="text-[#848e9c]">Initial Capital</label>
                  <div className="flex bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden w-[200px]">
                    <input type="number" defaultValue="10000" className="w-full bg-transparent text-white px-3 py-2 outline-none font-mono" />
                    <span className="bg-[#2a2e39] text-[#848e9c] px-3 py-2 border-l border-[#2a2e39]">USDT</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[#848e9c]">Order Size</label>
                  <div className="flex bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden w-[200px]">
                    <input type="number" defaultValue="100" className="w-full bg-transparent text-white px-3 py-2 outline-none font-mono" />
                    <select className="bg-[#2a2e39] text-[#848e9c] px-2 py-2 border-l border-[#2a2e39] outline-none">
                      <option>% of equity</option>
                      <option>USDT</option>
                      <option>Contracts</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[#848e9c]">Pyramiding</label>
                  <input type="number" defaultValue="1" className="bg-[#0b0e14] border border-[#2a2e39] rounded text-white px-3 py-2 outline-none w-[200px] font-mono" />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-[#848e9c]">Commission</label>
                  <div className="flex bg-[#0b0e14] border border-[#2a2e39] rounded overflow-hidden w-[200px]">
                    <input type="number" defaultValue="0.04" className="w-full bg-transparent text-white px-3 py-2 outline-none font-mono" />
                    <select className="bg-[#2a2e39] text-[#848e9c] px-2 py-2 border-l border-[#2a2e39] outline-none">
                      <option>%</option>
                      <option>USDT per order</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3 justify-end">
                <button className="px-4 py-2 rounded text-[#848e9c] hover:bg-[#2a2e39] transition-colors">Reset</button>
                <button className="px-6 py-2 rounded bg-[#2962FF] hover:bg-blue-600 text-white font-medium transition-colors">Apply Rules</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
