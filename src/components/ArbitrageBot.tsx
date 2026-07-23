import React, { useState, useEffect, useRef } from 'react';
import { Activity, Shield, Play, Settings, X, TrendingUp, AlertTriangle, Zap, Volume2, VolumeX, Filter } from 'lucide-react';

const ArbitrageBot = ({ onClose, onExecuteArbitrage }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [isBotActive, setIsBotActive] = useState(false);
  const [logs, setLogs] = useState([]);
  const [targetAlertProfit, setTargetAlertProfit] = useState(2.0); // Target in exact USD
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanMode, setScanMode] = useState('TOP_10');
  const [customCoins, setCustomCoins] = useState('PEPEUSDT, SHIBUSDT');
  const [isAutoTradeEnabled, setIsAutoTradeEnabled] = useState(false);
  
  const workerRef = useRef(null);
  
  const addLog = (msg, type = 'info') => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.5;
      audio.play();
    } catch (e) {}
  };

  useEffect(() => {
    // Initialize WebWorker
    workerRef.current = new Worker(new URL('../arbitrageWorker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (event) => {
      const { type, data, msg, level } = event.data;
      
      if (type === 'LOG') {
        addLog(msg, level);
      } else if (type === 'SCAN_RESULTS') {
        setOpportunities(data);
        
        // Trigger alert or auto-trade if top profit exceeds target
        if (data.length > 0 && data[0].netProfit >= targetAlertProfit) {
          if (isAutoTradeEnabled) {
            try {
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3'); 
              if(soundEnabled) audio.play();
            } catch (e) {}
            
            addLog(`⚡ AUTO-TRADE FIRED for ${data[0].coin}!`, 'success');
            
            // Inline execution to avoid stale closure
            addLog(`🚀 EXECUTING ARBITRAGE for ${data[0].coin}!`, 'success');
            addLog(`BUY ${data[0].maxQty.toFixed(4)} on ${data[0].buyEx} @ $${data[0].buyPrice.toFixed(4)}`, 'info');
            addLog(`SELL ${data[0].maxQty.toFixed(4)} on ${data[0].sellEx} @ $${data[0].sellPrice.toFixed(4)}`, 'info');
            if (onExecuteArbitrage) {
              onExecuteArbitrage(data[0]);
            }
            
            // Safety Lock: Turn off auto-trade after 1 execution
            setIsAutoTradeEnabled(false);
            addLog(`🔒 Safety Lock Engaged: Auto-Trade OFF`, 'info');
          } else {
            playAlertSound();
            addLog(`⚠️ Target Alert: ${data[0].coin} profit hit $${data[0].netProfit.toFixed(2)}`, 'success');
          }
        }
      }
    };

    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, [targetAlertProfit, soundEnabled, isAutoTradeEnabled]); // Re-bind if alert settings change

  useEffect(() => {
    if (isBotActive) {
      let coinsToScan = [];
      if (scanMode === 'TOP_10') {
        coinsToScan = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'MATICUSDT', 'DOTUSDT'];
      } else if (scanMode === 'ALL_50') {
        coinsToScan = [
          'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'MATICUSDT', 'DOTUSDT',
          'LTCUSDT', 'BCHUSDT', 'TRXUSDT', 'AVAXUSDT', 'SHIBUSDT', 'PEPEUSDT', 'UNIUSDT', 'ATOMUSDT', 'XLMUSDT', 'NEARUSDT',
          'APTUSDT', 'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'SEIUSDT', 'WLDUSDT', 'TIAUSDT', 'FILUSDT', 'INJUSDT', 'RNDRUSDT'
        ];
      } else if (scanMode === 'CUSTOM') {
        coinsToScan = customCoins.split(',').map(c => c.trim().toUpperCase()).filter(c => c.length > 0);
      }
      
      workerRef.current.postMessage({
        type: 'START',
        payload: { coins: coinsToScan }
      });
      setTimeout(() => addLog(`Initiating Scanner for ${coinsToScan.length} pairs...`, 'info'), 0);
    } else {
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
      }
    }
  }, [isBotActive, scanMode, customCoins]);

  const handleExecute = (opp) => {
    addLog(`🚀 EXECUTING ARBITRAGE for ${opp.coin}!`, 'success');
    addLog(`BUY ${opp.maxQty.toFixed(4)} on ${opp.buyEx} @ $${opp.buyPrice.toFixed(4)}`, 'info');
    addLog(`SELL ${opp.maxQty.toFixed(4)} on ${opp.sellEx} @ $${opp.sellPrice.toFixed(4)}`, 'info');
    
    if (onExecuteArbitrage) {
      onExecuteArbitrage(opp);
    }
  };

  return (
    <div className="w-full h-full bg-[#131722] border-t border-[#2a2e39] overflow-hidden text-[#d1d4dc] font-mono text-xs flex flex-col relative z-[50]">
      {/* Header */}
      <div className="bg-black/40 px-3 py-2 flex items-center justify-between border-b border-[#2a2e39]/50">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-emerald-400" />
          <span className="font-bold text-white tracking-widest uppercase">Arbitrage Zero-Slippage Radar</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-1 rounded transition-colors ${soundEnabled ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500 hover:text-gray-400'}`}>
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <button onClick={onClose} className="hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Control Panel */}
      <div className="p-3 border-b border-[#2a2e39]/50 bg-black/20 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-gray-500 font-bold">Target Profit ($):</span>
          <input 
            type="number" 
            step="1"
            value={targetAlertProfit}
            onChange={(e) => setTargetAlertProfit(parseFloat(e.target.value) || 0)}
            className="bg-[#2a2e39] w-16 px-2 py-1 rounded text-white border border-[#2a2e39] focus:border-blue-500 outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-gray-500" />
          <select 
            value={scanMode} 
            onChange={(e) => setScanMode(e.target.value)}
            disabled={isBotActive}
            className="bg-[#2a2e39] text-[10px] uppercase font-bold px-2 py-1 rounded text-white border border-[#2a2e39] focus:border-blue-500 outline-none disabled:opacity-50"
          >
            <option value="TOP_10">Top 10 USDT</option>
            <option value="ALL_50">Top 30 All Pairs</option>
            <option value="CUSTOM">Custom Pairs</option>
          </select>
          {scanMode === 'CUSTOM' && (
            <input 
              type="text"
              value={customCoins}
              onChange={(e) => setCustomCoins(e.target.value)}
              disabled={isBotActive}
              placeholder="BTCUSDT, ETHUSDT..."
              className="bg-[#2a2e39] w-32 px-2 py-1 rounded text-[10px] text-white border border-[#2a2e39] focus:border-blue-500 outline-none disabled:opacity-50"
            />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAutoTradeEnabled(!isAutoTradeEnabled)}
            disabled={!isBotActive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded uppercase font-bold tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isAutoTradeEnabled ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-[#2a2e39] text-gray-400 hover:bg-[#323642]'}`}
          >
            <Zap size={12} className={isAutoTradeEnabled ? 'text-blue-400' : ''} />
            Auto-Trade {isAutoTradeEnabled ? 'ON' : 'OFF'}
          </button>

          <button 
            onClick={() => setIsBotActive(!isBotActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded uppercase font-bold tracking-wider transition-all ${isBotActive ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-600 text-white hover:bg-emerald-500'}`}
          >
            {isBotActive ? <Shield size={12} /> : <Play size={12} />}
            {isBotActive ? 'Stop Scanner' : 'Start Radar'}
          </button>
        </div>
      </div>

      {/* Opportunities List */}
      <div className="h-56 overflow-y-auto custom-scrollbar bg-[#131722]">
        {opportunities.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
            {isBotActive ? <Activity className="animate-pulse" size={24} /> : <Shield size={24} />}
            <span>{isBotActive ? 'Scanning multi-exchanges for opportunities...' : 'Radar Offline'}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Profitable Section */}
            <div className="mb-4">
              <div className="sticky top-0 z-10 bg-emerald-900/40 text-emerald-400 text-[10px] uppercase font-black px-3 py-1 border-y border-emerald-500/30 backdrop-blur-md">
                Profitable Opportunities {opportunities.filter(opp => opp.netProfit > 0).length === 0 && '(None right now)'}
              </div>
              
              {opportunities.filter(opp => opp.netProfit > 0).length === 0 ? (
                <div className="p-4 text-center text-[10px] text-gray-500 italic bg-[#1e222d]/50">
                  Waiting for market volatility. No profitable arbitrage pairs available right now after fees...
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1e222d]">
                    <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="p-3 font-medium">Pair</th>
                      <th className="p-3 font-medium text-right">Volume</th>
                      <th className="p-3 font-medium text-center">Buy At</th>
                      <th className="p-3 font-medium text-center">Sell At</th>
                      <th className="p-3 font-medium text-right">Gross Profit</th>
                      <th className="p-3 font-medium text-right">Total Fees</th>
                      <th className="p-3 font-medium text-right">Net PnL ($)</th>
                      <th className="p-3 font-medium text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.filter(opp => opp.netProfit > 0).map((opp, idx) => (
                      <tr key={idx} className="border-b border-[#2a2e39]/30 hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-white flex items-center gap-1 text-sm">
                            {opp.coin}
                            {opp.netProfit >= targetAlertProfit && <Zap size={12} className="text-yellow-400 animate-pulse" />}
                          </div>
                        </td>
                        <td className="p-3 text-right font-medium text-gray-300">{opp.maxQty.toFixed(4)}</td>
                        <td className="p-3 text-center">
                          <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-1 rounded">{opp.buyEx}</span>
                          <div className="text-gray-400 mt-1">${opp.buyPrice.toFixed(2)}</div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-red-400 font-bold bg-red-400/10 px-2 py-1 rounded">{opp.sellEx}</span>
                          <div className="text-gray-400 mt-1">${opp.sellPrice.toFixed(2)}</div>
                        </td>
                        <td className="p-3 text-right text-gray-300">+${opp.grossProfit.toFixed(2)}</td>
                        <td className="p-3 text-right text-gray-500">-${opp.fees.toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <div className="text-[15px] font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]">+${opp.netProfit.toFixed(2)}</div>
                        </td>
                        <td className="p-3 text-center">
                          <button 
                            onClick={() => handleExecute(opp)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-[10px] font-bold uppercase transition-colors shadow-lg shadow-blue-500/20"
                          >
                            Execute
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Loss Section */}
            {opportunities.filter(opp => opp.netProfit <= 0).length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-red-900/20 text-red-400/80 text-[10px] uppercase font-black px-3 py-1 border-y border-red-500/20 backdrop-blur-md">
                  Negative PnL (Unprofitable)
                </div>
                <table className="w-full text-left border-collapse opacity-70">
                  <thead className="bg-[#1e222d]">
                    <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                      <th className="p-3 font-medium">Pair</th>
                      <th className="p-3 font-medium text-right">Volume</th>
                      <th className="p-3 font-medium text-center">Buy At</th>
                      <th className="p-3 font-medium text-center">Sell At</th>
                      <th className="p-3 font-medium text-right">Gross Profit</th>
                      <th className="p-3 font-medium text-right">Total Fees</th>
                      <th className="p-3 font-medium text-right">Net PnL ($)</th>
                      <th className="p-3 font-medium text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.filter(opp => opp.netProfit <= 0).map((opp, idx) => (
                      <tr key={idx} className="border-b border-[#2a2e39]/30 hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-gray-400 text-sm">{opp.coin}</td>
                        <td className="p-3 text-right font-medium text-gray-500">{opp.maxQty.toFixed(4)}</td>
                        <td className="p-3 text-center">
                          <span className="text-gray-400 font-bold">{opp.buyEx}</span>
                          <div className="text-gray-600 mt-1">${opp.buyPrice.toFixed(2)}</div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-gray-400 font-bold">{opp.sellEx}</span>
                          <div className="text-gray-600 mt-1">${opp.sellPrice.toFixed(2)}</div>
                        </td>
                        <td className="p-3 text-right text-gray-500">{opp.grossProfit > 0 ? '+' : ''}${opp.grossProfit.toFixed(2)}</td>
                        <td className="p-3 text-right text-gray-600">-${opp.fees.toFixed(2)}</td>
                        <td className="p-3 text-right">
                          <div className="text-sm font-black text-red-500/60">${opp.netProfit.toFixed(2)}</div>
                        </td>
                        <td className="p-3 text-center">
                          <button disabled className="bg-[#2a2e39]/50 text-gray-500 px-4 py-1.5 rounded text-[10px] font-bold uppercase cursor-not-allowed">Unviable</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal Logs */}
      <div className="bg-black/50 border-t border-[#2a2e39]/50 h-24 overflow-y-auto p-1.5 space-y-1 custom-scrollbar shrink-0">
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[9px]">
            <span className="text-gray-600 shrink-0">[{l.time}]</span>
            <span className={`${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : 'text-blue-300'}`}>
              {l.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArbitrageBot;
