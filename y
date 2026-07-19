# Advanced Arbitrage WebWorker Implementation Plan

Aapka naya requirement ekdum pro-level hai! Binance aur Bybit ke heavy websockets ko main UI thread se nikal kar **WebWorker** mein offload karne se platform zero lag ke saath chalega (chahe 100+ coins ek saath scan karne paden).

## Proposed Changes

### 1. Dedicated Web Worker (`src/arbitrageWorker.js`)
- [NEW] `src/arbitrageWorker.js`
  - Ye background script Binance aur Bybit ke WebSockets se connect hogi.
  - Multi-coin scanning support karegi (e.g., BTCUSDT, ETHUSDT, SOLUSDT...).
  - **Net Profit Calculator (Smart Spread):** Gross Spread mein se Trading Fees (e.g. 0.1%) aur Average Network Transfer Fees (fixed/estimated per coin) deduct karega.
  - Main thread (`ArbitrageBot.jsx`) ko sirf profitable ya updated signals bhejeka, jisse React component ko baar-baar render na karna pade aur UI fast rahe.

### 2. Multi-Coin Scanner UI (`src/components/ArbitrageBot.jsx`)
- [MODIFY] `src/components/ArbitrageBot.jsx`
  - Abhi ye sirf ek `coin` (active chart) scan kar raha hai. Main isko ek **Multi-Coin Radar** mein badal dunga jo ek table ya list mein multiple arbitrage opportunities dikhayega.
  - **Fiat / Stablecoin Filter:** Ek simple toggle hoga jo specifically USDT/FDUSD ya INR type pairs ko filter karega.
  - **Custom Threshold Alerts:** Ek input field hoga (e.g., `> 1.5%`). Agar spread is target ko cross karta hai, toh ek custom visual notification/sound aayegi.
  - **1-Click Execution Button:** Har opportunity ke aage ek "Execute" button hoga jo directly aapke existing **Paper Trading engine** mein connect hoga.

### 3. Paper Trading Integration (`src/App.jsx`)
- [MODIFY] `src/App.jsx`
  - `ArbitrageBot` ko `App.jsx` se ek `onExecuteArbitrage` function pass kiya jayega.
  - Jab user "Execute" karega, toh ye function 2 entries create karega aapke Paper Trading `positions` mein: Ek 'BUY' trade (Binance price par) aur ek 'SELL' trade (Bybit price par) simultaneously.

---

> [!IMPORTANT]
> **User Review Required**
> 1. Kya aap multi-coin scanner chahte hain (jo ek sath 10-20 top coins scan kare), ya fir sirf current selected chart coin ka hi deep spread analyse kare?
> 2. Network fees fixed rakhni hai (e.g. 1 USDT per transaction) ya API se live fetch karne ka estimate lagana hai? (Fixed rakhna paper-trading execution ke liye smooth rahega).

Agar plan sahi lag raha hai, toh "Proceed" par click karein aur main code likhna start karta hu!
