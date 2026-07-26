import React, { useState } from 'react';
import { Layers, ListFilter, History, X } from 'lucide-react';
import StrategyTester from '../StrategyTester';
import Level3DepthTape from '../Level3DepthTape';
import ArbitrageBot from '../ArbitrageBot';

export default function TradingPanel({
  positions,
  paperOrders,
  selectedCoin,
  livePrice,
  leverage,
  closeActivePosition,
  cancelLimitOrder,
  handleExecuteArbitrage,
  t
}: any) {
  const [tradingTab, setTradingTab] = useState('Positions');

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e14]">
      {/* Tabs */}
      <div className="flex gap-4 md:gap-6 px-4 border-b bg-[#131722] pt-2 overflow-x-auto whitespace-nowrap custom-scrollbar">
        {['Positions', 'Open Orders', 'Order History', 'Trade History', 'Arbitrage Matrix', 'Strategy Tester', 'Level 3 DOM Depth', 'AI Risk Auditor'].map(tab => (
          <button
            key={tab}
            onClick={() => setTradingTab(tab)}
            className={`pb-3 text-[12px] md:text-[13px] font-bold transition-all relative shrink-0 ${tradingTab === tab ? t.text : t.muted}`}
          >
            {tab} {tab === 'Positions' && (null)} {tab === 'Open Orders' && (null)}
            {tradingTab === tab && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[#fcd535] rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar p-0">
        {tradingTab === 'Positions' && (
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-[#131722] sticky top-0 z-10">
              <tr>
                <th className="py-2 pl-4 pr-2 font-normal text-[#848e9c] text-[11px]">Symbol</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Size</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Entry Price</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Mark Price</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Liq. Price</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Margin Ratio</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Margin</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px] text-right">PNL (ROE%)</th>
                <th className="py-2 pr-4 font-normal text-[#848e9c] text-[11px] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139]">
              {(positions || []).map((pos, idx) => {
                const markPrice = pos.symbol === selectedCoin ? livePrice : pos.entryPrice; 
                const pnl = pos.type === 'LONG' 
                  ? (markPrice - pos.entryPrice) * pos.qty
                  : (pos.entryPrice - markPrice) * pos.qty;
                const initialMargin = (pos.qty * pos.entryPrice) / (leverage || 1);
                const roe = (pnl / initialMargin) * 100;
                const liqPrice = pos.type === 'LONG' 
                  ? pos.entryPrice * (1 - 1/(leverage || 1) + 0.005) 
                  : pos.entryPrice * (1 + 1/(leverage || 1) - 0.005);
                
                return (
                  <tr key={idx} className="hover:bg-[#2b3139]/30 transition-colors group">
                    <td className="py-2.5 pl-4 pr-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1 h-3.5 rounded-sm ${pos.type === 'LONG' ? 'bg-[#089981]' : 'bg-[#f23645]'}`}></div>
                        <div>
                          <div className="text-[12px] font-bold text-white flex items-center gap-1">{pos.symbol} <span className="bg-[#2b3139] text-[#fcd535] px-1 rounded text-[9px] border border-[#fcd535]/30">{leverage}x</span></div>
                          <div className={`text-[10px] font-semibold ${pos.type === 'LONG' ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                            {pos.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{pos.qty}</td>
                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{pos.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{markPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-2.5 pr-2 text-[#fcd535] font-mono text-[12px]">{liqPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{(Math.random() * (12 - 4) + 4).toFixed(2)}%</td>
                    <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{initialMargin.toFixed(2)}</td>
                    <td className="py-2.5 pr-2 text-right">
                      <div className={`font-mono text-[12px] font-bold ${pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </div>
                      <div className={`font-mono text-[10px] ${pnl >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                        {pnl >= 0 ? '+' : ''}{roe.toFixed(2)}%
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="bg-[#2b3139] hover:bg-[#3b414a] text-white px-3 py-1 rounded text-[11px] font-bold transition-colors">Reverse</button>
                        <button onClick={() => closeActivePosition(pos.symbol)} className="bg-[#2b3139] hover:bg-[#f6465d] hover:text-white text-[#f6465d] px-3 py-1 rounded text-[11px] font-bold transition-colors">Close</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {tradingTab === 'Positions' && (!positions || positions.length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 text-[#848e9c]">
            <Layers size={32} className="mb-2 opacity-30" />
            <span className="text-[12px]">No open positions</span>
          </div>
        )}

        {tradingTab === 'Open Orders' && (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-[#131722] sticky top-0 z-10">
              <tr>
                <th className="py-2 pl-4 pr-2 font-normal text-[#848e9c] text-[11px]">Time</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Symbol</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Type</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Side</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Price</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Amount</th>
                <th className="py-2 pr-2 font-normal text-[#848e9c] text-[11px]">Filled</th>
                <th className="py-2 pr-4 font-normal text-[#848e9c] text-[11px] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139]">
              {(paperOrders || []).filter(o => o.status === 'PENDING').map((order, idx) => (
                <tr key={idx} className="hover:bg-[#2b3139]/30 transition-colors group">
                  <td className="py-2.5 pl-4 pr-2 text-[#848e9c] text-[11px]">{new Date().toLocaleString()}</td>
                  <td className="py-2.5 pr-2 text-white font-bold text-[12px]">{order.symbol}</td>
                  <td className="py-2.5 pr-2 text-white text-[12px]">{order.type}</td>
                  <td className={`py-2.5 pr-2 text-[12px] font-bold ${order.side === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'}`}>{order.side}</td>
                  <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{order.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="py-2.5 pr-2 text-white font-mono text-[12px]">{order.qty}</td>
                  <td className="py-2.5 pr-2 text-white font-mono text-[12px]">0.00%</td>
                  <td className="py-2.5 pr-4 text-right">
                    <button onClick={() => cancelLimitOrder(order.id)} className="text-[#848e9c] hover:text-white transition-colors"><X size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tradingTab === 'Open Orders' && (!paperOrders || paperOrders.filter(o => o.status === 'PENDING').length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 text-[#848e9c]">
            <ListFilter size={32} className="mb-2 opacity-30" />
            <span className="text-[12px]">No open orders</span>
          </div>
        )}
        
        {(tradingTab === 'Order History' || tradingTab === 'Trade History') && (
          <div className="flex flex-col items-center justify-center h-48 text-[#848e9c]">
            <History size={32} className="mb-2 opacity-30" />
            <span className="text-[12px]">No history available</span>
          </div>
        )}
        
        {tradingTab === 'Arbitrage Matrix' && (
          <div className="w-full h-full min-h-[350px]">
            <ArbitrageBot onExecuteArbitrage={handleExecuteArbitrage} />
          </div>
        )}
        
        {tradingTab === 'Strategy Tester' && (
          <div className="w-full h-full min-h-[400px]">
            <StrategyTester onClose={() => setTradingTab('Positions')} />
          </div>
        )}

        {tradingTab === 'Level 3 DOM Depth' && (
          <div className="w-full h-full min-h-[400px]">
            <Level3DepthTape symbol={selectedCoin} livePrice={livePrice} />
          </div>
        )}
      </div>
    </div>
  );
}
