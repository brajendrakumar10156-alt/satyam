# QuantaAI / Titan Multi-Engine Chart - Project Resume State & Agent Log
**Last Updated**: 2026-07-23 (IST)

---

## 🏗️ Architectural Blueprint: Breaking the Monolith
*(As requested by the user, here is the detailed breakdown of HOW and WHY we are extracting App.tsx, complete with logic, components, languages, and a flowchart.)*

### ❓ Why are we breaking App.tsx?
The original App.tsx became an **8000+ line monolith**. It contained everything: UI logic, state management (hundreds of useState hooks), API calls, AND rendering engine bindings. 
This caused:
1. **Severe Performance Bottlenecks**: A single UI toggle (like opening a sidebar) would cause the entire 8000-line tree to re-evaluate.
2. **Maintenance Nightmare**: Scrolling and finding bugs was impossible.
3. **500-Line Limit Violation**: The core project rule is that no single file should exceed 500-600 lines.

### 🧩 How are we breaking it (The Logic & Parts)?
We are splitting the app into **3 distinct layers**:
1. **Global State Layer (Zustand)**: Extracting local useState hooks into UIStore.ts and DataTranslatorStore.ts so components don't need "prop-drilling". *(Language: TypeScript)*
2. **UI Component Layer (React)**: Slicing the UI into independent layout files.
   - RightSidebar.tsx (Watchlist, Details, Orderbook)
   - LeftToolbar.tsx (Drawing Tools, Engine Switcher)
   - TopNavbar.tsx (Coin Search, Intervals, Chart Settings)
   - BottomPanel.tsx (Time Ranges - 1D, 1M, YTD)
   *(Language: TSX / React)*
3. **Core Rendering Engines (Native)**: Extracting Canvas/GPU logic into isolated folders (core_render_webgpu/, core_render_webgl/).
   *(Language: WGSL for WebGPU, GLSL for WebGL, TypeScript for Web Worker/Math)*

### 📊 Current Architecture Flowchart (Before vs Now)
`mermaid
graph TD
    subgraph "BEFORE (The 8000-Line Monolith)"
        A[App.tsx] -->|Contains| B(Local State)
        A -->|Contains| C(Top Navbar UI)
        A -->|Contains| D(Right Sidebar UI)
        A -->|Contains| E(Left Toolbar UI)
        A -->|Contains| F(WebGPU Engine bindings)
        A -->|Contains| G(WebGL Engine bindings)
    end

    subgraph "CURRENT (The Modular 'Titan' Architecture)"
        Z[App.tsx - Clean Container]
        
        %% State Management
        Z -.->|Reads/Writes| S1[(UIStore.ts)]
        Z -.->|Reads/Writes| S2[(DataStore.ts)]

        %% UI Components
        Z --> UI1[LeftToolbar.tsx]
        Z --> UI2[RightSidebar.tsx]
        Z --> UI3[TopNavbar.tsx]
        Z --> UI4[BottomPanel.tsx]

        %% Native Hardware Engines
        Z --> E1{NativeEngineManager.ts}
        E1 -->|Hardware Detected| E2[WebGPUChartEngine.tsx]
        E1 -->|Fallback| E3[WebGLChartEngine.tsx]
        
        %% Engine Internals
        E2 --> W1[WGSL Shaders]
        E3 --> W2[GLSL Shaders]
    end
`

---

## 🔮 Future Roadmap: Complete Eradication of the Monolith
*(Here is exactly what we will break in the FUTURE, into how many parts, and using what languages).*

### 1. What will be broken down in the future?
App.tsx currently still holds the **WebSocket logic**, **Chart Canvas Container**, and **Event Listeners**. In the future, App.tsx will have exactly 0 logic. It will just be a <Layout> wrapper.

### 2. How many parts & what language?
- **Network / Socket Layer (2 parts - TypeScript)**: 
  - BinanceSocketManager.ts: For live ticker streaming.
  - APIClient.ts: For historical candle fetching.
- **Chart Data Context (1 part - TypeScript/Zustand)**: 
  - ChartDataStore.ts: Will hold all candles and live price data globally.
- **UI Interaction Layer (3 parts - TSX)**:
  - TopNavbar.tsx: Search and intervals.
  - BottomPanel.tsx: Time ranges.
  - Modals.tsx: Popups for indicators and settings.
- **Core Math / Execution Engine (2 parts - Rust/WASM & C++)**:
  - lib.rs (Rust): High-performance indicator math running off the main thread.
  - HFT Server (C++): C++ backend executing ML inferences via CUDA.

