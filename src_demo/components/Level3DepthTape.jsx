/**
 * QuantaAI — Orderbook Level 3 Depth & Time-and-Sales Tape Engine (Phase 8)
 * Real-Time Microsecond DOM Orderbook Imbalance & Whale Trade Tape Analyzer
 */

import React, { useState, useEffect, useRef } from 'react';
import { Activity, ArrowUp, ArrowDown, Shield, Zap, Layers, RefreshCw } from 'lucide-react';

export default function Level3DepthTape({ symbol = 'BTCUSDT', livePrice = 0 }) {
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);
  const [tradesTape, setTradesTape] = useState([]);
  const [imbalancePct, setImbalancePct] = useState(50); // 50% = balanced

  const wsRef = useRef(null);

  useEffect(() => {
    const sym = symbol.toLowerCase();
    const wsUrl = `wss://stream.binance.com:9443/ws/${sym}@depth10@100ms/${sym}@trade`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Depth updates
        if (msg.bids && msg.asks) {
          const parsedBids = msg.bids.slice(0, 8).map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) }));
          const parsedAsks = msg.asks.slice(0, 8).map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }));

          setBids(parsedBids);
          setAsks(parsedAsks);

          const totalBidQty = parsedBids.reduce((acc, b) => acc + b.qty, 0);
          const totalAskQty = parsedAsks.reduce((acc, a) => acc + a.qty, 0);
          const total = totalBidQty + totalAskQty;

          if (total > 0) {
            setImbalancePct(parseFloat(((totalBidQty / total) * 100).toFixed(1)));
          }
        }

        // Live Trade Tape updates
        if (msg.e === 'trade') {
          const trade = {
            id: msg.t,
            time: new Date(msg.T).toLocaleTimeString(),
            price: parseFloat(msg.p),
            qty: parseFloat(msg.q),
            isBuyerMaker: msg.m, // true = sell side, false = buy side
            isWhale: parseFloat(msg.q) * parseFloat(msg.p) > 10000, // > $10k trade
          };

          setTradesTape(prev => [trade, ...prev].slice(0, 30));
        }
      } catch (e) {}
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [symbol]);

  return (
    <div className="w-full h-full flex flex-col bg-[#0b0e14] text-white p-3 font-mono text-xs border border-gray-800 rounded-lg select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-800 mb-2">
        <div className="flex items-center gap-2 font-bold text-sm text-cyan-400">
          <Layers size={16} />
          <span>Level 3 Depth & Trade Tape</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-normal">{symbol}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <Activity size={12} className="text-green-400 animate-pulse" />
          <span>100ms Feed</span>
        </div>
      </div>

      {/* Orderbook Depth Imbalance Gauge */}
      <div className="mb-3 bg-[#131722] p-2 rounded border border-gray-800">
        <div className="flex justify-between text-[11px] font-bold mb-1">
          <span className="text-green-400">BUYERS ({imbalancePct}%)</span>
          <span className="text-red-400">SELLERS ({(100 - imbalancePct).toFixed(1)}%)</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all duration-150" style={{ width: `${imbalancePct}%` }} />
          <div className="h-full bg-red-500 transition-all duration-150" style={{ width: `${100 - imbalancePct}%` }} />
        </div>
      </div>

      {/* Grid: Orderbook Depth (Left) & Time & Sales (Right) */}
      <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden">
        {/* Orderbook Depth Meter */}
        <div className="flex flex-col gap-1 overflow-y-auto pr-1 border-r border-gray-800">
          <div className="text-[10px] text-gray-400 font-bold uppercase pb-1">Asks (Sell Orders)</div>
          {asks.slice().reverse().map((ask, idx) => (
            <div key={`ask-${idx}`} className="flex justify-between items-center text-red-400 text-[11px] hover:bg-red-500/10 px-1 rounded">
              <span>${ask.price.toFixed(2)}</span>
              <span className="font-bold">{ask.qty.toFixed(3)}</span>
            </div>
          ))}

          <div className="my-1 py-1 text-center font-bold text-sm text-yellow-400 bg-yellow-500/10 rounded border border-yellow-500/20">
            ${livePrice ? livePrice.toFixed(2) : '---'}
          </div>

          <div className="text-[10px] text-gray-400 font-bold uppercase pt-1">Bids (Buy Orders)</div>
          {bids.map((bid, idx) => (
            <div key={`bid-${idx}`} className="flex justify-between items-center text-green-400 text-[11px] hover:bg-green-500/10 px-1 rounded">
              <span>${bid.price.toFixed(2)}</span>
              <span className="font-bold">{bid.qty.toFixed(3)}</span>
            </div>
          ))}
        </div>

        {/* Time and Sales Tape */}
        <div className="flex flex-col gap-1 overflow-y-auto pl-1">
          <div className="text-[10px] text-gray-400 font-bold uppercase pb-1 flex justify-between">
            <span>Time & Sales</span>
            <span>Qty</span>
          </div>
          {tradesTape.map((trade) => (
            <div
              key={trade.id}
              className={`flex justify-between items-center text-[11px] px-1 py-0.5 rounded transition-colors ${
                trade.isWhale ? 'bg-yellow-500/20 border border-yellow-500/40 font-bold' : ''
              } ${!trade.isBuyerMaker ? 'text-green-400' : 'text-red-400'}`}
            >
              <div className="flex items-center gap-1">
                <span>{trade.time}</span>
                {trade.isWhale && <Zap size={10} className="text-yellow-400 animate-bounce" />}
              </div>
              <div className="flex items-center gap-2">
                <span>${trade.price.toFixed(2)}</span>
                <span className="font-bold">{trade.qty.toFixed(3)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
