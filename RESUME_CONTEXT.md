# QuantaAI / Titan Multi-Engine Chart - Project Resume State
**Last Updated**: 2026-07-23 (IST)

## CURRENT CRITICAL BUG (START HERE!)
**[BUG REPORT]**: When clicking on a tool/item in the RightSidebar (Right Bar), the frontend crashes! 
**Instruction for Next AI Agent**: 
> **STRICT INSTRUCTION**: Do NOT proceed with any new feature extraction until you have fixed the crash in the RightSidebar. The user reported that interacting with the RightSidebar causes a frontend crash. Check the browser console, inspect App.tsx and RightSidebar.tsx (and its subcomponents like RightSidebarWatchlist.tsx), and resolve the event handler or undefined state that is causing the crash.

---

## Current Phase: Phase 3.3 (UI Monolith De-Coupling)
We are currently in the middle of extracting the 8000+ line monolith App.tsx into modular React components under src_demo/components/layout/.

### What has been successfully completed:
1. **Engine Decoupling (Phase 3.1 & 3.2)**: 
   - Canvas2D, WebGL, and WebGPU native engines were split into their own drawings/ and indicators/ sub-folders.
   - UniversalTranslator is used by all 3 to normalize coordinates.
2. **RightSidebar Extraction (Needs Bug Fix)**:
   - enderRightSidePanel removed from App.tsx (reduced ~400 lines).
   - Hot-swapped with <RightSidebar /> which internally renders RightSidebarWatchlist.tsx.
   - Fixed a ReferenceError by ensuring only active/valid props are passed from App.tsx.
   - *STATUS*: Extracted, but interactions are causing a crash (See BUG REPORT above).
3. **LeftToolbar Extraction**:
   - LeftToolbar removed from App.tsx (reduced ~400 lines).
   - Includes rendering engine switcher (WebGPU Rocket / WebGL Zap).
4. **Git Backups**:
   - State successfully backed up up to the extraction.

### What is PENDING (After fixing the crash):
1. **TopNavbar Extraction**:
   - The Top Navbar is deeply intertwined with chartInterval, handleCandleStyleChange, onBackToCoins and searchQuery. 
   - Needs to be safely extracted and hot-swapped just like LeftToolbar.
2. **BottomPanel Extraction**:
   - Time range buttons (1D, 5D, 1M, YTD, etc.) need to go to BottomPanel.tsx.
3. **Zustand UIStore Migration**:
   - While UIStore.ts is created, App.tsx still holds local useState for things like ightSidebar. After physical extraction, we need to replace useState with useUIStore().

### Strict Rules to Remember:
1. **500 Lines Limit**: No single file should exceed 500-600 lines.
2. **Professional & Safe Shift**: Do not connect everything drastically at once. Hot-swap components one by one and test in browser to prevent full crashes.
3. **No Jugaad / Math First**: Pure WGSL and Native Canvas. No three.js or pixi.js.
