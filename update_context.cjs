const fs = require('fs');

const contextFile = 'RESUME_CONTEXT.md';
let contextStr = fs.readFileSync(contextFile, 'utf8');

const sessionLog = 
### [Session: 2026-07-23] AI Agent #2 (TopNavbar Extraction)
* **Goal**: Extract the complex TopNavbar (Lines 145 to 712) containing Search, Timeframes, Indicators, and Chart Styles into a dedicated component.
* **Logic & Flow**:
  - To respect the constraint "ui draticaal app tas connect mat karna" (Shift UI logic incrementally), we avoided migrating 55+ state variables to Zustand immediately.
  - Instead, we used a **Props Object Injection Pattern**. All 55+ required variables (state, functions, config) are injected directly into \<TopNavbar {...props} />\.
* **Languages Used**: TypeScript, TSX, Node.js (for precise regex replacement of 500+ lines in App.tsx without crashing).
* **Actions Taken**:
  1. Identified exact boundaries of Mobile & Desktop Headers inside \App.tsx\.
  2. Created \src_demo/components/layout/TopNavbar.tsx\.
  3. Replaced 560+ lines of raw UI code in \App.tsx\ with a clean \<TopNavbar />\ call.
* **Flowchart**:
\\\mermaid
graph TD
    subgraph "Phase 3.3.1: TopNavbar Decoupling"
        APP[App.tsx (Monolith)]
        STATE[Local useState hooks]
        
        APP -->|Renders| TN_OLD[Raw UI code inside return block]
        
        TN_OLD -.->|Extracted| TN_NEW[TopNavbar.tsx]
        
        STATE -->|55+ Props passed safely| TN_NEW
        
        APP -->|Now renders| TN_NEW
    end
\\\
* **Status**: TopNavbar is physically decoupled. Global state migration (Zustand UIStore) is safely deferred to Phase 3.4.

;

// Insert the new session right after "## ?? Agent Conversation & Action History"
const marker = "## ?? Agent Conversation & Action History\n";
const markerIndex = contextStr.indexOf(marker);

if (markerIndex !== -1) {
    const before = contextStr.substring(0, markerIndex + marker.length);
    const after = contextStr.substring(markerIndex + marker.length);
    const newContextStr = before + sessionLog + after;
    fs.writeFileSync(contextFile, newContextStr);
    console.log("Updated RESUME_CONTEXT.md successfully.");
} else {
    console.log("Could not find the marker.");
}

