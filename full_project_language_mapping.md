# Complete File-by-File Language Mapping (Zero to Max Speed)

Yeh report aapke poore project ka ek-ek file cover karti hai. Isme explicitly bataya gaya hai ki agar aapko "No-Compromise HFT Speed" chahiye toh kaunsi file exactly kis extension (`.rs`, `.wgsl`, `.cpp`) mein convert hogi, aur kaunsi file voluntarily `.js` ya `.py` mein hi chhod deni chahiye kyunki wahan native ki zarurat nahi hai.

---

## 1. ⚡ The Heavy Calculation Files (Must Change)
In files mein loop aur array calculations hoti hain. JavaScript yahan memory leak aur Garbage Collection lag paida karta hai. Inko convert karna zaroori hai.

| Current File | New File | Why & What Language? |
| :--- | :--- | :--- |
| `indicatorsRegistry.js` | **`indicatorsRegistry.rs`** (Rust) <br> *or* **`indicatorsRegistry.wgsl`** (WebGPU) | Agar heavy Math (MACD, RSI) karni hai toh Rust (WASM) best hai. Agar lakhon candles par parallel math karni hai, toh WGSL Compute Shader seedha GPU par chalega. |
| `indicatorWorker.js` | **`indicatorWorker.rs`** (Rust) | Web Worker mein JS arrays pass karne mein lag aata hai. Rust WASM ka `SharedArrayBuffer` use karne se zero-copy fast transfer hoga. |
| `arbitrageWorker.js` | **`arbitrageWorker.rs`** (Rust) <br> *or Server-side* **`arbitrageWorker.cpp`** | Arbitrage milliseconds ka khel hai. Client-side par Rust WASM, ya Server par C++ (CUDA) use karein jisse matrices fast compare hon. |
| `candleCache.js` | **`candleCache.rs`** (Rust) | JS arrays memory bohot khate hain. Historical candles (100k+) ko Rust ke Memory Manager mein rakhna padega (binary Float32Arrays). |

---

## 2. 🎨 The Charting & Graphics Engine (Must Split)
Browser DOM slow hota hai. Graphics ko GPU par shift karna hoga.

| Current File | New File | Why & What Language? |
| :--- | :--- | :--- |
| `App.jsx` (Chart Part) | **`ChartEngine.wgsl`** (WebGPU) <br> *and* **`ChartEngine.rs`** (Rust) | `App.jsx` bohot bada hai (400KB+). Jo part UI banata hai wo JS mein rahega (below). Lekin jo part **Chart Draw** karta hai (Candles, Lines), usko nikal kar **WGSL Render Pipeline** aur **Rust WASM Drivers** mein likhna padega taaki zero-JS overhead se 144+ FPS mile. |

---

## 3. 🛡️ The Backend Trading Engine (Speed vs AI)
Python AI ke liye badhiya hai, par live trading execution (latency) ke liye bohot slow hai.

| Current File | New File | Why & What Language? |
| :--- | :--- | :--- |
| `main.py` (Core Server) | **`main.cpp`** (C++) *or* **`Main.java`** | Order execution aur websocket streaming ke liye Python slow hai. High-Frequency Trading servers hamesha C++ ya heavily optimized Java mein likhe jate hain. |
| `smart_order_router.py` | **`smart_order_router.cpp`** (C++) | Alag-alag exchanges par instant order bhejna (nano-second latency). Ye C++ bina kisi delay ke karega. |
| `ai_service.py` | **`ai_service.py`** (No Change) | **Keep in Python.** AI aur Machine Learning (PyTorch/TensorFlow) ke liye Python undisputed king hai. Ise bilkul mat chhediye. |
| `harvester.py`, `news_fetcher.py` | **`harvester.go`** (GoLang) *or Keep in JS/PY* | Web Scraping aur async requests ke liye GoLang bohot fast aur parallel hai. Par agar speed critical nahi hai, toh Python/JS is fine. |

---

## 4. 🟢 The "Leave as JavaScript/React" Files (No Change Needed)
In files ko forcefully change mat kariye. Inka kaam UI (Buttons, Menus) banana aur Network (WebSockets) handle karna hai, jiske liye JS perfect aur sabse fast/aasaan hai.

| Current File | Action | Why? |
| :--- | :--- | :--- |
| `Login.jsx` | **Leave as `.jsx`** | React UI handle karne ke liye banaya gaya hai. C++ mein login page banana bewakoofi hogi. |
| `CursorMenu.jsx` | **Leave as `.jsx`** | DOM manipulation (menus) is best in JS. |
| `DrawingToolbar.jsx` | **Leave as `.jsx`** | UI Toolbar interactions. |
| `CoinSelectPage.jsx` | **Leave as `.jsx`** | Normal web interface. |
| `main.jsx` (React Root) | **Leave as `.jsx`** | Ye sirf app ko initialize karta hai. |
| `exchanges.js` | **Leave as `.js` / `.ts`** | Ye file API calls (Binance websockets) handle karti hai. Internet speed yahan bottleneck hoti hai, language ki processing nahi. JS/TS yahan bilkul theek hai. |
| `tradingFeatures.js` | **Leave as `.js` / `.ts`** | Ye general business logic hai. Agar heavy calculation nahi hai toh TS/JS is best. |
| `index.css` | **Leave as `.css`** | CSS is standard. |

---

### Final Summary Formula:
*   **UI / Buttons / Menus / API Calls** 👉 `JavaScript / React (.jsx, .js)`
*   **Heavy Math / Logic / Caching (Client)** 👉 `Rust WASM (.rs)`
*   **Chart Drawing / Massive Parallel Math** 👉 `WebGPU Shaders (.wgsl)`
*   **Core Server Execution / HFT Routing** 👉 `C++ (.cpp) or Java (.java)`
*   **AI Training & Prediction** 👉 `Python (.py)`
