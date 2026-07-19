// src/arbitrageWorker.js

const TAKER_FEE = 0.001; // 0.1% typical taker fee
const NETWORK_FEE = 1.0; // Approx $1 equivalent transfer fee deduction per arbitrage execution

let binanceWs = null;
let bybitWs = null;
let okxWs = null;

let isRunning = false;
let coins = []; // List of coins to scan (e.g. ['BTCUSDT', 'ETHUSDT', ...])

// Local state for all coins
// format: { BTCUSDT: { binance: { bid: 0, bidQty: 0, ask: 0, askQty: 0 }, bybit: {...}, okx: {...} } }
const marketData = {};

function initMarketData(coinList) {
  coins = coinList;
  coins.forEach(c => {
    if (!marketData[c]) {
      marketData[c] = {
        binance: { bid: 0, bidQty: 0, ask: 0, askQty: 0 },
        bybit: { bid: 0, bidQty: 0, ask: 0, askQty: 0 },
        okx: { bid: 0, bidQty: 0, ask: 0, askQty: 0 }
      };
    }
  });
}

function calculateSpreads() {
  const opportunities = [];

  coins.forEach(coin => {
    const data = marketData[coin];
    const exchanges = Object.keys(data);
    
    // N-Exchange Permutation Loop
    // Loop through every possible Buy exchange
    for (let i = 0; i < exchanges.length; i++) {
      const buyEx = exchanges[i];
      const buyData = data[buyEx];
      
      // If this exchange doesn't have valid ask data yet, skip
      if (!buyData.ask || buyData.ask <= 0) continue;
      
      // Loop through every possible Sell exchange
      for (let j = 0; j < exchanges.length; j++) {
        const sellEx = exchanges[j];
        
        // Cannot buy and sell on the same exchange for arbitrage
        if (buyEx === sellEx) continue;
        
        const sellData = data[sellEx];
        
        // If this exchange doesn't have valid bid data yet, skip
        if (!sellData.bid || sellData.bid <= 0) continue;
        
        // Calculate max trade size to avoid slippage
        const maxQty = Math.min(buyData.askQty, sellData.bidQty);
        
        if (maxQty > 0) {
          const grossProfit = (sellData.bid - buyData.ask) * maxQty;
          const fees = (buyData.ask * maxQty * TAKER_FEE) + (sellData.bid * maxQty * TAKER_FEE) + NETWORK_FEE;
          const netProfit = grossProfit - fees;
          const spread = ((sellData.bid - buyData.ask) / buyData.ask) * 100;
          
          opportunities.push({
            coin,
            spread,
            grossProfit, netProfit, fees,
            maxQty,
            direction: `Buy ${buyEx.toUpperCase()} -> Sell ${sellEx.toUpperCase()}`,
            buyEx: buyEx.charAt(0).toUpperCase() + buyEx.slice(1),
            sellEx: sellEx.charAt(0).toUpperCase() + sellEx.slice(1),
            buyPrice: buyData.ask,
            sellPrice: sellData.bid,
            raw: {
              [buyEx]: { ...buyData },
              [sellEx]: { ...sellData }
            }
          });
        }
      }
    }
  });

  // Sort by highest Net Profit ($)
  opportunities.sort((a, b) => b.netProfit - a.netProfit);

  // Send back to main thread
  postMessage({ type: 'SCAN_RESULTS', data: opportunities });
}

let calcInterval = null;

