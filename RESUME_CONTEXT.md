# QuantaAI / Titan Multi-Engine Chart - Project Resume State & Agent Log
**Last Updated**: 2026-07-23 (IST)

---

## ?? Agent Conversation & Action History

### [Session: 2026-07-23] AI Agent #1 (Current)
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

## ?? Current Phase: Phase 3.3 (UI Monolith De-Coupling)
We are in the middle of extracting the 8000+ line monolith App.tsx into modular React components under src_demo/components/layout/. 

**Direction / Path Forward**: 
Hum UI Monolith ko chhote hisso me tod rahe hain. Right Sidebar aur Left Toolbar ho gaya hai, ab humara next step **TopNavbar** aur **BottomPanel** par shift hona hai taaki App.tsx ka weight 8000 lines se kam hokar minimal bache.

### What is PENDING (Next Agent Start Here!):
1. **TopNavbar Extraction**:
   - The Top Navbar is deeply intertwined with chartInterval, handleCandleStyleChange, onBackToCoins and searchQuery. 
   - Needs to be safely extracted and hot-swapped just like LeftToolbar.
2. **BottomPanel Extraction**:
   - Time range buttons (1D, 5D, 1M, YTD, etc.) need to go to BottomPanel.tsx.
3. **Zustand UIStore Migration**:
   - App.tsx still holds local useState for things like ightSidebar. After physical extraction, replace useState with useUIStore().

---

## ?? STRICT RULES FOR ALL FUTURE AGENTS
1. **Never Break the Flow**: Start EXACTLY from where the last agent left off in the PENDING section.
2. **500 Lines Limit**: No single file should exceed 500-600 lines.
3. **Professional & Safe Shift**: Do not connect everything drastically at once. Hot-swap components one by one and test in browser to prevent full crashes.
4. **No Jugaad / Math First**: Pure WGSL and Native Canvas. No three.js or pixi.js.
5. **Update This Log**: At the end of your session, YOU MUST update this RESUME_CONTEXT.md file with what you accomplished and any bugs you fixed so the next agent has full context.
