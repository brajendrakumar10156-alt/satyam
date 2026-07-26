# 🚀 Satyam AI Terminal - Startup Guide

Ye document batata hai ki project ke alag-alag engines aur UI ko kaise run karna hai.

## 1. Web Application (React/Vite UI)
Front-end UI (jisme charts, trading panel, aur modals hain) start karne ke liye:
```bash
npm run dev
```
(By default ye `http://localhost:5173/` ya jo port free ho uspe khulega)

## 2. Rust Collector Engine (Data Downloading)
Ye engine Binance se real-time aur historical data (`.iqbin` format mein) `market_data/` folder mein download/stream karta hai.
```bash
cd backend_rust_collector
cargo run --release
```

## 3. Rust Backend Engine (Server & API)
Ye server web app aur collector ke beech communication handle karta hai (WebSockets, API routes, data merging).
```bash
cd backend_rust
cargo run --release
```

---

## 🛠️ PM2 ka Use (Background mein run karne ke liye - Recommended)

Agar aapko terminal band karne ke baad bhi in engines ko background mein chalana hai, toh humne **PM2** setup kiya hua hai.

### Saare background services ka status dekhne ke liye:
```bash
pm2 status
```

### Background services start/on karne ke liye:
Agar `rust-backend-engine` (ID 0) aur `rust-collector-engine` (ID 1) **stopped** hain, toh inhe start karne ke liye:
```bash
pm2 start 0 1
```

### Background services stop/band karne ke liye:
(Jaise ki agar kabhi files move karni ho aur `EPERM` lock hataana ho)
```bash
pm2 stop 0 1
```

### PM2 ke logs dekhne ke liye (Ki backend me kya chal raha hai):
```bash
pm2 logs
```

### PM2 list save karne ke liye (Taaki laptop restart pe auto-start ho jaye):
```bash
pm2 save
```