### 📊 Future Architecture Flowchart (The Ultimate Goal)
`mermaid
graph TD
    subgraph "FRONTEND UI (TSX / Tailwind)"
        APP[App.tsx - Bare Wrapper]
        APP --> L1[TopNavbar.tsx]
        APP --> L2[LeftToolbar.tsx]
        APP --> L3[RightSidebar.tsx]
        APP --> L4[BottomPanel.tsx]
        APP --> L5[ChartContainer.tsx]
    end

    subgraph "GLOBAL STATE (Zustand / TS)"
        UI_STATE[(UIStore.ts)] -.->|UI Sync| APP
        DATA_STATE[(ChartDataStore.ts)] -.->|Data Sync| L5
    end

    subgraph "DATA STREAMING (TypeScript)"
        WS[BinanceSocketManager.ts] -->|Live Ticker| DATA_STATE
        REST[APIClient.ts] -->|Historical| DATA_STATE
    end

    subgraph "NATIVE GRAPHICS PIPELINE (WGSL / TS)"
        L5 --> NM[NativeEngineManager.ts]
        NM -->|Zero-Copy| GPU[WebGPU Engine]
        GPU --> SH[WGSL Compute Shaders]
    end

    subgraph "MATH & BACKEND (Rust / C++)"
        DATA_STATE -->|WASM Memory| RUST[Rust / WASM Core]
        RUST -->|Heavy Math| IND[Technical Indicators]
        RUST <--> C_BACKEND((C++ / CUDA Backend))
    end
`

---

## 📜 Agent Conversation & Action History

### [Session: 2026-07-23] AI Agent #1 
* **Goal**: Shift UI components slowly from App.tsx without drastically connecting them and breaking the app. Follow the 500-lines limit rule.
* **Actions Taken**:
  1. Extracted RightSidebar (approx 400 lines) out of App.tsx.
  2. Extracted LeftToolbar (approx 400 lines) out of App.tsx.
  3. **Bug Hunt & Fixes**: 
     - **Bug 1**: handleRemoveWatchlist is not defined. Caused by hallucinated props. Fixed by removing invalid props.
     - **Bug 2**: Crash occurred again because App.tsx had *two* <RightSidebar> tags and the script only fixed the first one. Fixed by doing a global eplaceAll.
     - **Bug 3**: ormatCompactNumber is not defined when clicking on the RightSidebar tool (Instrument Details). Fixed by carefully mapping and passing all 10+ required props (priceColor, coinFundamentals, undingRate, etc.) from App.tsx directly to <RightSidebar /> without any hallucinated functions.
     - **Bug 4**: Passed selectedExchange to OrderBookPanel inside RightSidebar.tsx to prevent silent crashes.
     - **Bug 5**: TypeError: Cannot read properties of undefined (reading 'border'). This happened because App.tsx passed 	hemeConfig={t} to RightSidebar, but the children (RightSidebarWatchlist and RightSidebarDetails) expected 	 directly. Fixed by explicitly passing 	={t} inside RightSidebar.tsx.
* **Status**: The Right Sidebar (Watchlist, Details, Orderbook) and Left Toolbar (Drawing Tools, Engine Switcher) are now 100% stable, fully detached from the monolith, and do not crash on click.

---

## 🎯 Current Phase: Phase 3.3 (UI Monolith De-Coupling)
We are in the middle of extracting the 8000+ line monolith App.tsx into modular React components under src_demo/components/layout/. 

### What is PENDING (Next Agent Start Here!):
1. **TopNavbar Extraction**:
   - The Top Navbar is deeply intertwined with chartInterval, handleCandleStyleChange, onBackToCoins and searchQuery. 
   - Needs to be safely extracted and hot-swapped just like LeftToolbar.
2. **BottomPanel Extraction**:
   - Time range buttons (1D, 5D, 1M, YTD, etc.) need to go to BottomPanel.tsx.
3. **Zustand UIStore Migration**:
   - App.tsx still holds local useState for things like ightSidebar. After physical extraction, replace useState with useUIStore().

---

## ⚠️ STRICT RULES FOR ALL FUTURE AGENTS
1. **Never Break the Flow**: Start EXACTLY from where the last agent left off in the PENDING section.
2. **500 Lines Limit**: No single file should exceed 500-600 lines.
3. **Professional & Safe Shift**: Do not connect everything drastically at once. Hot-swap components one by one and test in browser to prevent full crashes.
4. **No Jugaad / Math First**: Pure WGSL and Native Canvas. No three.js or pixi.js.
5. **Update This Log**: At the end of your session, YOU MUST update this RESUME_CONTEXT.md file with what you accomplished and any bugs you fixed so the next agent has full context.