function connectWebSockets() {
  if (binanceWs) binanceWs.close();
  if (bybitWs) bybitWs.close();
  if (okxWs) okxWs.close();

  // Binance multi-stream
  const binanceStreams = coins.map(c => `${c.toLowerCase()}@bookTicker`).join('/');
  binanceWs = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${binanceStreams}`);

  binanceWs.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.stream && parsed.data) {
        const symbol = parsed.data.s.toUpperCase();
        if (marketData[symbol] && parsed.data.b && parsed.data.a) {
          marketData[symbol].binance.bid = parseFloat(parsed.data.b);
          marketData[symbol].binance.bidQty = parseFloat(parsed.data.B);
          marketData[symbol].binance.ask = parseFloat(parsed.data.a);
          marketData[symbol].binance.askQty = parseFloat(parsed.data.A);
        }
      }
    } catch (e) {}
  };

  binanceWs.onerror = () => { postMessage({ type: 'LOG', msg: 'Binance WS Error', level: 'error' }); };
  binanceWs.onclose = () => { if (isRunning) setTimeout(connectWebSockets, 5000); };

  // Bybit V5
  bybitWs = new WebSocket('wss://stream.bybit.com/v5/public/spot');
  bybitWs.onopen = () => {
    const args = coins.map(c => `orderbook.1.${c.toUpperCase()}`);
    bybitWs.send(JSON.stringify({ op: 'subscribe', args }));
  };

  bybitWs.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.topic && parsed.topic.startsWith('orderbook.1.') && parsed.data) {
        const symbol = parsed.topic.replace('orderbook.1.', '').toUpperCase();
        if (marketData[symbol]) {
          const payload = parsed.data;
          let newBid = marketData[symbol].bybit.bid;
          let newBidQty = marketData[symbol].bybit.bidQty;
          let newAsk = marketData[symbol].bybit.ask;
          let newAskQty = marketData[symbol].bybit.askQty;
          let updated = false;

          if (payload.b && payload.b.length > 0) {
            newBid = parseFloat(payload.b[0][0]);
            newBidQty = parseFloat(payload.b[0][1]);
            updated = true;
          }
          if (payload.a && payload.a.length > 0) {
            newAsk = parseFloat(payload.a[0][0]);
            newAskQty = parseFloat(payload.a[0][1]);
            updated = true;
          }

          if (updated) {
            marketData[symbol].bybit.bid = newBid;
            marketData[symbol].bybit.bidQty = newBidQty;
            marketData[symbol].bybit.ask = newAsk;
            marketData[symbol].bybit.askQty = newAskQty;
          }
        }
      }
    } catch (e) {}
  };

  bybitWs.onerror = () => { postMessage({ type: 'LOG', msg: 'Bybit WS Error', level: 'error' }); };
  
  // OKX V5
  okxWs = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
  okxWs.onopen = () => {
    // OKX uses format like BTC-USDT
    const args = coins.map(c => {
      // Very basic formatting: BTCUSDT -> BTC-USDT
      const base = c.replace('USDT', '').replace('FDUSD', '');
      const quote = c.replace(base, '');
      return { channel: 'books', instId: `${base}-${quote}` };
    });
    okxWs.send(JSON.stringify({ op: 'subscribe', args }));
  };

  okxWs.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.arg && parsed.arg.channel === 'books' && parsed.data && parsed.data.length > 0) {
        // Convert BTC-USDT back to BTCUSDT
        const symbol = parsed.arg.instId.replace('-', '').toUpperCase();
        if (marketData[symbol]) {
          const payload = parsed.data[0];
          let newBid = marketData[symbol].okx.bid;
          let newBidQty = marketData[symbol].okx.bidQty;
          let newAsk = marketData[symbol].okx.ask;
          let newAskQty = marketData[symbol].okx.askQty;
          let updated = false;

          // OKX payload format: [price, size, ...]
          if (payload.bids && payload.bids.length > 0) {
            newBid = parseFloat(payload.bids[0][0]);
            newBidQty = parseFloat(payload.bids[0][1]);
            updated = true;
          }
          if (payload.asks && payload.asks.length > 0) {
            newAsk = parseFloat(payload.asks[0][0]);
            newAskQty = parseFloat(payload.asks[0][1]);
            updated = true;
          }

          if (updated) {
            marketData[symbol].okx.bid = newBid;
            marketData[symbol].okx.bidQty = newBidQty;
            marketData[symbol].okx.ask = newAsk;
            marketData[symbol].okx.askQty = newAskQty;
          }
        }
      }
    } catch (e) {}
  };
  
  okxWs.onerror = () => { postMessage({ type: 'LOG', msg: 'OKX WS Error', level: 'error' }); };
}

self.onmessage = (event) => {
  const { type, payload } = event.data;

  if (type === 'START') {
    isRunning = true;
    initMarketData(payload.coins || ['BTCUSDT', 'ETHUSDT']);
    connectWebSockets();
    
    // Start continuous calculation loop
    if (calcInterval) clearInterval(calcInterval);
    calcInterval = setInterval(calculateSpreads, 500); // Compute spreads every 500ms
    postMessage({ type: 'LOG', msg: 'Matrix Worker Started (Binance, Bybit, OKX)', level: 'success' });
  } 
  
  else if (type === 'STOP') {
    isRunning = false;
    if (calcInterval) clearInterval(calcInterval);
    if (binanceWs) binanceWs.close();
    if (bybitWs) bybitWs.close();
    if (okxWs) okxWs.close();
    postMessage({ type: 'LOG', msg: 'Worker Stopped', level: 'info' });
  }
};
